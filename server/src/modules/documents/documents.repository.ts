import { prisma } from "../../config/db";

export const documentsRepository = {
  create(data: { ownerId: string; title: string; category: any; fileUrl: string; publicId: string }) {
    return prisma.document.create({ data });
  },

  listForOwner(ownerId: string) {
    return prisma.document.findMany({ where: { ownerId }, orderBy: { uploadedAt: "desc" } });
  },

  listAll(status?: string) {
    return prisma.document.findMany({
      where: status ? { status: status as any } : {},
      include: { owner: true },
      orderBy: { uploadedAt: "desc" },
      take: 100,
    });
  },

  findById(id: string) {
    return prisma.document.findUnique({ where: { id } });
  },

  updateStatus(id: string, status: "VERIFIED" | "REJECTED", reviewNote?: string) {
    return prisma.document.update({ where: { id }, data: { status, reviewNote } });
  },

  remove(id: string) {
    return prisma.document.delete({ where: { id } });
  },
};
