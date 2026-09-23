import { Prisma } from "@prisma/client";
import { prisma } from "../../config/db";
import { Actor, assertDepartmentAccess } from "../../utils/actor";
import { ApiError } from "../../utils/ApiError";
import { writeAudit } from "../../utils/audit";
import { formatDateOnly, isValidTime, parseDateOnly, timeToMinutes } from "../../utils/dates";
import { AssignmentRow, academicsRepository, SubjectRow } from "./academics.repository";

// ---------------------------------------------------------------- DTO mappers
function subjectDto(s: SubjectRow) {
  return {
    id: s.id,
    name: s.name,
    code: s.code,
    credits: s.credits,
    semester: s.semester,
    type: s.type,
    isElective: s.isElective,
    department: s.department.name,
    departmentId: s.departmentId,
    programId: s.programId,
    program: s.program?.name ?? null,
    semesterId: s.semesterId,
    semesterName: s.semesterRef?.name ?? null,
    facultyName: s.faculty ? `${s.faculty.user.firstName} ${s.faculty.user.lastName}` : null,
    facultyId: s.facultyId,
    // Unmapped subjects (legacy rows) are hidden from attendance until an admin links them.
    isMapped: Boolean(s.programId && s.semesterId),
  };
}

export function sessionDto(s: {
  id: string;
  label: string;
  startYear: number;
  endYear: number;
  startDate: Date | null;
  endDate: Date | null;
  isCurrent: boolean;
  isActive: boolean;
}) {
  return {
    id: s.id,
    label: s.label,
    startYear: s.startYear,
    endYear: s.endYear,
    startDate: s.startDate ? formatDateOnly(s.startDate) : null,
    endDate: s.endDate ? formatDateOnly(s.endDate) : null,
    isCurrent: s.isCurrent,
    isActive: s.isActive,
  };
}

function assignmentDto(a: AssignmentRow) {
  return {
    id: a.id,
    academicSession: { id: a.academicSessionId, label: a.academicSession.label },
    subject: { id: a.subjectId, code: a.subject.code, name: a.subject.name },
    program: a.subject.program ? { id: a.subject.program.id, name: a.subject.program.name } : null,
    semester: a.subject.semesterRef
      ? { id: a.subject.semesterRef.id, number: a.subject.semesterRef.number, name: a.subject.semesterRef.name }
      : null,
    section: { id: a.sectionId, name: a.section.name, batchLabel: a.section.batch.label },
    faculty: {
      id: a.facultyId,
      fullName: `${a.faculty.user.firstName} ${a.faculty.user.lastName}`,
      employeeId: a.faculty.employeeId,
    },
  };
}

/** Resolves + validates the program/semester pair a subject is being attached to. */
async function resolveSubjectPlacement(programId: string, semesterId: string) {
  const program = await prisma.program.findUnique({ where: { id: programId }, include: { department: true } });
  if (!program || program.department.deletedAt) throw ApiError.badRequest("The selected program does not exist.");
  const semester = await prisma.semester.findUnique({ where: { id: semesterId } });
  if (!semester) throw ApiError.badRequest("The selected semester does not exist.");
  if (semester.programId !== programId) {
    throw ApiError.badRequest("The semester does not belong to the selected program.");
  }
  return { program, semester };
}

async function assertFacultyExists(facultyId: string) {
  const faculty = await prisma.faculty.findUnique({ where: { id: facultyId } });
  if (!faculty || faculty.deletedAt) throw ApiError.badRequest("The selected faculty member does not exist.");
  return faculty;
}

