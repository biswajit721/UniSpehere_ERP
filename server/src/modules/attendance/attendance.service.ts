import { Prisma } from "@prisma/client";
import { prisma } from "../../config/db";
import { Actor, isAdminRole } from "../../utils/actor";
import { ApiError } from "../../utils/ApiError";
import { writeAudit } from "../../utils/audit";
import {
  formatDateOnly,
  isValidTime,
  parseDateOnly,
  percentage,
  timeToMinutes,
  todayDateOnly,
  weekdayCode,
} from "../../utils/dates";
import { assertCanAccessClass, canEditSession, getClassCatalog, sessionVisibilityFilter, teacherOfClass } from "./attendance.scope";
import { countsAsPresent, getPolicy, Policy } from "./attendance.stats";
import {
  EditAttendanceInput,
  HistoryQuery,
  RosterQuery,
  SubmitAttendanceInput,
} from "./attendance.validation";

// =============================================================================================
// Resolving and validating "the class being taught"
// =============================================================================================

interface ClassInput {
  academicSessionId: string;
  semesterId: string;
  departmentId: string;
  programId: string;
  sectionId: string;
  subjectId: string;
}

/**
 * Loads every entity in the chain and verifies each link with IDs (never names):
 *   department -> program -> semester -> section(batch) -> subject -> faculty authorization
 * Anything inconsistent is rejected with a specific message; nothing is "fixed up" silently.
 */
async function resolveClass(actor: Actor, input: ClassInput, opts: { requireActiveSession?: boolean } = {}) {
  const [session, semester, program, section, subject] = await Promise.all([
    prisma.academicSession.findUnique({ where: { id: input.academicSessionId } }),
    prisma.semester.findUnique({ where: { id: input.semesterId } }),
    prisma.program.findUnique({ where: { id: input.programId }, include: { department: true } }),
    prisma.section.findUnique({ where: { id: input.sectionId }, include: { batch: true } }),
    prisma.subject.findUnique({ where: { id: input.subjectId } }),
  ]);

  if (!session) throw ApiError.badRequest("The selected academic session does not exist.");
  if (opts.requireActiveSession && !session.isActive && !isAdminRole(actor.role)) {
    throw ApiError.badRequest(`Academic session ${session.label} is inactive.`);
  }
  if (!program || program.department.deletedAt) throw ApiError.badRequest("The selected program does not exist.");
  if (program.departmentId !== input.departmentId) {
    throw ApiError.badRequest("Program does not belong to the selected department.");
  }
  if (!semester) throw ApiError.badRequest("The selected semester does not exist.");
  if (semester.programId !== program.id) {
    throw ApiError.badRequest("Semester does not belong to the selected program.");
  }
  if (!section) throw ApiError.badRequest("The selected section does not exist.");
  if (section.batch.programId !== program.id) {
    throw ApiError.badRequest("Section does not belong to the selected program.");
  }
  if (!subject || subject.deletedAt) throw ApiError.badRequest("The selected subject does not exist.");
  if (!subject.programId || !subject.semesterId) {
    throw ApiError.badRequest("This subject is not linked to a program and semester yet. Ask the academic office to map it.");
  }
  if (subject.programId !== program.id || subject.semesterId !== semester.id) {
    throw ApiError.badRequest("Subject is not assigned to this semester.");
  }

  await assertCanAccessClass(actor, {
    academicSessionId: session.id,
    departmentId: program.departmentId,
    sectionId: section.id,
    subjectId: subject.id,
  });

  return { session, semester, program, department: program.department, section, subject };
}
type ResolvedClass = Awaited<ReturnType<typeof resolveClass>>;

/** Attendance date must be real, not in the future (unless allowed) and inside the session window. */
function validateDate(actor: Actor, session: ResolvedClass["session"], value: string, policy: Policy, allowOutside = false): Date {
  const date = parseDateOnly(value, "date");
  const today = parseDateOnly(todayDateOnly());

  if (date > today && !policy.allowFutureAttendance) {
    throw ApiError.badRequest("Attendance cannot be recorded for a future date.");
  }
  if (policy.enforceSessionDates && session.startDate && session.endDate) {
    const outside = date < session.startDate || date > session.endDate;
    if (outside && !(allowOutside && isAdminRole(actor.role))) {
      throw ApiError.badRequest(
        `Academic session does not match attendance date. ${value} is outside ${session.label} (${formatDateOnly(session.startDate)} to ${formatDateOnly(session.endDate)}).`
      );
    }
  }
  return date;
}

