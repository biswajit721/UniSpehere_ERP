import { z } from "zod";

export const createFeeSchema = z.object({
  studentId: z.string().uuid(),
  feeType: z.enum(["TUITION", "EXAMINATION", "HOSTEL", "TRANSPORT", "OTHER"]),
  amountDue: z.coerce.number().positive(),
  dueDate: z.string().datetime(),
});

export const recordPaymentSchema = z.object({
  amountPaid: z.coerce.number().positive(),
  method: z.enum(["CASH", "CARD", "UPI", "BANK_TRANSFER"]),
});

export const listFeesQuerySchema = z.object({
  studentId: z.string().uuid().optional(),
  status: z.enum(["PENDING", "PARTIAL", "PAID", "OVERDUE"]).optional(),
});
