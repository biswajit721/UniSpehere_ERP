import { prisma } from "../../config/db";

export const noticesRepository = {
  listFor(role: string, departmentId?: string) {
    return prisma.notice.findMany({
      where: {
        OR: [
          { targetRole: null, targetDepartmentId: null },
          { targetRole: role },
          ...(departmentId ? [{ targetDepartmentId: departmentId }] : []),
        ],
      },
      include: { postedBy: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  },

  create(data: {
    title: string;
    content: string;
    category: any;
    priority: any;
    targetRole?: string;
    targetDepartmentId?: string;
    postedById: string;
    expiresAt?: Date;
  }) {
    return prisma.notice.create({ data, include: { postedBy: true } });
  },

  remove(id: string) {
    return prisma.notice.delete({ where: { id } });
  },
};