/** Maps the chosen starting period + number of classes onto the configured period grid. */
async function resolveSpan(startPeriod: number, numberOfClasses: number, startTime: string | undefined, endTime: string | undefined, policy: Policy) {
  if (numberOfClasses < 1 || numberOfClasses > policy.maxClassesPerSession) {
    throw ApiError.badRequest(`Number of classes must be between 1 and ${policy.maxClassesPerSession}.`);
  }
  const grid = await prisma.periodDefinition.findMany({ where: { isActive: true }, orderBy: { number: "asc" } });
  if (grid.length === 0) {
    throw ApiError.badRequest("No periods are configured yet. Ask an administrator to set up the period grid (Academics → Periods).");
  }
  const byNumber = new Map(grid.map((p) => [p.number, p]));
  const covered = [];
  for (let i = 0; i < numberOfClasses; i += 1) {
    const p = byNumber.get(startPeriod + i);
    if (!p) {
      throw ApiError.badRequest(
        i === 0
          ? `Period ${startPeriod} is not part of the period grid.`
          : `The period grid has no Period ${startPeriod + i}, so ${numberOfClasses} consecutive classes cannot start at Period ${startPeriod}.`
      );
    }
    covered.push(p);
  }

  const start = startTime ?? covered[0].startTime;
  const end = endTime ?? covered[covered.length - 1].endTime;
  if (!isValidTime(start) || !isValidTime(end) || timeToMinutes(end) <= timeToMinutes(start)) {
    throw ApiError.badRequest("End time must be after start time.");
  }

  return {
    startTime: start,
    endTime: end,
    periodNumbers: covered.map((p) => p.number),
    classes: covered.map((p, i) => ({ classNumber: i + 1, periodNumber: p.number, startTime: p.startTime, endTime: p.endTime })),
  };
}
type Span = Awaited<ReturnType<typeof resolveSpan>>;

/** Any submitted session occupying one of these periods for this section + subject + date. */
async function findExisting(sectionId: string, subjectId: string, date: Date, periodNumbers: number[]) {
  const slot = await prisma.attendanceSlot.findFirst({
    where: { sectionId, subjectId, date, periodNumber: { in: periodNumbers } },
    include: { attendanceSession: { include: { recordedBy: true } } },
  });
  if (!slot) return null;
  const s = slot.attendanceSession;
  return {
    id: s.id,
    status: s.status,
    period: s.period,
    numberOfClasses: s.numberOfClasses,
    submittedAt: s.createdAt.toISOString(),
    recordedBy: `${s.recordedBy.firstName} ${s.recordedBy.lastName}`,
  };
}

// =============================================================================================
// The roster: who is enrolled in this class ON THIS DATE
// =============================================================================================

export type RosterKind = "REGULAR" | "BACKLOG" | "ELECTIVE";
export interface RosterStudent {
  studentId: string;
  enrollmentId: string;
  rollNumber: string;
  registrationNumber: string;
  fullName: string;
  kind: RosterKind;
}

/**
 * Students whose enrollment covers `date` for this session + semester + section, plus students
 * registered for this subject as a BACKLOG or ELECTIVE. This is the ONLY place a class list is
 * built - loading and submitting share it, so what a teacher sees is exactly what is validated.
 * Temporal filtering means a student promoted last month is not on last month's class list twice,
 * and a student admitted on the 10th does not appear on the 5th.
 */
