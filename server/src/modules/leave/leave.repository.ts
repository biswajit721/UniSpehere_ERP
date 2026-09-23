import { prisma } from "../../config/db";

export const leaveRepository = {
  create(data: { applicantId: string; leaveType: any; reason: string; startDate: Date; endDate: Date }) {
    return prisma.leaveRequest.create({ data, include: { applicant: true } });
  },

  listForApplicant(applicantId: string) {
    return prisma.leaveRequest.findMany({
      where: { applicantId },
      orderBy: { createdAt: "desc" },
    });
  },

  listPending() {
    return prisma.leaveRequest.findMany({
      where: { status: "PENDING" },
      include: { applicant: { include: { role: true } } },
      orderBy: { createdAt: "asc" },
    });
  },

  listAll() {
    return prisma.leaveRequest.findMany({
      include: { applicant: { include: { role: true } }, decidedBy: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  },

  findById(id: string) {
    return prisma.leaveRequest.findUnique({ where: { id }, include: { applicant: true } });
  },

  decide(id: string, status: "APPROVED" | "REJECTED", decidedById: string, decisionNote?: string) {
    return prisma.leaveRequest.update({
      where: { id },
      data: { status, decidedById, decisionNote },
      include: { applicant: true },
    });
  },
};
