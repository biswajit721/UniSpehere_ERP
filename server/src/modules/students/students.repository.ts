import { Prisma } from "@prisma/client";
import { prisma } from "../../config/db";
import { UpdateStudentInput } from "./students.types";

const studentInclude = {
  user: true,
  department: true,
  program: true,
  batch: true,
  section: true,
  // The open enrollment is the student's current academic placement.
  enrollments: {
    where: { endDate: null },
    include: { academicSession: true, semester: true },
    take: 1,
  },
} satisfies Prisma.StudentInclude;

export type StudentRow = Prisma.StudentGetPayload<{ include: typeof studentInclude }>;

export interface StudentFilters {
  search?: string;
  departmentId?: string;
  programId?: string;
  academicSessionId?: string;
  semesterId?: string;
  semester?: number;
  sectionId?: string;
}

/** One WHERE builder shared by list() and count() so pagination totals always match the rows. */
function buildWhere(f: StudentFilters): Prisma.StudentWhereInput {
  const enrollmentFilter: Prisma.StudentEnrollmentWhereInput = {
    endDate: null,
    ...(f.academicSessionId && { academicSessionId: f.academicSessionId }),
    ...(f.semesterId && { semesterId: f.semesterId }),
    ...(f.semester && { semester: { number: f.semester } }),
    ...(f.sectionId && { sectionId: f.sectionId }),
  };
  const usesEnrollment = Boolean(f.academicSessionId || f.semesterId || f.semester || f.sectionId);
  const searchTerms = (f.search ?? "").trim().split(/\s+/).filter(Boolean);

  return {
    deletedAt: null,
    ...(f.departmentId && { departmentId: f.departmentId }),
    ...(f.programId && { programId: f.programId }),
    ...(usesEnrollment && { enrollments: { some: enrollmentFilter } }),
    // Every word must match somewhere, so "Rahul Kumar" finds Rahul Kumar (the old filter tested the whole
    // phrase against firstName OR lastName, which can never match a two-word name).
    ...(searchTerms.length > 0 && {
      AND: searchTerms.map((term) => ({
        OR: [
          { rollNumber: { contains: term, mode: "insensitive" as const } },
          { registrationNumber: { contains: term, mode: "insensitive" as const } },
          { user: { firstName: { contains: term, mode: "insensitive" as const } } },
          { user: { lastName: { contains: term, mode: "insensitive" as const } } },
          { user: { email: { contains: term, mode: "insensitive" as const } } },
          { user: { universityId: { contains: term, mode: "insensitive" as const } } },
        ],
      })),
    }),
  };
}

export const studentsRepository = {
  list(params: StudentFilters & { skip: number; take: number }) {
    return prisma.student.findMany({
      where: buildWhere(params),
      include: studentInclude,
      orderBy: { createdAt: "desc" },
      skip: params.skip,
      take: params.take,
    });
  },

  count(params: StudentFilters) {
    return prisma.student.count({ where: buildWhere(params) });
  },

  findById(id: string) {
    return prisma.student.findUnique({ where: { id }, include: studentInclude });
  },

  findByUserId(userId: string) {
    return prisma.student.findUnique({ where: { userId }, include: studentInclude });
  },

  update(id: string, data: UpdateStudentInput) {
    return prisma.student.update({
      where: { id },
      data: {
        ...(data.advisorId !== undefined && { advisorId: data.advisorId }),
        ...(data.gender !== undefined && { gender: data.gender }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.dateOfBirth !== undefined && { dateOfBirth: new Date(data.dateOfBirth) }),
        ...(data.registrationNumber !== undefined && { registrationNumber: data.registrationNumber }),
        ...(data.guardianName !== undefined && { guardianName: data.guardianName }),
        ...(data.guardianPhone !== undefined && { guardianPhone: data.guardianPhone }),
        ...(data.guardianRelation !== undefined && { guardianRelation: data.guardianRelation }),
      },
      include: studentInclude,
    });
  },

  setUserActive(userId: string, isActive: boolean) {
    return prisma.user.update({ where: { id: userId }, data: { isActive } });
  },
};