export const academicsService = {
  // ================================================================ subjects
  async listSubjects(params: {
    departmentId?: string;
    programId?: string;
    semesterId?: string;
    semester?: number;
    facultyId?: string;
    unmapped?: boolean;
  }) {
    const rows = await academicsRepository.listSubjects(params);
    return rows.map(subjectDto);
  },

  async createSubject(
    actor: Actor,
    input: {
      name: string;
      code: string;
      credits: number;
      programId: string;
      semesterId: string;
      type: "THEORY" | "PRACTICAL";
      isElective: boolean;
      facultyId?: string;
    }
  ) {
    const { program, semester } = await resolveSubjectPlacement(input.programId, input.semesterId);
    assertDepartmentAccess(actor, program.departmentId, "subjects");

    if (await academicsRepository.findSubjectByCode(input.code)) {
      throw ApiError.conflict("A subject with this code already exists");
    }
    if (input.facultyId) await assertFacultyExists(input.facultyId);

    const subject = await academicsRepository.createSubject({
      name: input.name,
      code: input.code,
      credits: input.credits,
      type: input.type,
      isElective: input.isElective,
      departmentId: program.departmentId,
      programId: program.id,
      semesterId: semester.id,
      semester: semester.number, // kept in sync for older readers
      facultyId: input.facultyId,
    });
    return subjectDto(subject);
  },

  async updateSubject(
    actor: Actor,
    id: string,
    data: {
      name?: string;
      credits?: number;
      type?: "THEORY" | "PRACTICAL";
      isElective?: boolean;
      facultyId?: string | null;
      programId?: string;
      semesterId?: string;
    }
  ) {
    const existing = await academicsRepository.findSubject(id);
    if (!existing || existing.deletedAt) throw ApiError.notFound("Subject not found");
    assertDepartmentAccess(actor, existing.departmentId, "subjects");

    const patch: Prisma.SubjectUncheckedUpdateInput = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.credits !== undefined) patch.credits = data.credits;
    if (data.type !== undefined) patch.type = data.type;
    if (data.isElective !== undefined) patch.isElective = data.isElective;
    if (data.facultyId !== undefined) {
      if (data.facultyId) await assertFacultyExists(data.facultyId);
      patch.facultyId = data.facultyId;
    }

    if (data.programId || data.semesterId) {
      const targetProgramId = data.programId ?? existing.programId;
      if (!targetProgramId) throw ApiError.badRequest("Choose the program this subject belongs to.");
      if (existing.programId && data.programId && data.programId !== existing.programId) {
        throw ApiError.badRequest("A subject cannot move to a different program. Create a new subject instead.");
      }
      const targetSemesterId = data.semesterId ?? existing.semesterId;
      if (!targetSemesterId) throw ApiError.badRequest("Choose the semester this subject is taught in.");
      const { program, semester } = await resolveSubjectPlacement(targetProgramId, targetSemesterId);
      if (program.departmentId !== existing.departmentId) {
        throw ApiError.badRequest("The program belongs to a different department than this subject.");
      }
      patch.programId = program.id;
      patch.semesterId = semester.id;
      patch.semester = semester.number;
    }

    const subject = await academicsRepository.updateSubject(id, patch);
    return subjectDto(subject);
  },

  async removeSubject(actor: Actor, id: string) {
    const subject = await academicsRepository.findSubject(id);
    if (!subject || subject.deletedAt) throw ApiError.notFound("Subject not found");
    assertDepartmentAccess(actor, subject.departmentId, "subjects");
    await academicsRepository.softDeleteSubject(id);
  },

  // ================================================================ academic sessions
  async listSessions(activeOnly: boolean) {
    const rows = await academicsRepository.listSessions(activeOnly);
    return rows.map(sessionDto);
  },

  async createSession(
    actor: Actor,
    input: {
      label?: string;
      startYear: number;
      endYear: number;
      startDate: string;
      endDate: string;
      isCurrent: boolean;
      isActive: boolean;
    }
  ) {
    const label = input.label ?? `${input.startYear}-${input.endYear}`;
    if (await academicsRepository.findSessionByLabel(label)) {
      throw ApiError.conflict(`An academic session named ${label} already exists.`);
    }
    if (input.isCurrent && !input.isActive) {
      throw ApiError.badRequest("The current session must be active.");
    }
    const start = parseDateOnly(input.startDate, "startDate");
    const end = parseDateOnly(input.endDate, "endDate");
    const overlap = await academicsRepository.findOverlappingSession(start, end);
    if (overlap) {
      throw ApiError.conflict(`These dates overlap with academic session ${overlap.label}.`);
    }

    const created = await prisma.$transaction(async (tx) => {
      if (input.isCurrent) await tx.academicSession.updateMany({ where: { isCurrent: true }, data: { isCurrent: false } });
      return tx.academicSession.create({
        data: {
          label,
          startYear: input.startYear,
          endYear: input.endYear,
          startDate: start,
          endDate: end,
          isCurrent: input.isCurrent,
          isActive: input.isActive,
        },
      });
    });

    await writeAudit({ userId: actor.userId, action: "CREATE_ACADEMIC_SESSION", module: "academics", metadata: { sessionId: created.id, label } });
    return sessionDto(created);
  },

  async updateSession(
    actor: Actor,
    id: string,
    data: { label?: string; startDate?: string; endDate?: string; isCurrent?: boolean; isActive?: boolean }
  ) {
    const existing = await academicsRepository.findSession(id);
    if (!existing) throw ApiError.notFound("Academic session not found");

    const nextActive = data.isActive ?? existing.isActive;
    const nextCurrent = data.isCurrent ?? existing.isCurrent;
    if (nextCurrent && !nextActive) throw ApiError.badRequest("The current session must be active.");

    if (data.label && data.label !== existing.label) {
      const clash = await academicsRepository.findSessionByLabel(data.label);
      if (clash) throw ApiError.conflict(`An academic session named ${data.label} already exists.`);
    }

    const start = data.startDate ? parseDateOnly(data.startDate, "startDate") : existing.startDate;
    const end = data.endDate ? parseDateOnly(data.endDate, "endDate") : existing.endDate;
    if (start && end) {
      if (end <= start) throw ApiError.badRequest("End date must be after start date.");
      const overlap = await academicsRepository.findOverlappingSession(start, end, id);
      if (overlap) throw ApiError.conflict(`These dates overlap with academic session ${overlap.label}.`);
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (data.isCurrent === true) {
        await tx.academicSession.updateMany({ where: { isCurrent: true, id: { not: id } }, data: { isCurrent: false } });
      }
      return tx.academicSession.update({
        where: { id },
        data: {
          ...(data.label !== undefined && { label: data.label }),
          ...(data.startDate !== undefined && { startDate: start }),
          ...(data.endDate !== undefined && { endDate: end }),
          ...(data.isCurrent !== undefined && { isCurrent: data.isCurrent }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
      });
    });

    await writeAudit({ userId: actor.userId, action: "UPDATE_ACADEMIC_SESSION", module: "academics", metadata: { sessionId: id, changes: data } });
    return sessionDto(updated);
  },

  // ================================================================ semesters & periods
  async listSemesters(programId?: string) {
    const rows = await academicsRepository.listSemesters(programId);
    return rows.map((s) => ({ id: s.id, programId: s.programId, number: s.number, name: s.name }));
  },

  async listPeriods() {
    const rows = await academicsRepository.listPeriods();
    return rows.map((p) => ({
      id: p.id,
      number: p.number,
      label: p.label ?? `Period ${p.number}`,
      startTime: p.startTime,
      endTime: p.endTime,
      isActive: p.isActive,
    }));
  },

  /**
   * Replaces the whole period grid. Historical attendance keeps its own start/end times, so
   * editing the grid never changes what was recorded in the past.
   */
  async replacePeriods(
    actor: Actor,
    periods: { number: number; label?: string | null; startTime: string; endTime: string; isActive: boolean }[]
  ) {
    const numbers = new Set<number>();
    for (const p of periods) {
      if (numbers.has(p.number)) throw ApiError.badRequest(`Period ${p.number} appears more than once.`);
      numbers.add(p.number);
      if (!isValidTime(p.startTime) || !isValidTime(p.endTime)) throw ApiError.badRequest("Times must be HH:MM.");
      if (timeToMinutes(p.endTime) <= timeToMinutes(p.startTime)) {
        throw ApiError.badRequest(`Period ${p.number}: end time must be after start time.`);
      }
    }
    const ordered = [...periods].filter((p) => p.isActive).sort((a, b) => a.number - b.number);
    for (let i = 1; i < ordered.length; i += 1) {
      if (timeToMinutes(ordered[i].startTime) < timeToMinutes(ordered[i - 1].endTime)) {
        throw ApiError.badRequest(`Period ${ordered[i].number} starts before period ${ordered[i - 1].number} ends.`);
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.periodDefinition.deleteMany({ where: { number: { notIn: [...numbers] } } });
      for (const p of periods) {
        await tx.periodDefinition.upsert({
          where: { number: p.number },
          update: { label: p.label ?? null, startTime: p.startTime, endTime: p.endTime, isActive: p.isActive },
          create: { number: p.number, label: p.label ?? null, startTime: p.startTime, endTime: p.endTime, isActive: p.isActive },
        });
      }
    });

    await writeAudit({ userId: actor.userId, action: "REPLACE_PERIOD_GRID", module: "academics", metadata: { periods } });
    return this.listPeriods();
  },

  // ================================================================ faculty assignments
  async listAssignments(
    actor: Actor,
    filters: {
      academicSessionId?: string;
      programId?: string;
      semesterId?: string;
      sectionId?: string;
      subjectId?: string;
      facultyId?: string;
    }
  ) {
    if (actor.scope === "SELF") throw ApiError.forbidden("Students cannot view faculty assignments.");

    const where: Prisma.FacultySubjectAssignmentWhereInput = {
      ...(filters.academicSessionId && { academicSessionId: filters.academicSessionId }),
      ...(filters.sectionId && { sectionId: filters.sectionId }),
      ...(filters.subjectId && { subjectId: filters.subjectId }),
      subject: {
        ...(filters.programId && { programId: filters.programId }),
        ...(filters.semesterId && { semesterId: filters.semesterId }),
        ...(actor.scope === "DEPARTMENT" && { departmentId: actor.departmentId! }),
      },
    };
    // A faculty member only ever sees their own assignments; everyone else may filter freely.
    if (actor.scope === "ASSIGNED") where.facultyId = actor.facultyId!;
    else if (filters.facultyId) where.facultyId = filters.facultyId;

    const rows = await academicsRepository.listAssignments(where);
    return rows.map(assignmentDto);
  },

  async createAssignment(
    actor: Actor,
    input: { academicSessionId: string; subjectId: string; sectionId: string; facultyId: string }
  ) {
    const session = await academicsRepository.findSession(input.academicSessionId);
    if (!session) throw ApiError.badRequest("The selected academic session does not exist.");
    if (!session.isActive) throw ApiError.badRequest(`Academic session ${session.label} is inactive.`);

    const subject = await academicsRepository.findSubject(input.subjectId);
    if (!subject || subject.deletedAt) throw ApiError.badRequest("The selected subject does not exist.");
    if (!subject.programId || !subject.semesterId) {
      throw ApiError.badRequest("This subject is not linked to a program and semester yet. Link it on the Subjects tab first.");
    }
    assertDepartmentAccess(actor, subject.departmentId, "faculty assignments");

    const section = await prisma.section.findUnique({ where: { id: input.sectionId }, include: { batch: true } });
    if (!section) throw ApiError.badRequest("The selected section does not exist.");
    if (section.batch.programId !== subject.programId) {
      throw ApiError.badRequest("The section and the subject belong to different programs.");
    }
    await assertFacultyExists(input.facultyId);

    try {
      const created = await academicsRepository.createAssignment({ ...input, createdById: actor.userId });
      await writeAudit({ userId: actor.userId, action: "CREATE_FACULTY_ASSIGNMENT", module: "academics", metadata: { assignmentId: created.id, ...input } });
      return assignmentDto(created);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw ApiError.conflict("This faculty member is already assigned to that subject and section for the session.");
      }
      throw err;
    }
  },

  async deleteAssignment(actor: Actor, id: string) {
    const assignment = await academicsRepository.findAssignment(id);
    if (!assignment) throw ApiError.notFound("Assignment not found");
    assertDepartmentAccess(actor, assignment.subject.departmentId, "faculty assignments");
    await academicsRepository.deleteAssignment(id);
    await writeAudit({ userId: actor.userId, action: "DELETE_FACULTY_ASSIGNMENT", module: "academics", metadata: { assignmentId: id } });
  },
};
