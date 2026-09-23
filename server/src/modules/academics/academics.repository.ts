import { Prisma } from "@prisma/client";
import { prisma } from "../../config/db";

const subjectInclude = {
  department: true,
  program: true,
  semesterRef: true,
  faculty: { include: { user: true } },
} satisfies Prisma.SubjectInclude;

const assignmentInclude = {
  academicSession: true,
  subject: { include: { semesterRef: true, program: true } },
  section: { include: { batch: { include: { program: true } } } },
  faculty: { include: { user: true } },
} satisfies Prisma.FacultySubjectAssignmentInclude;

export type SubjectRow = Prisma.SubjectGetPayload<{ include: typeof subjectInclude }>;
export type AssignmentRow = Prisma.FacultySubjectAssignmentGetPayload<{ include: typeof assignmentInclude }>;

export const academicsRepository = {
  // ------------------------------------------------------------ subjects
  listSubjects(params: {
    departmentId?: string;
    programId?: string;
    semesterId?: string;
    semester?: number;
    facultyId?: string;
    unmapped?: boolean;
  }) {
    return prisma.subject.findMany({
      where: {
        deletedAt: null,
        ...(params.departmentId && { departmentId: params.departmentId }),
        ...(params.programId && { programId: params.programId }),
        ...(params.semesterId && { semesterId: params.semesterId }),
        ...(params.semester && { semester: params.semester }),
        ...(params.facultyId && { facultyId: params.facultyId }),
        ...(params.unmapped === true && { OR: [{ programId: null }, { semesterId: null }] }),
      },
      include: subjectInclude,
      orderBy: [{ semester: "asc" }, { name: "asc" }],
    });
  },

  findSubject(id: string) {
    return prisma.subject.findUnique({ where: { id }, include: subjectInclude });
  },

  findSubjectByCode(code: string) {
    return prisma.subject.findUnique({ where: { code } });
  },

  createSubject(data: Prisma.SubjectUncheckedCreateInput) {
    return prisma.subject.create({ data, include: subjectInclude });
  },

  updateSubject(id: string, data: Prisma.SubjectUncheckedUpdateInput) {
    return prisma.subject.update({ where: { id }, data, include: subjectInclude });
  },

  softDeleteSubject(id: string) {
    return prisma.subject.update({ where: { id }, data: { deletedAt: new Date() } });
  },

  // ------------------------------------------------------------ sessions
  listSessions(activeOnly: boolean) {
    return prisma.academicSession.findMany({
      where: activeOnly ? { isActive: true } : {},
      orderBy: { startYear: "desc" },
    });
  },

  findSession(id: string) {
    return prisma.academicSession.findUnique({ where: { id } });
  },

  findSessionByLabel(label: string) {
    return prisma.academicSession.findUnique({ where: { label } });
  },

  /** A session whose date range intersects [start, end], ignoring `excludeId`. */
  findOverlappingSession(start: Date, end: Date, excludeId?: string) {
    return prisma.academicSession.findFirst({
      where: {
        ...(excludeId && { id: { not: excludeId } }),
        startDate: { not: null, lte: end },
        endDate: { not: null, gte: start },
      },
    });
  },

  // ------------------------------------------------------------ semesters / periods
  listSemesters(programId?: string) {
    return prisma.semester.findMany({
      where: programId ? { programId } : {},
      orderBy: [{ programId: "asc" }, { number: "asc" }],
    });
  },

  listPeriods() {
    return prisma.periodDefinition.findMany({ orderBy: { number: "asc" } });
  },

  // ------------------------------------------------------------ faculty assignments
  listAssignments(where: Prisma.FacultySubjectAssignmentWhereInput) {
    return prisma.facultySubjectAssignment.findMany({
      where,
      include: assignmentInclude,
      orderBy: [{ academicSession: { startYear: "desc" } }, { section: { name: "asc" } }],
    });
  },

  findAssignment(id: string) {
    return prisma.facultySubjectAssignment.findUnique({ where: { id }, include: assignmentInclude });
  },

  createAssignment(data: Prisma.FacultySubjectAssignmentUncheckedCreateInput) {
    return prisma.facultySubjectAssignment.create({ data, include: assignmentInclude });
  },

  deleteAssignment(id: string) {
    return prisma.facultySubjectAssignment.delete({ where: { id } });
  },
};
