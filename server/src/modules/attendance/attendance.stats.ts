import { Prisma } from "@prisma/client";
import { prisma } from "../../config/db";
import { percentage } from "../../utils/dates";

/**
 * Every attendance number in the system comes from here, computed by PostgreSQL:
 *
 *   conducted = SUM(numberOfClasses)                       over the student's submitted sessions
 *   present   = SUM(numberOfClasses WHERE status counts as present)
 *   percent   = present / conducted x 100
 *
 * A 2-period session therefore counts as TWO conducted classes (and two attended ones when the
 * student is present). Cancelled sessions are excluded everywhere.
 */

export interface Policy {
  minimumPercentage: number;
  warningPercentage: number;
  criticalPercentage: number;
  defaultStatusPresent: boolean;
  countExcusedAsPresent: boolean;
  allowFutureAttendance: boolean;
  enforceSessionDates: boolean;
  maxClassesPerSession: number;
  facultyEditWindowDays: number;
}

const DEFAULT_POLICY: Policy = {
  minimumPercentage: 75,
  warningPercentage: 75,
  criticalPercentage: 65,
  defaultStatusPresent: false,
  countExcusedAsPresent: true,
  allowFutureAttendance: false,
  enforceSessionDates: true,
  maxClassesPerSession: 5,
  facultyEditWindowDays: 7,
};

export async function getPolicy(): Promise<Policy> {
  const p = await prisma.attendancePolicy.findFirst();
  if (!p) return DEFAULT_POLICY;
  return {
    minimumPercentage: p.minimumPercentage,
    warningPercentage: p.warningPercentage,
    criticalPercentage: p.criticalPercentage,
    defaultStatusPresent: p.defaultStatusPresent,
    countExcusedAsPresent: p.countExcusedAsPresent,
    allowFutureAttendance: p.allowFutureAttendance,
    enforceSessionDates: p.enforceSessionDates,
    maxClassesPerSession: p.maxClassesPerSession,
    facultyEditWindowDays: p.facultyEditWindowDays,
  };
}

/** A status counts as attended per policy. EXCUSED is configurable. */
export function countsAsPresent(status: string, countExcusedAsPresent: boolean) {
  if (status === "PRESENT" || status === "LATE") return true;
  if (status === "EXCUSED") return countExcusedAsPresent;
  return false;
}

export function statusFor(pct: number, policy: Pick<Policy, "warningPercentage" | "criticalPercentage">) {
  if (pct < policy.criticalPercentage) return "CRITICAL";
  if (pct < policy.warningPercentage) return "WARNING";
  if (pct >= 90) return "EXCELLENT";
  return "GOOD";
}

// ---------------------------------------------------------------------------------------------
// Shortage mathematics
// ---------------------------------------------------------------------------------------------

export interface ShortageInfo {
  conducted: number;
  present: number;
  percentage: number;
  required: number;
  hasShortage: boolean;
  /** Consecutive classes the student must attend to reach `required`; 0 when already there. null if unreachable. */
  classesNeededToRecover: number | null;
  /** When above the requirement: how many classes can still be missed while staying at or above it. */
  classesCanMiss: number | null;
  ifAttendNext: number;
  ifMissNext: number;
}

/**
 * Solve (P + x) / (T + x) >= R / 100 for the smallest whole x:
 *     100(P + x) >= R(T + x)   =>   x >= (R*T - 100*P) / (100 - R)
 * and, when already above R, the largest y with P / (T + y) >= R / 100:
 *     y <= (100*P - R*T) / R
 * Integer arithmetic only, so there is no floating-point drift.
 */
export function computeShortage(present: number, conducted: number, required: number): ShortageInfo {
  const pct = percentage(present, conducted);
  const below = conducted > 0 && present * 100 < required * conducted;

  let needed: number | null = 0;
  if (below) {
    needed = required >= 100 ? null : Math.ceil((required * conducted - 100 * present) / (100 - required));
  }

  let canMiss: number | null = null;
  if (!below && conducted > 0 && required > 0) {
    canMiss = Math.max(0, Math.floor((100 * present - required * conducted) / required));
  }

  return {
    conducted,
    present,
    percentage: pct,
    required,
    hasShortage: below,
    classesNeededToRecover: needed,
    classesCanMiss: canMiss,
    ifAttendNext: percentage(present + 1, conducted + 1),
    ifMissNext: percentage(present, conducted + 1),
  };
}

