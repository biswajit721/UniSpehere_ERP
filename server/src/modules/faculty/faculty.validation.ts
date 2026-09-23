import { z } from "zod";

export const updateFacultySchema = z.object({
  designation: z.string().min(1).optional(),
  qualification: z.string().optional(),
  experienceYrs: z.coerce.number().int().min(0).max(60).optional(),
});

export const listFacultyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  departmentId: z.string().uuid().optional(),
});
