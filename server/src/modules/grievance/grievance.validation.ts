import { z } from "zod";

export const createComplaintSchema = z.object({
  category: z.enum(["ACADEMIC", "HOSTEL", "TECHNICAL", "INFRASTRUCTURE", "OTHER"]),
  subject: z.string().min(1),
  description: z.string().min(3),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
});

export const updateComplaintSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]),
  resolutionNote: z.string().optional(),
});