// ---------------------------------------------------------------------------------------------
// SQL building blocks
// ---------------------------------------------------------------------------------------------

export interface StatFilters {
  academicSessionId?: string;
  semesterId?: string;
  subjectId?: string;
  departmentId?: string;
  programId?: string;
  sectionId?: string;
  from?: string; // YYYY-MM-DD
  to?: string;
}

/** WHERE conditions on AttendanceSession alias `s` - always excludes cancelled sessions. */
function sessionConditions(f: StatFilters): Prisma.Sql {
  const parts: Prisma.Sql[] = [Prisma.sql`s."status" = 'SUBMITTED'`];
  if (f.academicSessionId) parts.push(Prisma.sql`s."academicSessionId" = ${f.academicSessionId}`);
  if (f.semesterId) parts.push(Prisma.sql`s."semesterId" = ${f.semesterId}`);
  if (f.subjectId) parts.push(Prisma.sql`s."subjectId" = ${f.subjectId}`);
  if (f.departmentId) parts.push(Prisma.sql`s."departmentId" = ${f.departmentId}`);
  if (f.programId) parts.push(Prisma.sql`s."programId" = ${f.programId}`);
  if (f.sectionId) parts.push(Prisma.sql`s."sectionId" = ${f.sectionId}`);
  if (f.from) parts.push(Prisma.sql`s."date" >= ${f.from}::date`);
  if (f.to) parts.push(Prisma.sql`s."date" <= ${f.to}::date`);
  return Prisma.join(parts, " AND ");
}

/** Classes the record contributes to "present" (record alias `r`, session alias `s`). */
const presentClasses = (countExcused: boolean) =>
  Prisma.sql`CASE WHEN r."status" IN ('PRESENT','LATE') OR (r."status" = 'EXCUSED' AND ${countExcused}::boolean) THEN s."numberOfClasses" ELSE 0 END`;

const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

// ---------------------------------------------------------------------------------------------
// Student statistics
// ---------------------------------------------------------------------------------------------

export async function totalsForStudent(studentId: string, f: StatFilters, policy: Policy) {
  const rows = await prisma.$queryRaw<{ conducted: number | null; present: number | null }[]>(Prisma.sql`
    SELECT COALESCE(SUM(s."numberOfClasses"), 0)::int AS conducted,
           COALESCE(SUM(${presentClasses(policy.countExcusedAsPresent)}), 0)::int AS present
    FROM "AttendanceRecord" r
    JOIN "AttendanceSession" s ON s."id" = r."attendanceSessionId"
    WHERE r."studentId" = ${studentId} AND ${sessionConditions(f)}
  `);
  const conducted = num(rows[0]?.conducted);
  const present = num(rows[0]?.present);
  return { conducted, present, absent: conducted - present, percentage: percentage(present, conducted) };
}

/** Conducted/present for many students in ONE query (class reports) - keyed by studentId. */
export async function totalsByStudent(f: StatFilters, policy: Policy, studentIds?: string[]) {
  const restrict = studentIds && studentIds.length > 0 ? Prisma.sql`AND r."studentId" IN (${Prisma.join(studentIds)})` : Prisma.empty;
  const rows = await prisma.$queryRaw<{ studentId: string; conducted: number; present: number }[]>(Prisma.sql`
    SELECT r."studentId" AS "studentId",
           SUM(s."numberOfClasses")::int AS conducted,
           SUM(${presentClasses(policy.countExcusedAsPresent)})::int AS present
    FROM "AttendanceRecord" r
    JOIN "AttendanceSession" s ON s."id" = r."attendanceSessionId"
    WHERE ${sessionConditions(f)} ${restrict}
    GROUP BY r."studentId"
  `);
  return new Map(rows.map((r) => [r.studentId, { conducted: num(r.conducted), present: num(r.present) }]));
}

export async function subjectStatsForStudent(studentId: string, f: StatFilters, policy: Policy) {
  const rows = await prisma.$queryRaw<{ subjectId: string; conducted: number; present: number }[]>(Prisma.sql`
    SELECT s."subjectId" AS "subjectId",
           SUM(s."numberOfClasses")::int AS conducted,
           SUM(${presentClasses(policy.countExcusedAsPresent)})::int AS present
    FROM "AttendanceRecord" r
    JOIN "AttendanceSession" s ON s."id" = r."attendanceSessionId"
    WHERE r."studentId" = ${studentId} AND ${sessionConditions(f)}
    GROUP BY s."subjectId"
  `);
  return rows.map((r) => ({ subjectId: r.subjectId, conducted: num(r.conducted), present: num(r.present) }));
}

