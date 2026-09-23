import { Prisma } from "@prisma/client";
import { prisma } from "../../config/db";
import { Actor, isAdminRole } from "../../utils/actor";
import { ApiError } from "../../utils/ApiError";

/**
 * A "class" is one subject taught to one section in one academic session:
 * (session, semester, program, department, section, subject).
 * The catalog below is the ONLY source for the attendance dropdowns, and the same rules are
 * re-applied to every roster load and every submission, so a hand-crafted request cannot reach
 * a combination the academic structure does not contain.
 */
export interface ClassOption {
  sectionId: string;
  sectionName: string;
  batchId: string;
  batchLabel: string;
  programId: string;
  programName: string;
  departmentId: string;
  departmentName: string;
  semesterId: string;
  semesterNumber: number;
  semesterName: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  isElective: boolean;
}

/**
 * Section-level assignments override the subject's default faculty:
 *   - if ANY FacultySubjectAssignment exists for (session, subject, section) only those people teach it;
 *   - otherwise the subject's default faculty (Subject.facultyId) does.
 */
export async function isFacultyAuthorizedForClass(
  facultyId: string,
  params: { academicSessionId: string; subjectId: string; sectionId: string }
): Promise<boolean> {
  // Pick the three key fields explicitly: callers pass richer objects (with departmentId etc.) and
  // forwarding them straight into the query would be an invalid Prisma filter.
  const where = { academicSessionId: params.academicSessionId, subjectId: params.subjectId, sectionId: params.sectionId };
  const assignments = await prisma.facultySubjectAssignment.findMany({ where, select: { facultyId: true } });
  if (assignments.length > 0) return assignments.some((a) => a.facultyId === facultyId);
  const subject = await prisma.subject.findUnique({ where: { id: params.subjectId }, select: { facultyId: true } });
  return subject?.facultyId === facultyId;
}

/** The person(s) responsible for a class - used to stamp AttendanceSession.facultyId. */
export async function teacherOfClass(params: {
  academicSessionId: string;
  subjectId: string;
  sectionId: string;
}): Promise<string | null> {
  const where = { academicSessionId: params.academicSessionId, subjectId: params.subjectId, sectionId: params.sectionId };
  const assignments = await prisma.facultySubjectAssignment.findMany({
    where,
    select: { facultyId: true },
    orderBy: { createdAt: "asc" },
  });
  if (assignments.length > 0) return assignments[0].facultyId;
  const subject = await prisma.subject.findUnique({ where: { id: params.subjectId }, select: { facultyId: true } });
  return subject?.facultyId ?? null;
}

/**
 * Throws unless the actor may take/view attendance for this exact class.
 * `departmentId` is the department of the PROGRAM the section belongs to (the students' department).
 */
export async function assertCanAccessClass(
  actor: Actor,
  cls: { academicSessionId: string; departmentId: string; sectionId: string; subjectId: string },
  verb = "take attendance for"
) {
  switch (actor.scope) {
    case "ALL":
      return;
    case "DEPARTMENT":
      if (actor.departmentId === cls.departmentId) return;
      throw ApiError.forbidden(`You can only ${verb} classes in your own department.`);
    case "ASSIGNED": {
      const ok = await isFacultyAuthorizedForClass(actor.facultyId!, cls);
      if (ok) return;
      throw ApiError.forbidden("Faculty is not assigned to this subject for the selected section.");
    }
    default:
      throw ApiError.forbidden("Students cannot record attendance.");
  }
}

/**
 * Every class the actor may take attendance for in the given session, restricted to sections that
 * actually have students enrolled at that semester. Small (dozens of rows), so it is computed in
 * memory and filtered per dropdown level.
 */
