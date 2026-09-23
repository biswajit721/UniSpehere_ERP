import { ApiError } from "../../utils/ApiError";
import { feesRepository } from "./fees.repository";

function toDto(f: any) {
  const paid = f.payments.reduce((sum: number, p: any) => sum + Number(p.amountPaid), 0);
  return {
    id: f.id,
    studentId: f.studentId,
    studentName: `${f.student.user.firstName} ${f.student.user.lastName}`,
    universityId: f.student.user.universityId,
    feeType: f.feeType,
    amountDue: Number(f.amountDue),
    amountPaid: paid,
    amountPending: Math.max(0, Number(f.amountDue) - paid),
    dueDate: f.dueDate,
    status: f.status,
    payments: f.payments.map((p: any) => ({
      id: p.id,
      amountPaid: Number(p.amountPaid),
      method: p.method,
      receiptNumber: p.receiptNumber,
      paidAt: p.paidAt,
    })),
  };
}

export const feesService = {
  async list(params: { studentId?: string; status?: string }) {
    const rows = await feesRepository.list(params);
    return rows.map(toDto);
  },

  async create(input: { studentId: string; feeType: any; amountDue: number; dueDate: string }) {
    const fee = await feesRepository.create({
      studentId: input.studentId,
      feeType: input.feeType,
      amountDue: input.amountDue,
      dueDate: new Date(input.dueDate),
    });
    return toDto(fee);
  },

  async recordPayment(feeId: string, input: { amountPaid: number; method: string }) {
    const fee = await feesRepository.findById(feeId);
    if (!fee) throw ApiError.notFound("Fee record not found");

    const count = await feesRepository.countPayments();
    const receiptNumber = `RCPT${String(count + 1).padStart(6, "0")}`;

    await feesRepository.addPayment(feeId, {
      amountPaid: input.amountPaid,
      method: input.method,
      receiptNumber,
    });

    const updated = await feesRepository.findById(feeId);
    const paid = updated!.payments.reduce((sum, p) => sum + Number(p.amountPaid), 0);
    const newStatus = paid >= Number(updated!.amountDue) ? "PAID" : paid > 0 ? "PARTIAL" : "PENDING";
    const final = await feesRepository.updateStatus(feeId, newStatus);

    return { ...toDto({ ...updated, status: final.status }), receiptNumber };
  },
};
