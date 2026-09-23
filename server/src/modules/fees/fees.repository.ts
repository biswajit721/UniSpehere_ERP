import { prisma } from "../../config/db";

export const feesRepository = {
  list(params: { studentId?: string; status?: string }) {
    return prisma.fee.findMany({
      where: {
        ...(params.studentId && { studentId: params.studentId }),
        ...(params.status && { status: params.status as any }),
      },
      include: { student: { include: { user: true } }, payments: true },
      orderBy: { dueDate: "asc" },
    });
  },

  findById(id: string) {
    return prisma.fee.findUnique({
      where: { id },
      include: { student: { include: { user: true } }, payments: true },
    });
  },

  create(data: { studentId: string; feeType: any; amountDue: number; dueDate: Date }) {
    return prisma.fee.create({ data, include: { student: { include: { user: true } }, payments: true } });
  },

  addPayment(feeId: string, data: { amountPaid: number; method: string; receiptNumber: string }) {
    return prisma.payment.create({ data: { feeId, ...data } });
  },

  updateStatus(id: string, status: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE") {
    return prisma.fee.update({ where: { id }, data: { status } });
  },

  countPayments() {
    return prisma.payment.count();
  },
};