export async function getClassCatalog(actor: Actor, academicSessionId: string): Promise<ClassOption[]> {
  if (actor.scope === "SELF") throw ApiError.forbidden("Students cannot record attendance.");

  // 1. Which (section, semester) groups have enrolled students in this session?
  const groups = await prisma.studentEnrollment.groupBy({
    by: ["sectionId", "semesterId", "programId", "departmentId", "batchId"],
    where: {
      academicSessionId,
      sectionId: { not: null },
      ...(actor.scope === "DEPARTMENT" && { departmentId: actor.departmentId! }),
    },
  });
  if (groups.length === 0) return [];

  const sectionIds = [...new Set(groups.map((g) => g.sectionId!))];
  const semesterIds = [...new Set(groups.map((g) => g.semesterId))];
  const programIds = [...new Set(groups.map((g) => g.programId))];
  const departmentIds = [...new Set(groups.map((g) => g.departmentId))];

  const [sections, semesters, programs, departments, subjects] = await Promise.all([
    prisma.section.findMany({ where: { id: { in: sectionIds } }, include: { batch: true } }),
    prisma.semester.findMany({ where: { id: { in: semesterIds } } }),
    prisma.program.findMany({ where: { id: { in: programIds } } }),
    prisma.department.findMany({ where: { id: { in: departmentIds }, deletedAt: null } }),
    prisma.subject.findMany({
      where: { deletedAt: null, semesterId: { in: semesterIds }, programId: { in: programIds } },
    }),
  ]);
  const sectionById = new Map(sections.map((s) => [s.id, s]));
  const semesterById = new Map(semesters.map((s) => [s.id, s]));
  const programById = new Map(programs.map((p) => [p.id, p]));
  const departmentById = new Map(departments.map((d) => [d.id, d]));

  // An elective is only "a class" in sections where students have registered for it.
  const electiveRegistrations = await prisma.studentSubjectRegistration.groupBy({
    by: ["subjectId", "sectionId"],
    where: { academicSessionId, type: "ELECTIVE", sectionId: { in: sectionIds } },
  });
  const electiveOffered = new Set(electiveRegistrations.map((r) => `${r.sectionId}:${r.subjectId}`));

  // 2. Faculty authorization data (only needed for ASSIGNED scope)
  let assignmentsByClass: Map<string, Set<string>> | null = null;
  if (actor.scope === "ASSIGNED") {
    const assignments = await prisma.facultySubjectAssignment.findMany({
      where: { academicSessionId, sectionId: { in: sectionIds } },
      select: { sectionId: true, subjectId: true, facultyId: true },
    });
    assignmentsByClass = new Map();
    for (const a of assignments) {
      const key = `${a.sectionId}:${a.subjectId}`;
      if (!assignmentsByClass.has(key)) assignmentsByClass.set(key, new Set());
      assignmentsByClass.get(key)!.add(a.facultyId);
    }
  }

  const options: ClassOption[] = [];
  for (const g of groups) {
    const section = sectionById.get(g.sectionId!);
    const semester = semesterById.get(g.semesterId);
    const program = programById.get(g.programId);
    const department = departmentById.get(g.departmentId);
    if (!section || !semester || !program || !department) continue;

    for (const subject of subjects) {
      if (subject.semesterId !== g.semesterId || subject.programId !== g.programId) continue;
      if (subject.isElective && !electiveOffered.has(`${section.id}:${subject.id}`)) continue;

      if (actor.scope === "ASSIGNED") {
        const assigned = assignmentsByClass!.get(`${section.id}:${subject.id}`);
        const allowed = assigned && assigned.size > 0 ? assigned.has(actor.facultyId!) : subject.facultyId === actor.facultyId;
        if (!allowed) continue;
      }

      options.push({
        sectionId: section.id,
        sectionName: section.name,
        batchId: section.batchId,
        batchLabel: section.batch.label,
        programId: program.id,
        programName: program.name,
        departmentId: department.id,
        departmentName: department.name,
        semesterId: semester.id,
        semesterNumber: semester.number,
        semesterName: semester.name,
        subjectId: subject.id,
        subjectCode: subject.code,
        subjectName: subject.name,
        isElective: subject.isElective,
      });
    }
  }

  return options.sort(
    (a, b) =>
      a.semesterNumber - b.semesterNumber ||
      a.departmentName.localeCompare(b.departmentName) ||
      a.programName.localeCompare(b.programName) ||
      a.batchLabel.localeCompare(b.batchLabel) ||
      a.sectionName.localeCompare(b.sectionName) ||
      a.subjectName.localeCompare(b.subjectName)
  );
}

/** Whether the actor may correct an already-submitted session (the service enforces this on PUT). */
export function canEditSession(
  actor: Actor,
  session: { departmentId: string | null; recordedById: string; facultyId: string | null; date: Date },
  policy: { facultyEditWindowDays: number },
  today: Date
): { allowed: boolean; reason?: string } {
  if (isAdminRole(actor.role)) return { allowed: true };

  if (actor.scope === "DEPARTMENT") {
    return session.departmentId === actor.departmentId
      ? { allowed: true }
      : { allowed: false, reason: "This class belongs to another department." };
  }

  if (actor.scope === "ASSIGNED") {
    const mine = session.facultyId === actor.facultyId || session.recordedById === actor.userId;
    if (!mine) return { allowed: false, reason: "Only the faculty member who teaches this class can edit it." };
    const ageDays = Math.round((today.getTime() - session.date.getTime()) / 86_400_000);
    if (ageDays > policy.facultyEditWindowDays) {
      return {
        allowed: false,
        reason: `Faculty can correct attendance for ${policy.facultyEditWindowDays} days after the class. Ask your HOD to make this change.`,
      };
    }
    return { allowed: true };
  }

  return { allowed: false, reason: "You do not have permission to edit attendance." };
}

/** Prisma filter limiting AttendanceSession queries to what the actor is allowed to see. */
export function sessionVisibilityFilter(actor: Actor): Prisma.AttendanceSessionWhereInput {
  switch (actor.scope) {
    case "ALL":
      return {};
    case "DEPARTMENT":
      return { departmentId: actor.departmentId! };
    case "ASSIGNED":
      return { OR: [{ facultyId: actor.facultyId! }, { recordedById: actor.userId }] };
    default:
      return { id: "__none__" };
  }
}