const TIME_UNITS = {
  day: { trunc: "day", format: "YYYY-MM-DD" },
  week: { trunc: "week", format: "YYYY-MM-DD" },
  month: { trunc: "month", format: "YYYY-MM" },
  year: { trunc: "year", format: "YYYY" },
} as const;
export type TimeUnit = keyof typeof TIME_UNITS;

/** Attendance grouped by calendar day / ISO week (Monday) / month / year. */
export async function bucketsForStudent(studentId: string, unit: TimeUnit, f: StatFilters, policy: Policy) {
  const { trunc, format } = TIME_UNITS[unit]; // whitelisted constants - safe to inline
  const rows = await prisma.$queryRaw<{ bucket: string; conducted: number; present: number }[]>(Prisma.sql`
    SELECT to_char(date_trunc(${Prisma.raw(`'${trunc}'`)}, s."date"::timestamp), ${Prisma.raw(`'${format}'`)}) AS bucket,
           SUM(s."numberOfClasses")::int AS conducted,
           SUM(${presentClasses(policy.countExcusedAsPresent)})::int AS present
    FROM "AttendanceRecord" r
    JOIN "AttendanceSession" s ON s."id" = r."attendanceSessionId"
    WHERE r."studentId" = ${studentId} AND ${sessionConditions(f)}
    GROUP BY 1
    ORDER BY 1
  `);
  return rows.map((r) => {
    const conducted = num(r.conducted);
    const present = num(r.present);
    return { label: r.bucket, conducted, present, absent: conducted - present, percentage: percentage(present, conducted) };
  });
}

/** Attendance grouped by (academic session, semester number) or by academic session alone. */
export async function groupedForStudent(studentId: string, by: "semester" | "session", f: StatFilters, policy: Policy) {
  const rows = await prisma.$queryRaw<
    { sessionId: string; sessionLabel: string; startYear: number; semester: number; conducted: number; present: number }[]
  >(Prisma.sql`
    SELECT a."id" AS "sessionId", a."label" AS "sessionLabel", a."startYear" AS "startYear",
           ${by === "semester" ? Prisma.sql`s."semester"` : Prisma.sql`0`} AS semester,
           SUM(s."numberOfClasses")::int AS conducted,
           SUM(${presentClasses(policy.countExcusedAsPresent)})::int AS present
    FROM "AttendanceRecord" r
    JOIN "AttendanceSession" s ON s."id" = r."attendanceSessionId"
    JOIN "AcademicSession" a ON a."id" = s."academicSessionId"
    WHERE r."studentId" = ${studentId} AND ${sessionConditions(f)}
    GROUP BY a."id", a."label", a."startYear"${by === "semester" ? Prisma.sql`, s."semester"` : Prisma.empty}
    ORDER BY a."startYear", 4
  `);
  return rows.map((r) => {
    const conducted = num(r.conducted);
    const present = num(r.present);
    return {
      label: by === "semester" ? `${r.sessionLabel} · Semester ${r.semester}` : r.sessionLabel,
      academicSessionId: r.sessionId,
      semester: by === "semester" ? r.semester : null,
      conducted,
      present,
      absent: conducted - present,
      percentage: percentage(present, conducted),
    };
  });
}

// ---------------------------------------------------------------------------------------------
// Department / HOD analytics
// ---------------------------------------------------------------------------------------------

