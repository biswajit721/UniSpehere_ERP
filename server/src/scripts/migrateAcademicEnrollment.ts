/**
 * One-time (and safely re-runnable) data migration for the Academic / Enrollment / Attendance rebuild.
 *
 * Run AFTER the schema has been applied (`prisma migrate dev` or `prisma db push`):
 *
 *     npm run db:backfill -- --dry-run     # preview: everything is rolled back
 *     npm run db:backfill                  # apply
 *
 * What it does (nothing is deleted or overwritten):
 *   1. Adds any missing roles/permissions (e.g. attendance:update) and the attendance policy row.
 *   2. Fills academic-session start/end dates from their years where they are empty.
 *   3. Links legacy subjects to a Program (only when that is unambiguous) and creates each
 *      program's Semester rows, then links subjects to their Semester.
 *   4. Creates a StudentEnrollment for every student that has none - the CURRENT one from the
 *      student's present program/batch/section/semester, plus a closed one for every earlier
 *      (session, semester) that legacy attendance was recorded under.
 *   5. Points every legacy AttendanceRecord at the enrollment that was true when it was taken,
 *      and completes legacy AttendanceSessions (department, program, semester, faculty, times, slots).
 *   6. Creates faculty assignments from the existing timetable.
 *   7. Applies the database invariants (one open enrollment per student, etc.).
 *
 * Everything runs in ONE transaction: if any step fails, the database is left exactly as it was.
 */
import { Prisma, PrismaClient } from "@prisma/client";
import { ensureDatabaseInvariants } from "../config/dbInvariants";
import { syncPermissions } from "../config/permissionMatrix";
import { ensureProgramSemesters } from "../modules/academics/academics.helpers";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

class DryRunRollback extends Error {}

/**
 * The period times the OLD attendance screen showed (it hard-coded six periods). They are used
 * ONLY to give existing attendance sessions a start/end time and, when the period grid is still
 * empty, to create it so old records keep meaningful times. Review them under Academics -> Periods.
 */
const LEGACY_SCREEN_PERIODS: Record<number, [string, string]> = {
  1: ["08:00", "09:00"],
  2: ["09:00", "10:00"],
  3: ["10:00", "11:00"],
  4: ["11:00", "12:00"],
  5: ["13:00", "14:00"],
  6: ["14:00", "15:00"],
};

const dateOnly = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const chunk = <T>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

