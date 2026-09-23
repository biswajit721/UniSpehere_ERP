import { z } from "zod";

export const createNoticeSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  category: z.enum(["ACADEMIC", "EXAMINATION", "PLACEMENT", "GENERAL", "EMERGENCY", "DEPARTMENT"]).default("GENERAL"),
  priority: z.enum(["LOW", "NORMAL", "HIGH"]).default("NORMAL"),
  targetRole: z.string().optional(),
  targetDepartmentId: z.string().uuid().optional(),
  expiresAt: z.string().datetime().optional(),
});
