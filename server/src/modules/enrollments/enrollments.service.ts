import { EnrollmentStatus, Prisma } from "@prisma/client";
import { prisma } from "../../config/db";
import { Actor } from "../../utils/actor";
import { ApiError } from "../../utils/ApiError";
import { writeAudit } from "../../utils/audit";
import { addDays, formatDateOnly, parseDateOnly, todayDateOnly } from "../../utils/dates";
import { Db, resolvePlacement } from "../academics/academics.helpers";

const enrollmentInclude = {
  academicSession: true,
  department: true,
  program: true,
  batch: true,
  semester: true,
  section: true,
  subjectRegistrations: {
    include: { subject: true, section: { include: { batch: true } } },
    orderBy: { createdAt: "asc" as const },
  },
} satisfies Prisma.StudentEnrollmentInclude;

export type EnrollmentRow = Prisma.StudentEnrollmentGetPayload<{ include: typeof enrollmentInclude }>;

export function enrollmentDto(e: EnrollmentRow) {
  return {
    id: e.id,
    studentId: e.studentId,
    academicSession: { id: e.academicSessionId, label: e.academicSession.label },
    department: { id: e.departmentId, name: e.department.name },
    program: { id: e.programId, name: e.program.name },
    batch: { id: e.batchId, label: e.batch.label },
    semester: { id: e.semesterId, number: e.semester.number, name: e.semester.name },
    section: e.section ? { id: e.section.id, name: e.section.name } : null,
    admissionYear: e.admissionYear,
    admissionDate: formatDateOnly(e.admissionDate),
    endDate: e.endDate ? formatDateOnly(e.endDate) : null,
    isCurrent: e.endDate === null,
    enrollmentType: e.enrollmentType,
    status: e.status,
    readmissionReason: e.readmissionReason,
    reasonNote: e.reasonNote,
    previousEnrollmentId: e.previousEnrollmentId,
    createdAt: e.createdAt.toISOString(),
    subjectRegistrations: e.subjectRegistrations.map((r) => ({
      id: r.id,
      type: r.type,
      subject: { id: r.subjectId, code: r.subject.code, name: r.subject.name, semester: r.subject.semester },
      section: { id: r.sectionId, name: r.section.name, batchLabel: r.section.batch.label },
    })),
  };
}

/** Wording the UI shows for the outcome of each closed enrollment. */
const effectiveDateOrToday = (value?: string) => parseDateOnly(value ?? todayDateOnly(), "effectiveDate");

/** The student's master row mirrors their open enrollment so older modules keep working. */
async function mirrorToStudent(
  db: Db,
  e: { studentId: string; departmentId: string; programId: string; batchId: string; sectionId: string | null },
  semesterNumber: number
) {
  await db.student.update({
    where: { id: e.studentId },
    data: {
      departmentId: e.departmentId,
      programId: e.programId,
      batchId: e.batchId,
      sectionId: e.sectionId,
      currentSemester: semesterNumber,
    },
  });
}

async function requireOpenEnrollment(db: Db, studentId: string) {
  const student = await db.student.findUnique({ where: { id: studentId } });
  if (!student || student.deletedAt) throw ApiError.notFound("Student not found");
  const current = await db.studentEnrollment.findFirst({
    where: { studentId, endDate: null },
    include: { semester: true, academicSession: true },
  });
  if (!current) {
    throw ApiError.badRequest("This student has no open enrollment. Use Readmit to enrol them again.");
  }
  return current;
}

/** Ends an enrollment the day before `effective`, so two enrollments never cover the same date. */
async function closeEnrollment(
  db: Db,
  current: { id: string; admissionDate: Date },
  status: EnrollmentStatus,
  effective: Date
) {
  const endDate = addDays(effective, -1);
  if (endDate < current.admissionDate) {
    throw ApiError.badRequest(
      `The effective date must be after the current enrollment began on ${formatDateOnly(current.admissionDate)}.`
    );
  }
  await db.studentEnrollment.update({ where: { id: current.id }, data: { status, endDate } });
}

function translate(err: unknown): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    throw ApiError.conflict("This student's enrollment was changed by someone else a moment ago. Refresh and try again.");
  }
  throw err;
}

