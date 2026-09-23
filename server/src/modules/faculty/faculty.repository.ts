import { prisma } from "../../config/db";
import { UpdateFacultyInput } from "./faculty.types";

export const facultyRepository = {
  list(params: { skip: number; take: number; search?: string; departmentId?: string }) {
    const where = {
      deletedAt: null,
      ...(params.departmentId && { departmentId: params.departmentId }),
      ...(params.search && {
        OR: [
          { employeeId: { contains: params.search, mode: "insensitive" as const } },
          { user: { firstName: { contains: params.search, mode: "insensitive" as const } } },
          { user: { lastName: { contains: params.search, mode: "insensitive" as const } } },
          { user: { email: { contains: params.search, mode: "insensitive" as const } } },
        ],
      }),
    };

    return prisma.faculty.findMany({
      where,
      include: { user: true, department: true },
      orderBy: { createdAt: "desc" },
      skip: params.skip,
      take: params.take,
    });
  },

  count(params: { search?: string; departmentId?: string }) {
    return prisma.faculty.count({
      where: {
        deletedAt: null,
        ...(params.departmentId && { departmentId: params.departmentId }),
        ...(params.search && {
          OR: [
            { employeeId: { contains: params.search, mode: "insensitive" as const } },
            { user: { firstName: { contains: params.search, mode: "insensitive" as const } } },
            { user: { lastName: { contains: params.search, mode: "insensitive" as const } } },
          ],
        }),
      },
    });
  },

  findById(id: string) {
    return prisma.faculty.findUnique({ where: { id }, include: { user: true, department: true } });
  },

  findByUserId(userId: string) {
    return prisma.faculty.findUnique({ where: { userId }, include: { user: true, department: true } });
  },

  update(id: string, data: UpdateFacultyInput) {
    return prisma.faculty.update({
      where: { id },
      data: {
        ...(data.designation !== undefined && { designation: data.designation }),
        ...(data.qualification !== undefined && { qualification: data.qualification }),
        ...(data.experienceYrs !== undefined && { experienceYrs: data.experienceYrs }),
      },
      include: { user: true, department: true },
    });
  },

  setUserActive(userId: string, isActive: boolean) {
    return prisma.user.update({ where: { id: userId }, data: { isActive } });
  },
};
