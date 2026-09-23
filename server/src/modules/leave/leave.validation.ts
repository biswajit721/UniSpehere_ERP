import { z } from "zod";

export const createLeaveSchema = z
  .object({
    leaveType: z.enum(["SICK", "CASUAL", "OTHER"]),
    reason: z.string().min(3),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
  })
  .refine((d) => d.endDate >= d.startDate, { message: "End date must be on or after start date", path: ["endDate"] });

export const decideLeaveSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  decisionNote: z.string().optional(),
});