async function buildRoster(cls: ResolvedClass, date: Date): Promise<RosterStudent[]> {
  const activeOn: Prisma.StudentEnrollmentWhereInput = {
    admissionDate: { lte: date },
    OR: [{ endDate: null }, { endDate: { gte: date } }],
    student: { deletedAt: null },
  };
  const studentInclude = { student: { include: { user: true } } } as const;

  const [regular, registered] = await Promise.all([
    cls.subject.isElective
      ? Promise.resolve([])
      : prisma.studentEnrollment.findMany({
          where: {
            ...activeOn,
            academicSessionId: cls.session.id,
            semesterId: cls.semester.id,
            sectionId: cls.section.id,
          },
          include: studentInclude,
        }),
    prisma.studentSubjectRegistration.findMany({
      where: {
        subjectId: cls.subject.id,
        sectionId: cls.section.id,
        academicSessionId: cls.session.id,
        enrollment: activeOn,
      },
      include: { enrollment: { include: studentInclude } },
    }),
  ]);

  const rows = new Map<string, RosterStudent>();
  const toRow = (e: (typeof regular)[number], kind: RosterKind): RosterStudent => ({
    studentId: e.studentId,
    enrollmentId: e.id,
    rollNumber: e.student.rollNumber,
    registrationNumber: e.student.registrationNumber ?? e.student.user.universityId,
    fullName: `${e.student.user.firstName} ${e.student.user.lastName}`,
    kind,
  });
  for (const e of regular) rows.set(e.studentId, toRow(e, "REGULAR"));
  for (const r of registered) {
    if (!rows.has(r.enrollment.studentId)) rows.set(r.enrollment.studentId, toRow(r.enrollment, r.type));
  }

  return [...rows.values()].sort((a, b) => a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true }));
}

function describeClass(cls: ResolvedClass, date: Date, span: Span, numberOfClasses: number) {
  return {
    academicSession: { id: cls.session.id, label: cls.session.label },
    semester: { id: cls.semester.id, number: cls.semester.number, name: cls.semester.name },
    department: { id: cls.department.id, name: cls.department.name },
    program: { id: cls.program.id, name: cls.program.name },
    section: { id: cls.section.id, name: cls.section.name, batchLabel: cls.section.batch.label },
    subject: { id: cls.subject.id, code: cls.subject.code, name: cls.subject.name },
    date: formatDateOnly(date),
    period: span.periodNumbers[0],
    numberOfClasses,
    startTime: span.startTime,
    endTime: span.endTime,
    classes: span.classes,
  };
}

