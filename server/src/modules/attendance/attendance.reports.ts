import { prisma } from "../../config/db";
import { Actor } from "../../utils/actor";
import { ApiError } from "../../utils/ApiError";
import { formatDateOnly, parseDateOnly, percentage, todayDateOnly } from "../../utils/dates";
import { assertCanViewStudent } from "../../utils/studentAccess";
import {
  bucketsForStudent,
  computeShortage,
  countsAsPresent,
  departmentAnalytics,
  getPolicy,
  groupedForStudent,
  statusFor,
  StatFilters,
  subjectStatsForStudent,
  totalsForStudent,
} from "./attendance.stats";
import { DepartmentReportQuery, StudentReportQuery } from "./attendance.validation";

export const attendanceReports = {
  /**
   * Everything the student attendance screen needs, for one student and one lens:
   * summary (overview + subject table), daily, weekly, monthly, yearly, semester, or session.
   * Access is checked here - a student can only ever ask for themselves.
   */
  async studentReport(user: { userId: string; roleName: string }, studentId: string, q: StudentReportQuery) {
    await assertCanViewStudent(user, studentId);

    const [policy, student] = await Promise.all([
      getPolicy(),
      prisma.student.findUniqueOrThrow({
        where: { id: studentId },
        include: {
          user: true,
          department: true,
          program: true,
          enrollments: { where: { endDate: null }, include: { academicSession: true, semester: true }, take: 1 },
        },
      }),
    ]);

    const filters: StatFilters = {
      academicSessionId: q.academicSessionId,
      semesterId: q.semesterId,
      from: q.from,
      to: q.to,
    };

    const totals = await totalsForStudent(studentId, filters, policy);
    const info = computeShortage(totals.present, totals.conducted, policy.minimumPercentage);
    const enrollment = student.enrollments[0] ?? null;

    const result: Record<string, unknown> = {
      student: {
        id: student.id,
        fullName: `${student.user.firstName} ${student.user.lastName}`,
        rollNumber: student.rollNumber,
        registrationNumber: student.registrationNumber ?? student.user.universityId,
        department: student.department.name,
        program: student.program.name,
        currentSemester: enrollment?.semester.name ?? `Semester ${student.currentSemester}`,
        academicSession: enrollment?.academicSession.label ?? null,
      },
      view: q.view,
      filters: { academicSessionId: q.academicSessionId ?? null, semesterId: q.semesterId ?? null, from: q.from ?? null, to: q.to ?? null },
      overview: {
        totalClasses: totals.conducted,
        present: totals.present,
        absent: totals.absent,
        percentage: totals.percentage,
        minimumRequired: policy.minimumPercentage,
        status: statusFor(totals.percentage, policy),
        hasShortage: info.hasShortage,
        classesNeededToRecover: info.classesNeededToRecover,
        classesCanMiss: info.classesCanMiss,
        ifAttendNext: info.ifAttendNext,
        ifMissNext: info.ifMissNext,
      },
    };

    if (q.view === "summary") {
      const rows = await subjectStatsForStudent(studentId, filters, policy);
      const [subjects, registrations] = await Promise.all([
        prisma.subject.findMany({ where: { id: { in: rows.map((r) => r.subjectId) } } }),
        prisma.studentSubjectRegistration.findMany({
          where: { enrollment: { studentId }, subjectId: { in: rows.map((r) => r.subjectId) } },
          select: { subjectId: true, type: true },
        }),
      ]);
      const subjectById = new Map(subjects.map((s) => [s.id, s]));
      const regType = new Map(registrations.map((r) => [r.subjectId, r.type]));

      result.subjects = rows
        .map((r) => {
          const subject = subjectById.get(r.subjectId);
          const pct = percentage(r.present, r.conducted);
          const sh = computeShortage(r.present, r.conducted, policy.minimumPercentage);
          return {
            subjectId: r.subjectId,
            subject: subject?.name ?? "Unknown subject",
            code: subject?.code ?? "",
            registrationType: regType.get(r.subjectId) ?? "REGULAR",
            conducted: r.conducted,
            present: r.present,
            absent: r.conducted - r.present,
            percentage: pct,
            status: statusFor(pct, policy),
            classesNeededToRecover: sh.classesNeededToRecover,
          };
        })
        .sort((a, b) => a.subject.localeCompare(b.subject));
    } else if (q.view === "daily") {
      const date = q.date ?? todayDateOnly();
      const records = await prisma.attendanceRecord.findMany({
        where: { studentId, attendanceSession: { date: parseDateOnly(date, "date"), status: "SUBMITTED" } },
        include: { attendanceSession: { include: { subject: true } } },
        orderBy: { attendanceSession: { period: "asc" } },
      });
      let conducted = 0;
      let present = 0;
      const periods = records.map((r) => {
        const s = r.attendanceSession;
        const attended = countsAsPresent(r.status, policy.countExcusedAsPresent);
        conducted += s.numberOfClasses;
        if (attended) present += s.numberOfClasses;
        return {
          period: s.period,
          numberOfClasses: s.numberOfClasses,
          startTime: s.startTime,
          endTime: s.endTime,
          subject: s.subject.name,
          status: r.status,
        };
      });
      result.daily = { date, periods, conducted, present, absent: conducted - present, percentage: percentage(present, conducted) };
    } else if (q.view === "weekly" || q.view === "monthly" || q.view === "yearly") {
      const unit = q.view === "weekly" ? "week" : q.view === "monthly" ? "month" : "year";
      result.series = await bucketsForStudent(studentId, unit, filters, policy);
    } else {
      result.series = await groupedForStudent(studentId, q.view === "semester" ? "semester" : "session", filters, policy);
    }

    return result;
  },

  /** HOD / admin analytics - every figure is aggregated in SQL. */
  async departmentReport(actor: Actor, q: DepartmentReportQuery) {
    if (actor.scope === "SELF" || actor.scope === "ASSIGNED") {
      throw ApiError.forbidden("Department analytics are available to HODs and administrators.");
    }

    let departmentId = q.departmentId;
    if (actor.scope === "DEPARTMENT") {
      if (departmentId && departmentId !== actor.departmentId) {
        throw ApiError.forbidden("You can only view analytics for your own department.");
      }
      departmentId = actor.departmentId!;
    }

    const policy = await getPolicy();
    const analytics = await departmentAnalytics(
      { departmentId, academicSessionId: q.academicSessionId, programId: q.programId, semesterId: q.semesterId },
      policy,
      { limit: q.pageSize, offset: (q.page - 1) * q.pageSize }
    );
    const department = departmentId ? await prisma.department.findUnique({ where: { id: departmentId } }) : null;

    return {
      department: department ? { id: department.id, name: department.name } : null,
      filters: { academicSessionId: q.academicSessionId ?? null, programId: q.programId ?? null, semesterId: q.semesterId ?? null },
      generatedOn: formatDateOnly(new Date()),
      page: q.page,
      pageSize: q.pageSize,
      ...analytics,
    };
  },
};