export async function departmentAnalytics(
  f: StatFilters,
  policy: Policy,
  page: { limit: number; offset: number }
) {
  const cond = sessionConditions(f);
  const present = presentClasses(policy.countExcusedAsPresent);

  const [overallRows, semesterRows, sectionRows, subjectRows, facultyRows, shortageRows, listRows, listCount] = await Promise.all([
    prisma.$queryRaw<{ conducted: number; present: number; students: number; sessions: number }[]>(Prisma.sql`
      SELECT COALESCE(SUM(s."numberOfClasses"), 0)::int AS conducted,
             COALESCE(SUM(${present}), 0)::int AS present,
             COUNT(DISTINCT r."studentId")::int AS students,
             COUNT(DISTINCT s."id")::int AS sessions
      FROM "AttendanceRecord" r
      JOIN "AttendanceSession" s ON s."id" = r."attendanceSessionId"
      WHERE ${cond}
    `),

    prisma.$queryRaw<{ programId: string | null; programName: string | null; semester: number; conducted: number; present: number }[]>(Prisma.sql`
      SELECT s."programId" AS "programId", p."name" AS "programName", s."semester" AS semester,
             SUM(s."numberOfClasses")::int AS conducted, SUM(${present})::int AS present
      FROM "AttendanceRecord" r
      JOIN "AttendanceSession" s ON s."id" = r."attendanceSessionId"
      LEFT JOIN "Program" p ON p."id" = s."programId"
      WHERE ${cond}
      GROUP BY s."programId", p."name", s."semester"
      ORDER BY p."name", s."semester"
    `),

    prisma.$queryRaw<{ sectionId: string; sectionName: string; batchLabel: string; semester: number; conducted: number; present: number }[]>(Prisma.sql`
      SELECT s."sectionId" AS "sectionId", sec."name" AS "sectionName", b."label" AS "batchLabel", s."semester" AS semester,
             SUM(s."numberOfClasses")::int AS conducted, SUM(${present})::int AS present
      FROM "AttendanceRecord" r
      JOIN "AttendanceSession" s ON s."id" = r."attendanceSessionId"
      JOIN "Section" sec ON sec."id" = s."sectionId"
      JOIN "Batch" b ON b."id" = sec."batchId"
      WHERE ${cond}
      GROUP BY s."sectionId", sec."name", b."label", s."semester"
      ORDER BY s."semester", b."label", sec."name"
    `),

    prisma.$queryRaw<{ subjectId: string; code: string; name: string; semester: number; conducted: number; present: number }[]>(Prisma.sql`
      SELECT s."subjectId" AS "subjectId", sub."code" AS code, sub."name" AS name, s."semester" AS semester,
             SUM(s."numberOfClasses")::int AS conducted, SUM(${present})::int AS present
      FROM "AttendanceRecord" r
      JOIN "AttendanceSession" s ON s."id" = r."attendanceSessionId"
      JOIN "Subject" sub ON sub."id" = s."subjectId"
      WHERE ${cond}
      GROUP BY s."subjectId", sub."code", sub."name", s."semester"
      ORDER BY s."semester", sub."name"
    `),

    // Per-session aggregate first, so SUM(numberOfClasses) is not multiplied by the number of records.
    prisma.$queryRaw<
      { facultyId: string | null; name: string | null; sessions: number; classes: number; lastDate: Date | null; presentWeighted: number; totalWeighted: number }[]
    >(Prisma.sql`
      WITH per_session AS (
        SELECT s."id", s."facultyId", s."numberOfClasses", s."date",
               COUNT(r."id")::int AS total,
               COUNT(r."id") FILTER (WHERE r."status" IN ('PRESENT','LATE') OR (r."status" = 'EXCUSED' AND ${policy.countExcusedAsPresent}::boolean))::int AS present_students
        FROM "AttendanceSession" s
        LEFT JOIN "AttendanceRecord" r ON r."attendanceSessionId" = s."id"
        WHERE ${cond}
        GROUP BY s."id"
      )
      SELECT ps."facultyId" AS "facultyId",
             (u."firstName" || ' ' || u."lastName") AS name,
             COUNT(*)::int AS sessions,
             SUM(ps."numberOfClasses")::int AS classes,
             MAX(ps."date") AS "lastDate",
             SUM(ps.present_students * ps."numberOfClasses")::int AS "presentWeighted",
             SUM(ps.total * ps."numberOfClasses")::int AS "totalWeighted"
      FROM per_session ps
      LEFT JOIN "Faculty" f ON f."id" = ps."facultyId"
      LEFT JOIN "User" u ON u."id" = f."userId"
      GROUP BY ps."facultyId", u."firstName", u."lastName"
      ORDER BY sessions DESC
    `),

    // Integer comparisons (present*100 < threshold*conducted) avoid float rounding at the boundary.
    prisma.$queryRaw<{ students: number; belowWarning: number; belowCritical: number; averagePct: number | string | null }[]>(Prisma.sql`
      WITH per_student AS (
        SELECT r."studentId", SUM(s."numberOfClasses")::int AS conducted, SUM(${present})::int AS present
        FROM "AttendanceRecord" r
        JOIN "AttendanceSession" s ON s."id" = r."attendanceSessionId"
        WHERE ${cond}
        GROUP BY r."studentId"
      )
      SELECT COUNT(*)::int AS students,
             COUNT(*) FILTER (WHERE present * 100 < ${policy.warningPercentage} * conducted)::int AS "belowWarning",
             COUNT(*) FILTER (WHERE present * 100 < ${policy.criticalPercentage} * conducted)::int AS "belowCritical",
             AVG(present * 100.0 / conducted)::float8 AS "averagePct"
      FROM per_student
      WHERE conducted > 0
    `),

    prisma.$queryRaw<{ studentId: string; rollNumber: string; name: string; conducted: number; present: number }[]>(Prisma.sql`
      WITH per_student AS (
        SELECT r."studentId", SUM(s."numberOfClasses")::int AS conducted, SUM(${present})::int AS present
        FROM "AttendanceRecord" r
        JOIN "AttendanceSession" s ON s."id" = r."attendanceSessionId"
        WHERE ${cond}
        GROUP BY r."studentId"
      )
      SELECT ps."studentId" AS "studentId", st."rollNumber" AS "rollNumber",
             (u."firstName" || ' ' || u."lastName") AS name, ps.conducted, ps.present
      FROM per_student ps
      JOIN "Student" st ON st."id" = ps."studentId"
      JOIN "User" u ON u."id" = st."userId"
      WHERE ps.conducted > 0 AND ps.present * 100 < ${policy.warningPercentage} * ps.conducted
      ORDER BY (ps.present * 1.0 / ps.conducted) ASC, st."rollNumber" ASC
      LIMIT ${page.limit} OFFSET ${page.offset}
    `),

    prisma.$queryRaw<{ total: number }[]>(Prisma.sql`
      WITH per_student AS (
        SELECT r."studentId", SUM(s."numberOfClasses")::int AS conducted, SUM(${present})::int AS present
        FROM "AttendanceRecord" r
        JOIN "AttendanceSession" s ON s."id" = r."attendanceSessionId"
        WHERE ${cond}
        GROUP BY r."studentId"
      )
      SELECT COUNT(*)::int AS total FROM per_student
      WHERE conducted > 0 AND present * 100 < ${policy.warningPercentage} * conducted
    `),
  ]);

  const o = overallRows[0] ?? { conducted: 0, present: 0, students: 0, sessions: 0 };
  const withPct = <T extends { conducted: number; present: number }>(r: T) => ({
    ...r,
    conducted: num(r.conducted),
    present: num(r.present),
    percentage: percentage(num(r.present), num(r.conducted)),
  });
  const sh = shortageRows[0];

  return {
    overall: {
      conducted: num(o.conducted),
      present: num(o.present),
      percentage: percentage(num(o.present), num(o.conducted)),
      students: num(o.students),
      sessions: num(o.sessions),
    },
    bySemester: semesterRows.map(withPct),
    bySection: sectionRows.map(withPct),
    bySubject: subjectRows.map(withPct),
    byFaculty: facultyRows.map((r) => ({
      facultyId: r.facultyId,
      name: r.name ?? "Unassigned",
      sessions: num(r.sessions),
      classes: num(r.classes),
      lastDate: r.lastDate ? r.lastDate.toISOString().slice(0, 10) : null,
      averagePercentage: num(r.totalWeighted) > 0 ? percentage(num(r.presentWeighted), num(r.totalWeighted)) : 0,
    })),
    shortage: {
      students: num(sh?.students),
      belowWarning: num(sh?.belowWarning),
      belowCritical: num(sh?.belowCritical),
      averageStudentPercentage: sh?.averagePct === null || sh?.averagePct === undefined ? 0 : Math.round(Number(sh.averagePct) * 10) / 10,
      thresholds: { warning: policy.warningPercentage, critical: policy.criticalPercentage },
      totalListed: num(listCount[0]?.total),
      list: listRows.map((r) => ({
        studentId: r.studentId,
        rollNumber: r.rollNumber,
        name: r.name,
        conducted: num(r.conducted),
        present: num(r.present),
        percentage: percentage(num(r.present), num(r.conducted)),
        critical: num(r.present) * 100 < policy.criticalPercentage * num(r.conducted),
      })),
    },
  };
}