const fullName = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`;

// =============================================================================================
// Service
// =============================================================================================

export const attendanceService = {
  // ------------------------------------------------------------------------------- policy
  getPolicy,

  // ------------------------------------------------------------------------------- cascading options
  async options(
    actor: Actor,
    q: {
      level: "semesters" | "departments" | "programs" | "sections" | "subjects" | "periods";
      academicSessionId?: string;
      semesterNumber?: number;
      semesterId?: string;
      departmentId?: string;
      programId?: string;
      sectionId?: string;
      subjectId?: string;
      date?: string;
    }
  ) {
    const need = (cond: unknown, what: string) => {
      if (!cond) throw ApiError.badRequest(`${what} is required.`);
    };
    need(q.academicSessionId, "Academic session");

    if (q.level === "periods") {
      need(q.sectionId, "Section");
      need(q.subjectId, "Subject");
      need(q.date, "Date");
      return this.periodOptions(actor, q as Required<Pick<typeof q, "academicSessionId" | "sectionId" | "subjectId" | "date">>);
    }

    const catalog = await getClassCatalog(actor, q.academicSessionId!);

    switch (q.level) {
      case "semesters": {
        const seen = new Map<number, string>();
        for (const c of catalog) seen.set(c.semesterNumber, c.semesterName);
        return { options: [...seen.entries()].sort((a, b) => a[0] - b[0]).map(([number, name]) => ({ number, name })) };
      }
      case "departments": {
        need(q.semesterNumber, "Semester");
        const seen = new Map<string, string>();
        for (const c of catalog) if (c.semesterNumber === q.semesterNumber) seen.set(c.departmentId, c.departmentName);
        return { options: [...seen.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)) };
      }
      case "programs": {
        need(q.semesterNumber, "Semester");
        need(q.departmentId, "Department");
        const seen = new Map<string, { id: string; name: string; semesterId: string }>();
        for (const c of catalog) {
          if (c.semesterNumber === q.semesterNumber && c.departmentId === q.departmentId) {
            seen.set(c.programId, { id: c.programId, name: c.programName, semesterId: c.semesterId });
          }
        }
        return { options: [...seen.values()].sort((a, b) => a.name.localeCompare(b.name)) };
      }
      case "sections": {
        need(q.semesterId, "Semester");
        need(q.programId, "Program");
        const seen = new Map<string, { id: string; name: string; batchId: string; batchLabel: string }>();
        for (const c of catalog) {
          if (c.semesterId === q.semesterId && c.programId === q.programId) {
            seen.set(c.sectionId, { id: c.sectionId, name: c.sectionName, batchId: c.batchId, batchLabel: c.batchLabel });
          }
        }
        return { options: [...seen.values()].sort((a, b) => a.batchLabel.localeCompare(b.batchLabel) || a.name.localeCompare(b.name)) };
      }
      default: {
        need(q.semesterId, "Semester");
        need(q.sectionId, "Section");
        const seen = new Map<string, { id: string; code: string; name: string; isElective: boolean }>();
        for (const c of catalog) {
          if (c.semesterId === q.semesterId && c.sectionId === q.sectionId) {
            seen.set(c.subjectId, { id: c.subjectId, code: c.subjectCode, name: c.subjectName, isElective: c.isElective });
          }
        }
        return { options: [...seen.values()].sort((a, b) => a.name.localeCompare(b.name)) };
      }
    }
  },

  /**
   * The period grid for one class on one date, flagged with what the timetable schedules and
   * what has already been taken. A teacher may still pick any grid period manually.
   */
  async periodOptions(actor: Actor, q: { academicSessionId: string; sectionId: string; subjectId: string; date: string }) {
    const [section, subject, grid] = await Promise.all([
      prisma.section.findUnique({ where: { id: q.sectionId }, include: { batch: { include: { program: true } } } }),
      prisma.subject.findUnique({ where: { id: q.subjectId } }),
      prisma.periodDefinition.findMany({ where: { isActive: true }, orderBy: { number: "asc" } }),
    ]);
    if (!section || !subject) throw ApiError.badRequest("The selected class does not exist.");
    await assertCanAccessClass(actor, {
      academicSessionId: q.academicSessionId,
      departmentId: section.batch.program.departmentId,
      sectionId: section.id,
      subjectId: subject.id,
    });

    const date = parseDateOnly(q.date, "date");
    const day = weekdayCode(date);
    const [timetable, taken] = await Promise.all([
      day === "SUN"
        ? Promise.resolve([])
        : prisma.timetableSlot.findMany({
            where: { sectionId: q.sectionId, subjectId: q.subjectId, dayOfWeek: day },
            include: { faculty: { include: { user: true } } },
          }),
      prisma.attendanceSlot.findMany({ where: { sectionId: q.sectionId, subjectId: q.subjectId, date }, select: { periodNumber: true } }),
    ]);
    const takenSet = new Set(taken.map((t) => t.periodNumber));

    const periods = grid.map((p) => {
      const slot = timetable.find((t) => t.startTime <= p.startTime && t.endTime >= p.endTime);
      let scheduledClasses: number | null = null;
      if (slot) {
        const inside = grid.filter((g) => slot.startTime <= g.startTime && slot.endTime >= g.endTime);
        if (inside[0]?.number === p.number) scheduledClasses = inside.length;
      }
      return {
        number: p.number,
        label: p.label ?? `Period ${p.number}`,
        startTime: p.startTime,
        endTime: p.endTime,
        scheduled: Boolean(slot),
        scheduledClasses,
        scheduledFaculty: slot ? fullName(slot.faculty.user) : null,
        room: slot?.room ?? null,
        taken: takenSet.has(p.number),
      };
    });

    return { gridConfigured: grid.length > 0, hasTimetable: timetable.length > 0, periods };
  },

  // ------------------------------------------------------------------------------- roster
  async roster(actor: Actor, q: RosterQuery) {
    const policy = await getPolicy();
    const cls = await resolveClass(actor, q, { requireActiveSession: true });
    const date = validateDate(actor, cls.session, q.date, policy, q.allowOutsideSession === "true");
    const span = await resolveSpan(q.period, q.numberOfClasses, q.startTime, q.endTime, policy);

    const existing = await findExisting(cls.section.id, cls.subject.id, date, span.periodNumbers);
    const students = existing ? [] : await buildRoster(cls, date);
    if (!existing && students.length === 0) {
      throw ApiError.notFound("No active students found for the selected class.");
    }

    return {
      class: describeClass(cls, date, span, q.numberOfClasses),
      existing,
      defaultStatus: policy.defaultStatusPresent ? "PRESENT" : "ABSENT",
      total: students.length,
      students,
    };
  },

  // ------------------------------------------------------------------------------- submit
  async submit(actor: Actor, input: SubmitAttendanceInput, ipAddress?: string) {
    const policy = await getPolicy();
    const cls = await resolveClass(actor, input, { requireActiveSession: true });
    const date = validateDate(actor, cls.session, input.date, policy, input.allowOutsideSession === true);
    const span = await resolveSpan(input.period, input.numberOfClasses, input.startTime, input.endTime, policy);

    const roster = await buildRoster(cls, date);
    if (roster.length === 0) throw ApiError.notFound("No active students found for the selected class.");
    const rosterById = new Map(roster.map((r) => [r.studentId, r]));

    // The payload must cover the class list exactly: no strangers, no duplicates, nobody left out.
    const seen = new Set<string>();
    for (const rec of input.records) {
      if (!rosterById.has(rec.studentId)) {
        throw ApiError.badRequest("Some students are not enrolled in this class. Reload the student list and try again.");
      }
      if (seen.has(rec.studentId)) throw ApiError.badRequest("A student appears more than once in the attendance list.");
      seen.add(rec.studentId);
    }
    const missing = roster.length - seen.size;
    if (missing > 0) {
      throw ApiError.badRequest(
        `Attendance must be recorded for every student in the class (${missing} missing). Reload the student list and try again.`
      );
    }

    const teacher =
      actor.scope === "ASSIGNED"
        ? actor.facultyId
        : (await teacherOfClass({ academicSessionId: cls.session.id, subjectId: cls.subject.id, sectionId: cls.section.id })) ?? actor.facultyId;

    let created;
    try {
      created = await prisma.attendanceSession.create({
        data: {
          academicSessionId: cls.session.id,
          semester: cls.semester.number,
          semesterId: cls.semester.id,
          departmentId: cls.department.id,
          programId: cls.program.id,
          sectionId: cls.section.id,
          subjectId: cls.subject.id,
          facultyId: teacher,
          recordedById: actor.userId,
          date,
          period: span.periodNumbers[0],
          numberOfClasses: input.numberOfClasses,
          startTime: span.startTime,
          endTime: span.endTime,
          remarks: input.remarks,
          status: "SUBMITTED",
          records: {
            create: input.records.map((r) => ({
              studentId: r.studentId,
              enrollmentId: rosterById.get(r.studentId)!.enrollmentId,
              status: r.status,
              remarks: r.remarks,
              markedById: actor.userId,
            })),
          },
          slots: {
            create: span.periodNumbers.map((n) => ({
              sectionId: cls.section.id,
              subjectId: cls.subject.id,
              date,
              periodNumber: n,
            })),
          },
        },
      });
    } catch (err) {
      // Two people submitting the same class at the same moment: the database key decides who wins.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const existing = await findExisting(cls.section.id, cls.subject.id, date, span.periodNumbers);
        throw ApiError.conflict("Attendance has already been submitted for this class.", { attendanceId: existing?.id ?? null });
      }
      throw err;
    }

    const present = input.records.filter((r) => countsAsPresent(r.status, policy.countExcusedAsPresent)).length;
    const total = input.records.length;

    await writeAudit({
      userId: actor.userId,
      action: "ATTENDANCE_CREATED",
      module: "attendance",
      ipAddress,
      metadata: {
        role: actor.role,
        attendanceSessionId: created.id,
        academicSessionId: cls.session.id,
        semesterId: cls.semester.id,
        sectionId: cls.section.id,
        subjectId: cls.subject.id,
        date: formatDateOnly(date),
        period: span.periodNumbers[0],
        numberOfClasses: input.numberOfClasses,
        total,
        present,
      },
    });

    return {
      id: created.id,
      date: formatDateOnly(date),
      period: span.periodNumbers[0],
      numberOfClasses: input.numberOfClasses,
      startTime: span.startTime,
      endTime: span.endTime,
      subject: { id: cls.subject.id, code: cls.subject.code, name: cls.subject.name },
      section: { id: cls.section.id, name: cls.section.name, batchLabel: cls.section.batch.label },
      total,
      present,
      absent: total - present,
      percentage: percentage(present, total),
    };
  },

  // ------------------------------------------------------------------------------- view one session
  async getSession(actor: Actor, id: string) {
    const [session, policy] = await Promise.all([
      prisma.attendanceSession.findUnique({
        where: { id },
        include: {
          academicSession: true,
          semesterRef: true,
          department: true,
          program: true,
          section: { include: { batch: true } },
          subject: true,
          faculty: { include: { user: true } },
          recordedBy: true,
          cancelledBy: true,
          records: {
            include: {
              student: { include: { user: true } },
              edits: { include: { editedBy: true }, orderBy: { createdAt: "asc" } },
            },
          },
        },
      }),
      getPolicy(),
    ]);
    if (!session) throw ApiError.notFound("Attendance record not found");

    // Visibility: admins/principal see everything, HOD their department, faculty their own classes.
    if (actor.scope === "SELF") throw ApiError.forbidden("Students cannot open class attendance sheets.");
    if (actor.scope === "DEPARTMENT" && session.departmentId !== actor.departmentId) {
      throw ApiError.forbidden("This class belongs to another department.");
    }
    if (actor.scope === "ASSIGNED") {
      const mine = session.facultyId === actor.facultyId || session.recordedById === actor.userId;
      if (!mine) {
        await assertCanAccessClass(
          actor,
          {
            academicSessionId: session.academicSessionId,
            departmentId: session.departmentId ?? "",
            sectionId: session.sectionId,
            subjectId: session.subjectId,
          },
          "view"
        );
      }
    }

    const today = parseDateOnly(todayDateOnly());
    const editDecision = canEditSession(actor, session, policy, today);
    const canEdit = session.status === "SUBMITTED" && editDecision.allowed;
    const canCancel = session.status === "SUBMITTED" && (isAdminRole(actor.role) || (actor.scope === "DEPARTMENT" && session.departmentId === actor.departmentId));

    const records = session.records
      .map((r) => ({
        recordId: r.id,
        studentId: r.studentId,
        rollNumber: r.student.rollNumber,
        registrationNumber: r.student.registrationNumber ?? r.student.user.universityId,
        fullName: fullName(r.student.user),
        status: r.status,
        remarks: r.remarks,
        edits: r.edits.map((e) => ({
          previousStatus: e.previousStatus,
          newStatus: e.newStatus,
          editedBy: fullName(e.editedBy),
          reason: e.reason,
          at: e.createdAt.toISOString(),
        })),
      }))
      .sort((a, b) => a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true }));

    const present = records.filter((r) => countsAsPresent(r.status, policy.countExcusedAsPresent)).length;

    return {
      id: session.id,
      status: session.status,
      date: formatDateOnly(session.date),
      period: session.period,
      numberOfClasses: session.numberOfClasses,
      startTime: session.startTime,
      endTime: session.endTime,
      remarks: session.remarks,
      academicSession: { id: session.academicSessionId, label: session.academicSession.label },
      semester: { id: session.semesterId, number: session.semester, name: session.semesterRef?.name ?? `Semester ${session.semester}` },
      department: session.department ? { id: session.department.id, name: session.department.name } : null,
      program: session.program ? { id: session.program.id, name: session.program.name } : null,
      section: { id: session.sectionId, name: session.section.name, batchLabel: session.section.batch.label },
      subject: { id: session.subjectId, code: session.subject.code, name: session.subject.name },
      faculty: session.faculty ? fullName(session.faculty.user) : null,
      recordedBy: fullName(session.recordedBy),
      createdAt: session.createdAt.toISOString(),
      cancelled: session.status === "CANCELLED"
        ? { by: session.cancelledBy ? fullName(session.cancelledBy) : null, at: session.cancelledAt?.toISOString() ?? null, reason: session.cancelReason }
        : null,
      totals: { total: records.length, present, absent: records.length - present, percentage: percentage(present, records.length) },
      permissions: {
        canEdit,
        canCancel,
        editBlockedReason: canEdit || session.status !== "SUBMITTED" ? null : editDecision.reason ?? null,
      },
      records,
    };
  },

  // ------------------------------------------------------------------------------- edit
  async edit(actor: Actor, id: string, input: EditAttendanceInput, ipAddress?: string) {
    const policy = await getPolicy();
    const session = await prisma.attendanceSession.findUnique({ where: { id }, include: { records: true } });
    if (!session) throw ApiError.notFound("Attendance record not found");
    if (session.status !== "SUBMITTED") throw ApiError.conflict("Cancelled attendance cannot be edited.");

    const today = parseDateOnly(todayDateOnly());
    const decision = canEditSession(actor, session, policy, today);
    if (!decision.allowed) throw ApiError.forbidden(decision.reason ?? "You cannot edit this attendance.");

    const byId = new Map(session.records.map((r) => [r.id, r]));
    const seen = new Set<string>();
    const effective: { record: (typeof session.records)[number]; status: (typeof input.changes)[number]["status"]; remarks: string | null | undefined }[] = [];
    for (const c of input.changes) {
      const record = byId.get(c.recordId);
      if (!record) throw ApiError.badRequest("One of the records does not belong to this attendance sheet.");
      if (seen.has(c.recordId)) throw ApiError.badRequest("A record appears more than once in the changes.");
      seen.add(c.recordId);
      const statusChanged = record.status !== c.status;
      const remarksChanged = c.remarks !== undefined && (c.remarks ?? null) !== (record.remarks ?? null);
      if (statusChanged || remarksChanged) effective.push({ record, status: c.status, remarks: c.remarks });
    }
    if (effective.length === 0) throw ApiError.badRequest("No changes to save.");

    await prisma.$transaction(async (tx) => {
      for (const e of effective) {
        await tx.attendanceRecord.update({
          where: { id: e.record.id },
          data: { status: e.status, ...(e.remarks !== undefined && { remarks: e.remarks }) },
        });
        if (e.record.status !== e.status) {
          await tx.attendanceEdit.create({
            data: {
              recordId: e.record.id,
              previousStatus: e.record.status,
              newStatus: e.status,
              editedById: actor.userId,
              reason: input.reason,
            },
          });
        }
      }
    });

    const statusChanges = effective.filter((e) => e.record.status !== e.status);
    await writeAudit({
      userId: actor.userId,
      action: "ATTENDANCE_UPDATED",
      module: "attendance",
      ipAddress,
      metadata: {
        role: actor.role,
        attendanceSessionId: id,
        reason: input.reason,
        previous: effective.map((e) => ({ recordId: e.record.id, studentId: e.record.studentId, status: e.record.status, remarks: e.record.remarks })),
        next: effective.map((e) => ({ recordId: e.record.id, studentId: e.record.studentId, status: e.status, remarks: e.remarks ?? e.record.remarks })),
      },
    });

    return { attendanceId: id, recordsUpdated: effective.length, statusChanges: statusChanges.length };
  },

  // ------------------------------------------------------------------------------- cancel
  async cancel(actor: Actor, id: string, reason: string, ipAddress?: string) {
    const session = await prisma.attendanceSession.findUnique({ where: { id } });
    if (!session) throw ApiError.notFound("Attendance record not found");
    if (session.status === "CANCELLED") throw ApiError.conflict("This attendance has already been cancelled.");

    const allowed = isAdminRole(actor.role) || (actor.scope === "DEPARTMENT" && session.departmentId === actor.departmentId);
    if (!allowed) throw ApiError.forbidden("Only the HOD of the department or an administrator can cancel attendance.");

    await prisma.$transaction(async (tx) => {
      await tx.attendanceSession.update({
        where: { id },
        data: { status: "CANCELLED", cancelledById: actor.userId, cancelledAt: new Date(), cancelReason: reason },
      });
      // Releasing the slots lets the class be recorded again correctly.
      await tx.attendanceSlot.deleteMany({ where: { attendanceSessionId: id } });
    });

    await writeAudit({
      userId: actor.userId,
      action: "ATTENDANCE_CANCELLED",
      module: "attendance",
      ipAddress,
      metadata: { role: actor.role, attendanceSessionId: id, reason },
    });
    return { attendanceId: id, status: "CANCELLED" as const };
  },

  // ------------------------------------------------------------------------------- history list
  async history(actor: Actor, q: HistoryQuery) {
    if (actor.scope === "SELF") throw ApiError.forbidden("Students cannot browse class attendance sheets.");
    const policy = await getPolicy();
    const today = parseDateOnly(todayDateOnly());

    const filters: Prisma.AttendanceSessionWhereInput = {
      ...(q.academicSessionId && { academicSessionId: q.academicSessionId }),
      ...(q.semesterId && { semesterId: q.semesterId }),
      ...(q.programId && { programId: q.programId }),
      ...(q.sectionId && { sectionId: q.sectionId }),
      ...(q.subjectId && { subjectId: q.subjectId }),
      ...(q.facultyId && actor.scope !== "ASSIGNED" && { facultyId: q.facultyId }),
      ...(q.includeCancelled !== "true" && { status: "SUBMITTED" as const }),
      ...((q.from || q.to) && {
        date: {
          ...(q.from && { gte: parseDateOnly(q.from, "from") }),
          ...(q.to && { lte: parseDateOnly(q.to, "to") }),
        },
      }),
    };
    const where: Prisma.AttendanceSessionWhereInput = { AND: [sessionVisibilityFilter(actor), filters] };

    const [total, rows] = await Promise.all([
      prisma.attendanceSession.count({ where }),
      prisma.attendanceSession.findMany({
        where,
        include: {
          academicSession: true,
          semesterRef: true,
          program: true,
          section: { include: { batch: true } },
          subject: true,
          faculty: { include: { user: true } },
          recordedBy: true,
        },
        orderBy: [{ date: "desc" }, { period: "desc" }, { createdAt: "desc" }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);

    const counts = rows.length
      ? await prisma.attendanceRecord.groupBy({
          by: ["attendanceSessionId", "status"],
          where: { attendanceSessionId: { in: rows.map((r) => r.id) } },
          _count: { _all: true },
        })
      : [];
    const totals = new Map<string, { total: number; present: number }>();
    for (const c of counts) {
      const t = totals.get(c.attendanceSessionId) ?? { total: 0, present: 0 };
      t.total += c._count._all;
      if (countsAsPresent(c.status, policy.countExcusedAsPresent)) t.present += c._count._all;
      totals.set(c.attendanceSessionId, t);
    }

    return {
      total,
      page: q.page,
      pageSize: q.pageSize,
      data: rows.map((s) => {
        const t = totals.get(s.id) ?? { total: 0, present: 0 };
        return {
          id: s.id,
          status: s.status,
          date: formatDateOnly(s.date),
          period: s.period,
          numberOfClasses: s.numberOfClasses,
          startTime: s.startTime,
          endTime: s.endTime,
          academicSession: { id: s.academicSessionId, label: s.academicSession.label },
          semester: { id: s.semesterId, number: s.semester, name: s.semesterRef?.name ?? `Semester ${s.semester}` },
          program: s.program ? { id: s.program.id, name: s.program.name } : null,
          section: { id: s.sectionId, name: s.section.name, batchLabel: s.section.batch.label },
          subject: { id: s.subjectId, code: s.subject.code, name: s.subject.name },
          faculty: s.faculty ? fullName(s.faculty.user) : null,
          recordedBy: fullName(s.recordedBy),
          total: t.total,
          present: t.present,
          absent: t.total - t.present,
          percentage: percentage(t.present, t.total),
          canEdit: s.status === "SUBMITTED" && canEditSession(actor, s, policy, today).allowed,
          createdAt: s.createdAt.toISOString(),
        };
      }),
    };
  },
};