async function migrate(tx: Prisma.TransactionClient) {
  const report: Record<string, number> = {};
  const warnings: string[] = [];
  const bump = (key: string, n = 1) => {
    report[key] = (report[key] ?? 0) + n;
  };

  // ------------------------------------------------------------------ 1. permissions + policy
  const perms = await syncPermissions(tx);
  bump("permissions added", perms.permissionsCreated);
  await tx.attendancePolicy.upsert({ where: { singleton: true }, update: {}, create: { singleton: true } });

  // ------------------------------------------------------------------ 2. academic session dates
  const sessions = await tx.academicSession.findMany();
  for (const s of sessions) {
    if (!s.startDate || !s.endDate) {
      await tx.academicSession.update({
        where: { id: s.id },
        data: {
          startDate: s.startDate ?? new Date(Date.UTC(s.startYear, 6, 1)), // 1 July of the start year
          endDate: s.endDate ?? new Date(Date.UTC(s.endYear, 5, 30)), //      30 June of the end year
        },
      });
      bump("session dates filled");
      warnings.push(`Session ${s.label}: dates were empty, set to 1 Jul ${s.startYear} - 30 Jun ${s.endYear}. Review under Academics -> Sessions.`);
    }
  }

  // ------------------------------------------------------------------ 3. subjects -> program
  const programs = await tx.program.findMany();
  const programsByDept = new Map<string, string[]>();
  for (const p of programs) programsByDept.set(p.departmentId, [...(programsByDept.get(p.departmentId) ?? []), p.id]);

  const unmapped = await tx.subject.findMany({ where: { programId: null } });
  for (const subject of unmapped) {
    let programId: string | null = null;
    const deptPrograms = programsByDept.get(subject.departmentId) ?? [];
    if (deptPrograms.length === 1) {
      programId = deptPrograms[0];
    } else if (deptPrograms.length > 1) {
      // Several programs share the department: infer from where the subject is actually used.
      const used = await tx.$queryRaw<{ programId: string }[]>(Prisma.sql`
        SELECT DISTINCT b."programId" AS "programId"
        FROM "TimetableSlot" t JOIN "Section" sec ON sec."id" = t."sectionId" JOIN "Batch" b ON b."id" = sec."batchId"
        WHERE t."subjectId" = ${subject.id}
        UNION
        SELECT DISTINCT b."programId"
        FROM "AttendanceSession" a JOIN "Section" sec ON sec."id" = a."sectionId" JOIN "Batch" b ON b."id" = sec."batchId"
        WHERE a."subjectId" = ${subject.id}
      `);
      if (used.length === 1) programId = used[0].programId;
    }
    if (programId) {
      await tx.subject.update({ where: { id: subject.id }, data: { programId } });
      bump("subjects linked to program");
    } else {
      bump("subjects left unmapped");
      warnings.push(`Subject ${subject.code} (${subject.name}) could not be linked to a program automatically - link it under Academics -> Subjects.`);
    }
  }

  // ------------------------------------------------------------------ 3b. semesters per program
  for (const program of programs) {
    const [subj, stud, sess] = await Promise.all([
      tx.subject.aggregate({ _max: { semester: true }, where: { programId: program.id } }),
      tx.student.aggregate({ _max: { currentSemester: true }, where: { programId: program.id } }),
      tx.attendanceSession.aggregate({ _max: { semester: true }, where: { section: { batch: { programId: program.id } } } }),
    ]);
    const count = Math.max(program.durationYears * 2, subj._max.semester ?? 0, stud._max.currentSemester ?? 0, sess._max.semester ?? 0);
    bump("semesters created", await ensureProgramSemesters(tx, program.id, count));
  }

  // subjects -> semester
  const semesterRows = await tx.semester.findMany();
  const semesterId = new Map(semesterRows.map((s) => [`${s.programId}:${s.number}`, s.id]));
  const needSemester = await tx.subject.findMany({ where: { programId: { not: null }, semesterId: null } });
  for (const subject of needSemester) {
    const id = semesterId.get(`${subject.programId}:${subject.semester}`);
    if (id) {
      await tx.subject.update({ where: { id: subject.id }, data: { semesterId: id } });
      bump("subjects linked to semester");
    }
  }

  // ------------------------------------------------------------------ 4. enrollments
  const students = await tx.student.findMany({
    where: { enrollments: { none: {} } },
    select: {
      id: true, departmentId: true, programId: true, batchId: true, sectionId: true, currentSemester: true,
      createdAt: true, deletedAt: true, admissionYear: true, batch: { select: { startYear: true } },
    },
  });

  if (students.length > 0) {
    let allSessions = await tx.academicSession.findMany({ orderBy: { startYear: "desc" } });
    let current = allSessions.find((s) => s.isCurrent) ?? allSessions[0] ?? null;
    if (!current) {
      // No academic session exists at all. Derive the one the first student's own data implies.
      const s0 = students[0];
      const startYear = s0.batch.startYear + Math.ceil(s0.currentSemester / 2) - 1;
      current = await tx.academicSession.create({
        data: {
          label: `${startYear}-${startYear + 1}`, startYear, endYear: startYear + 1,
          startDate: new Date(Date.UTC(startYear, 6, 1)), endDate: new Date(Date.UTC(startYear + 1, 5, 30)),
          isCurrent: true, isActive: true,
        },
      });
      allSessions = [current];
      bump("academic sessions created");
      warnings.push(`No academic session existed; created ${current.label} (marked current) from the students' batch and semester. Review under Academics -> Sessions.`);
    } else if (!allSessions.some((s) => s.isCurrent)) {
      warnings.push(`No academic session is marked "current"; ${current.label} was used for open enrollments. Mark the right one under Academics -> Sessions.`);
    }

    // Earlier (session, semester) placements implied by legacy attendance.
    const combos = await tx.$queryRaw<{ studentId: string; academicSessionId: string; semester: number; minDate: Date; maxDate: Date }[]>(Prisma.sql`
      SELECT r."studentId" AS "studentId", s."academicSessionId" AS "academicSessionId", s."semester" AS semester,
             MIN(s."date") AS "minDate", MAX(s."date") AS "maxDate"
      FROM "AttendanceRecord" r JOIN "AttendanceSession" s ON s."id" = r."attendanceSessionId"
      WHERE r."enrollmentId" IS NULL
      GROUP BY r."studentId", s."academicSessionId", s."semester"
    `);
    const combosByStudent = new Map<string, typeof combos>();
    for (const c of combos) combosByStudent.set(c.studentId, [...(combosByStudent.get(c.studentId) ?? []), c]);

    const rows: Prisma.StudentEnrollmentCreateManyInput[] = [];
    for (const st of students) {
      const currentSemesterId = semesterId.get(`${st.programId}:${st.currentSemester}`);
      if (!currentSemesterId) {
        warnings.push(`Student ${st.id}: program has no Semester ${st.currentSemester}; skipped.`);
        continue;
      }
      const mine = combosByStudent.get(st.id) ?? [];
      const sameAsCurrent = mine.find((c) => c.academicSessionId === current!.id && c.semester === st.currentSemester);
      const removed = st.deletedAt !== null;

      // Closed enrollments for earlier placements found in legacy attendance.
      for (const c of mine) {
        if (c === sameAsCurrent) continue;
        const semId = semesterId.get(`${st.programId}:${c.semester}`);
        if (!semId) continue;
        rows.push({
          studentId: st.id, academicSessionId: c.academicSessionId,
          departmentId: st.departmentId, programId: st.programId, batchId: st.batchId,
          semesterId: semId, sectionId: st.sectionId,
          admissionYear: allSessions.find((s) => s.id === c.academicSessionId)?.startYear ?? st.batch.startYear,
          admissionDate: dateOnly(c.minDate), endDate: dateOnly(c.maxDate),
          enrollmentType: "REGULAR", status: "COMPLETED",
          reasonNote: "Created from legacy attendance records during migration",
        });
        bump("historical enrollments created");
      }

      const earliest = sameAsCurrent ? dateOnly(sameAsCurrent.minDate) : null;
      const created = dateOnly(st.createdAt);
      const start = earliest && earliest < created ? earliest : created;
      rows.push({
        studentId: st.id, academicSessionId: current.id,
        departmentId: st.departmentId, programId: st.programId, batchId: st.batchId,
        semesterId: currentSemesterId, sectionId: st.sectionId,
        admissionYear: st.batch.startYear,
        admissionDate: start,
        endDate: removed ? (dateOnly(st.deletedAt!) < start ? start : dateOnly(st.deletedAt!)) : null,
        enrollmentType: "REGULAR", status: removed ? "WITHDRAWN" : "ACTIVE",
        reasonNote: "Created from the student's existing record during migration",
      });
      bump(removed ? "closed enrollments (removed students)" : "current enrollments created");
    }
    for (const part of chunk(rows, 500)) await tx.studentEnrollment.createMany({ data: part });
  }

  await tx.$executeRaw`UPDATE "Student" st SET "admissionYear" = b."startYear" FROM "Batch" b WHERE b."id" = st."batchId" AND st."admissionYear" IS NULL`;

  // ------------------------------------------------------------------ 5. legacy attendance
  // 5a. enrollment for each record
  bump(
    "attendance records linked to enrollments",
    await tx.$executeRaw`
      UPDATE "AttendanceRecord" r
      SET "enrollmentId" = m."enrollmentId", "markedById" = COALESCE(r."markedById", m."recordedById")
      FROM (
        SELECT DISTINCT ON (r2."id") r2."id" AS "recordId", e."id" AS "enrollmentId", s."recordedById" AS "recordedById"
        FROM "AttendanceRecord" r2
        JOIN "AttendanceSession" s ON s."id" = r2."attendanceSessionId"
        JOIN "StudentEnrollment" e ON e."studentId" = r2."studentId" AND e."academicSessionId" = s."academicSessionId"
        JOIN "Semester" sm ON sm."id" = e."semesterId" AND sm."number" = s."semester"
        WHERE r2."enrollmentId" IS NULL
        ORDER BY r2."id", e."admissionDate" DESC
      ) m
      WHERE r."id" = m."recordId"`
  );
  const orphaned = await tx.attendanceRecord.count({ where: { enrollmentId: null } });
  if (orphaned > 0) warnings.push(`${orphaned} attendance record(s) could not be matched to an enrollment (their student/semester no longer resolves). They still count in totals.`);

  // 5b. department / program / semester on each session
  bump(
    "attendance sessions completed",
    await tx.$executeRaw`
      UPDATE "AttendanceSession" s
      SET "programId" = p."id", "departmentId" = p."departmentId", "semesterId" = sm."id"
      FROM "Section" sec, "Batch" b, "Program" p, "Semester" sm
      WHERE sec."id" = s."sectionId" AND b."id" = sec."batchId" AND p."id" = b."programId"
        AND sm."programId" = p."id" AND sm."number" = s."semester"
        AND (s."semesterId" IS NULL OR s."programId" IS NULL OR s."departmentId" IS NULL)`
  );

  // 5c. who taught it
  await tx.$executeRaw`UPDATE "AttendanceSession" s SET "facultyId" = sub."facultyId" FROM "Subject" sub WHERE sub."id" = s."subjectId" AND s."facultyId" IS NULL AND sub."facultyId" IS NOT NULL`;
  await tx.$executeRaw`UPDATE "AttendanceSession" s SET "facultyId" = f."id" FROM "Faculty" f WHERE f."userId" = s."recordedById" AND s."facultyId" IS NULL`;

  // 5d. period times (+ grid, only if it is completely empty and legacy sessions need it)
  const legacyPeriods = await tx.attendanceSession.findMany({ where: { startTime: null }, distinct: ["period"], select: { period: true } });
  if (legacyPeriods.length > 0 && (await tx.periodDefinition.count()) === 0) {
    for (const { period } of legacyPeriods) {
      const t = LEGACY_SCREEN_PERIODS[period];
      if (t) {
        await tx.periodDefinition.create({ data: { number: period, startTime: t[0], endTime: t[1] } });
        bump("period grid rows created");
      }
    }
    warnings.push("The period grid was empty, so it was created from the periods the old attendance screen showed. Review under Academics -> Periods.");
  }
  await tx.$executeRaw`UPDATE "AttendanceSession" s SET "startTime" = pd."startTime", "endTime" = pd."endTime" FROM "PeriodDefinition" pd WHERE pd."number" = s."period" AND s."startTime" IS NULL`;

  // 5e. slots (duplicate-prevention rows) for every submitted session
  const noSlots = await tx.attendanceSession.findMany({
    where: { status: "SUBMITTED", slots: { none: {} } },
    select: { id: true, sectionId: true, subjectId: true, date: true, period: true, numberOfClasses: true },
  });
  const slotRows = noSlots.flatMap((s) =>
    Array.from({ length: s.numberOfClasses }, (_, i) => ({
      attendanceSessionId: s.id, sectionId: s.sectionId, subjectId: s.subjectId, date: s.date, periodNumber: s.period + i,
    }))
  );
  for (const part of chunk(slotRows, 1000)) await tx.attendanceSlot.createMany({ data: part, skipDuplicates: true });
  bump("attendance slots created", slotRows.length);

  // ------------------------------------------------------------------ 6. faculty assignments from the timetable
  const currentSession = (await tx.academicSession.findFirst({ where: { isCurrent: true } })) ?? (await tx.academicSession.findFirst({ orderBy: { startYear: "desc" } }));
  if (currentSession) {
    const triples = await tx.timetableSlot.findMany({
      distinct: ["subjectId", "sectionId", "facultyId"],
      select: { subjectId: true, sectionId: true, facultyId: true, subject: { select: { programId: true } }, section: { select: { batch: { select: { programId: true } } } } },
    });
    const valid = triples.filter((t) => t.subject.programId && t.subject.programId === t.section.batch.programId);
    const res = await tx.facultySubjectAssignment.createMany({
      data: valid.map((t) => ({ academicSessionId: currentSession.id, subjectId: t.subjectId, sectionId: t.sectionId, facultyId: t.facultyId })),
      skipDuplicates: true,
    });
    bump("faculty assignments created", res.count);
    if (valid.length < triples.length) warnings.push(`${triples.length - valid.length} timetable entr(ies) were skipped for assignments because the subject and section belong to different (or unknown) programs.`);
  }

  // ------------------------------------------------------------------ 7. invariants
  await ensureDatabaseInvariants(tx);

  return { report, warnings };
}

