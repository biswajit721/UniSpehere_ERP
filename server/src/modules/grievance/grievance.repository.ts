import { prisma } from "../../config/db";

export const grievanceRepository = {
  create(data: { raisedById: string; category: any; subject: string; description: string; priority: any }) {
    return prisma.complaint.create({ data });
  },

  listForUser(userId: string) {
    return prisma.complaint.findMany({ where: { raisedById: userId }, orderBy: { createdAt: "desc" } });
  },

  listAll() {
    return prisma.complaint.findMany({
      include: { raisedBy: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  },

  findById(id: string) {
    return prisma.complaint.findUnique({ where: { id }, include: { raisedBy: true } });
  },

  update(id: string, data: { status: any; resolutionNote?: string }) {
    return prisma.complaint.update({ where: { id }, data, include: { raisedBy: true } });
  },
};