export const enrollmentsService = {
  // ================================================================ registration
  /**
   * First enrollment of a newly registered student. Runs inside the registration transaction
   * so a student can never exist without a consistent academic placement.
   */
  async createInitialEnrollment(
    tx: Prisma.TransactionClient,
    input: {
      studentId: string;
      academicSessionId: string;
      departmentId: string;
      programId: string;
      batchId: string;
      semesterId: string;
      sectionId?: string | null;
      enrollmentType: "REGULAR" | "LATERAL";
      admissionYear?: number;
      admissionDate?: string;
      createdById?: string;
    }
  ) {
    const { session, semester } = await resolvePlacement(tx, input);

    if (input.enrollmentType === "REGULAR" && semester.number !== 1) {
      throw ApiError.badRequest("A regular admission starts in Semester 1. Choose Lateral entry to admit a student into a later semester.");
    }
    if (input.enrollmentType === "LATERAL" && semester.number === 1) {
      throw ApiError.badRequest("Lateral entry places a student after Semester 1. Choose Regular admission for Semester 1.");
    }

    const admissionDate = effectiveDateOrToday(input.admissionDate);
    if (session.endDate && admissionDate > session.endDate) {
      throw ApiError.badRequest(`The admission date is after academic session ${session.label} ended.`);
    }

    const created = await tx.studentEnrollment.create({
      data: {
        studentId: input.studentId,
        academicSessionId: session.id,
        departmentId: input.departmentId,
        programId: input.programId,
        batchId: input.batchId,
        semesterId: semester.id,
        sectionId: input.sectionId ?? null,
        admissionYear: input.admissionYear ?? session.startYear,
        admissionDate,
        enrollmentType: input.enrollmentType,
        status: "ACTIVE",
        createdById: input.createdById,
      },
      include: enrollmentInclude,
    });

    await mirrorToStudent(tx, created, semester.number);
    await tx.student.update({
      where: { id: input.studentId },
      data: { admissionYear: created.admissionYear },
    });
    return created;
  },

  // ================================================================ history
  async history(studentId: string) {
    const rows = await prisma.studentEnrollment.findMany({
      where: { studentId },
      include: enrollmentInclude,
      orderBy: [{ admissionDate: "desc" }, { createdAt: "desc" }],
    });
    return rows.map(enrollmentDto);
  },

  // ================================================================ promotion
  async promote(
    actor: Actor,
    studentId: string,
    input: {
      academicSessionId: string;
      semesterId: string;
      batchId?: string;
      sectionId?: string | null;
      effectiveDate?: string;
      reasonNote?: string;
    }
  ) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const current = await requireOpenEnrollment(tx, studentId);
        const placement = await resolvePlacement(tx, {
          academicSessionId: input.academicSessionId,
          departmentId: current.departmentId,
          programId: current.programId,
          batchId: input.batchId ?? current.batchId,
          semesterId: input.semesterId,
          sectionId: input.sectionId ?? null,
        });

        if (placement.semester.number <= current.semester.number) {
          throw ApiError.badRequest(
            `Promotion must move the student beyond ${current.semester.name}. Use Readmit / Repeat to repeat a semester.`
          );
        }
        if (placement.session.startYear < current.academicSession.startYear) {
          throw ApiError.badRequest("The new academic session cannot be earlier than the current one.");
        }

        const effective = effectiveDateOrToday(input.effectiveDate);
        await closeEnrollment(tx, current, "PROMOTED", effective);

        const created = await tx.studentEnrollment.create({
          data: {
            studentId,
            academicSessionId: placement.session.id,
            departmentId: current.departmentId,
            programId: current.programId,
            batchId: placement.batch.id,
            semesterId: placement.semester.id,
            sectionId: placement.section?.id ?? null,
            admissionYear: placement.session.startYear,
            admissionDate: effective,
            enrollmentType: "PROMOTION",
            status: "ACTIVE",
            reasonNote: input.reasonNote,
            previousEnrollmentId: current.id,
            createdById: actor.userId,
          },
          include: enrollmentInclude,
        });
        await mirrorToStudent(tx, created, placement.semester.number);
        return { created, from: current };
      });

      await writeAudit({
        userId: actor.userId,
        action: "PROMOTE_STUDENT",
        module: "enrollments",
        metadata: { studentId, fromEnrollmentId: result.from.id, toEnrollmentId: result.created.id },
      });
      return enrollmentDto(result.created);
    } catch (err) {
      return translate(err);
    }
  },

  // ================================================================ readmission / repeat
  async readmit(
    actor: Actor,
    studentId: string,
    input: {
      enrollmentType: "READMISSION" | "REPEAT";
      academicSessionId: string;
      semesterId: string;
      batchId: string;
      sectionId?: string | null;
      readmissionReason: "BACKLOG" | "ACADEMIC_REPEAT" | "OTHER";
      reasonNote?: string;
      admissionYear?: number;
      effectiveDate?: string;
    }
  ) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const student = await tx.student.findUnique({ where: { id: studentId } });
        if (!student || student.deletedAt) throw ApiError.notFound("Student not found");

        const open = await tx.studentEnrollment.findFirst({
          where: { studentId, endDate: null },
          include: { semester: true, academicSession: true },
        });
        const latest =
          open ??
          (await tx.studentEnrollment.findFirst({
            where: { studentId },
            orderBy: [{ admissionDate: "desc" }, { createdAt: "desc" }],
            include: { semester: true, academicSession: true },
          }));
        if (!latest) throw ApiError.badRequest("This student has no enrollment history to readmit from.");

        const placement = await resolvePlacement(tx, {
          academicSessionId: input.academicSessionId,
          departmentId: latest.departmentId,
          programId: latest.programId,
          batchId: input.batchId,
          semesterId: input.semesterId,
          sectionId: input.sectionId ?? null,
        });

        if (placement.session.startYear < latest.academicSession.startYear) {
          throw ApiError.badRequest("The readmission session cannot be earlier than the student's last enrollment.");
        }
        if (open && open.academicSessionId === placement.session.id && open.semesterId === placement.semester.id) {
          throw ApiError.badRequest("The student is already enrolled in this semester for this session. Use Change section instead.");
        }

        const effective = effectiveDateOrToday(input.effectiveDate);
        if (open) await closeEnrollment(tx, open, "REPEATED", effective);
        else if (effective <= latest.admissionDate) {
          throw ApiError.badRequest("The effective date must be after the student's previous enrollment began.");
        }

        const created = await tx.studentEnrollment.create({
          data: {
            studentId,
            academicSessionId: placement.session.id,
            departmentId: latest.departmentId,
            programId: latest.programId,
            batchId: placement.batch.id,
            semesterId: placement.semester.id,
            sectionId: placement.section?.id ?? null,
            admissionYear: input.admissionYear ?? placement.session.startYear,
            admissionDate: effective,
            enrollmentType: input.enrollmentType,
            status: "ACTIVE",
            readmissionReason: input.readmissionReason,
            reasonNote: input.reasonNote,
            previousEnrollmentId: latest.id,
            createdById: actor.userId,
          },
          include: enrollmentInclude,
        });
        await mirrorToStudent(tx, created, placement.semester.number);
        return { created, from: latest };
      });

      await writeAudit({
        userId: actor.userId,
        action: input.enrollmentType === "REPEAT" ? "REPEAT_SEMESTER" : "READMIT_STUDENT",
        module: "enrollments",
        metadata: { studentId, fromEnrollmentId: result.from.id, toEnrollmentId: result.created.id, reason: input.readmissionReason },
      });
      return enrollmentDto(result.created);
    } catch (err) {
      return translate(err);
    }
  },

  // ================================================================ section / batch / program change
  async transfer(
    actor: Actor,
    studentId: string,
    input: {
      departmentId?: string;
      programId?: string;
      batchId?: string;
      semesterId?: string;
      sectionId?: string | null;
      effectiveDate?: string;
      reasonNote: string;
    }
  ) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const current = await requireOpenEnrollment(tx, studentId);

        const departmentId = input.departmentId ?? current.departmentId;
        const programId = input.programId ?? current.programId;
        const programChanged = programId !== current.programId;
        const batchId = input.batchId ?? (programChanged ? undefined : current.batchId);
        if (!batchId) throw ApiError.badRequest("Choose the batch in the new program.");
        const semesterId = input.semesterId ?? (programChanged ? undefined : current.semesterId);
        if (!semesterId) throw ApiError.badRequest("Choose the semester in the new program.");
        const batchChanged = batchId !== current.batchId;
        const sectionId = input.sectionId !== undefined ? input.sectionId : batchChanged ? null : current.sectionId;

        if (
          departmentId === current.departmentId &&
          programId === current.programId &&
          batchId === current.batchId &&
          semesterId === current.semesterId &&
          sectionId === current.sectionId
        ) {
          throw ApiError.badRequest("Nothing to change - the student is already placed there.");
        }

        const placement = await resolvePlacement(tx, {
          academicSessionId: current.academicSessionId,
          departmentId,
          programId,
          batchId,
          semesterId,
          sectionId,
        });

        const effective = effectiveDateOrToday(input.effectiveDate);
        await closeEnrollment(tx, current, "TRANSFERRED", effective);

        const created = await tx.studentEnrollment.create({
          data: {
            studentId,
            academicSessionId: current.academicSessionId,
            departmentId,
            programId,
            batchId: placement.batch.id,
            semesterId: placement.semester.id,
            sectionId: placement.section?.id ?? null,
            admissionYear: current.admissionYear,
            admissionDate: effective,
            enrollmentType: "TRANSFER",
            status: "ACTIVE",
            reasonNote: input.reasonNote,
            previousEnrollmentId: current.id,
            createdById: actor.userId,
          },
          include: enrollmentInclude,
        });
        await mirrorToStudent(tx, created, placement.semester.number);
        return { created, from: current };
      });

      await writeAudit({
        userId: actor.userId,
        action: "TRANSFER_STUDENT",
        module: "enrollments",
        metadata: { studentId, fromEnrollmentId: result.from.id, toEnrollmentId: result.created.id, reason: input.reasonNote },
      });
      return enrollmentDto(result.created);
    } catch (err) {
      return translate(err);
    }
  },

  // ================================================================ defer / withdraw / detain / complete
  async close(
    actor: Actor,
    studentId: string,
    input: { status: "DEFERRED" | "WITHDRAWN" | "DETAINED" | "COMPLETED"; effectiveDate?: string; reasonNote?: string }
  ) {
    const updated = await prisma.$transaction(async (tx) => {
      const current = await requireOpenEnrollment(tx, studentId);
      const effective = effectiveDateOrToday(input.effectiveDate);
      await closeEnrollment(tx, current, input.status, effective);
      if (input.reasonNote) {
        await tx.studentEnrollment.update({ where: { id: current.id }, data: { reasonNote: input.reasonNote } });
      }
      return tx.studentEnrollment.findUniqueOrThrow({ where: { id: current.id }, include: enrollmentInclude });
    });

    await writeAudit({
      userId: actor.userId,
      action: `ENROLLMENT_${input.status}`,
      module: "enrollments",
      metadata: { studentId, enrollmentId: updated.id, reason: input.reasonNote },
    });
    return enrollmentDto(updated);
  },

  // ================================================================ backlog & elective registrations
  async registerSubject(
    actor: Actor,
    studentId: string,
    input: { subjectId: string; sectionId: string; type: "BACKLOG" | "ELECTIVE" }
  ) {
    const current = await requireOpenEnrollment(prisma, studentId);

    const subject = await prisma.subject.findUnique({ where: { id: input.subjectId }, include: { semesterRef: true } });
    if (!subject || subject.deletedAt || !subject.programId || !subject.semesterRef) {
      throw ApiError.badRequest("That subject is not available for registration.");
    }
    if (subject.programId !== current.programId) {
      throw ApiError.badRequest("The subject belongs to a different program than the student's.");
    }
    if (input.type === "BACKLOG" && subject.semesterRef.number >= current.semester.number) {
      throw ApiError.badRequest("A backlog subject must come from an earlier semester than the student's current one.");
    }
    if (input.type === "ELECTIVE") {
      if (!subject.isElective) throw ApiError.badRequest("That subject is not marked as an elective.");
      if (subject.semesterRef.number !== current.semester.number) {
        throw ApiError.badRequest("An elective must belong to the student's current semester.");
      }
    }

    const section = await prisma.section.findUnique({ where: { id: input.sectionId }, include: { batch: true } });
    if (!section) throw ApiError.badRequest("The selected section does not exist.");
    if (section.batch.programId !== subject.programId) {
      throw ApiError.badRequest("The section belongs to a different program than the subject.");
    }

    try {
      const created = await prisma.studentSubjectRegistration.create({
        data: {
          enrollmentId: current.id,
          subjectId: subject.id,
          sectionId: section.id,
          academicSessionId: current.academicSessionId,
          type: input.type,
        },
      });
      await writeAudit({
        userId: actor.userId,
        action: "REGISTER_SUBJECT",
        module: "enrollments",
        metadata: { studentId, registrationId: created.id, subjectId: subject.id, type: input.type },
      });
      return created;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw ApiError.conflict("The student is already registered for that subject.");
      }
      throw err;
    }
  },

  async removeSubjectRegistration(actor: Actor, registrationId: string) {
    const reg = await prisma.studentSubjectRegistration.findUnique({
      where: { id: registrationId },
      include: { enrollment: true },
    });
    if (!reg) throw ApiError.notFound("Registration not found");

    const used = await prisma.attendanceRecord.count({
      where: { enrollmentId: reg.enrollmentId, attendanceSession: { subjectId: reg.subjectId, sectionId: reg.sectionId } },
    });
    if (used > 0) {
      throw ApiError.conflict("Attendance has already been recorded for this subject, so the registration cannot be removed.");
    }
    await prisma.studentSubjectRegistration.delete({ where: { id: registrationId } });
    await writeAudit({
      userId: actor.userId,
      action: "REMOVE_SUBJECT_REGISTRATION",
      module: "enrollments",
      metadata: { studentId: reg.enrollment.studentId, registrationId },
    });
  },
};