async function main() {
  console.log(DRY_RUN ? "DRY RUN - nothing will be saved.\n" : "Applying migration...\n");
  try {
    const { report, warnings } = await prisma.$transaction(
      async (tx) => {
        const result = await migrate(tx);
        if (DRY_RUN) {
          // Throwing rolls the whole transaction back, so the preview leaves no trace.
          console.log("Would change:");
          for (const [k, v] of Object.entries(result.report)) console.log(`  ${String(v).padStart(6)}  ${k}`);
          if (result.warnings.length) console.log("\nNotes:\n" + result.warnings.map((w) => `  - ${w}`).join("\n"));
          throw new DryRunRollback();
        }
        return result;
      },
      { timeout: 10 * 60 * 1000, maxWait: 60_000 }
    );

    console.log("Migration complete:");
    if (Object.keys(report).length === 0) console.log("  (nothing to change - the database is already migrated)");
    for (const [k, v] of Object.entries(report)) console.log(`  ${String(v).padStart(6)}  ${k}`);
    if (warnings.length) console.log("\nPlease review:\n" + warnings.map((w) => `  - ${w}`).join("\n"));
  } catch (err) {
    if (err instanceof DryRunRollback) {
      console.log("\nDry run finished. No changes were saved.");
      return;
    }
    console.error("\nMigration failed and was rolled back. Your data is unchanged.\n", err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
