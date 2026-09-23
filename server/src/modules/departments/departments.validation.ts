import { z } from "zod";

export const createDepartmentSchema = z.object({
  name: z.string().min(2, "Department name is required"),
  code: z
    .string()
    .min(2, "Code must be at least 2 characters")
    .max(10, "Code must be 10 characters or fewer")
    .transform((v) => v.toUpperCase()),
});

export const updateDepartmentSchema = z.object({
  name: z.string().min(2).optional(),
  code: z
    .string()
    .min(2)
    .max(10)
    .transform((v) => v.toUpperCase())
    .optional(),
});

export const createProgramSchema = z.object({
  name: z.string().min(1, "Program name is required"),
  durationYears: z.coerce.number().int().min(1).max(6),
});

export const updateProgramSchema = z.object({
  name: z.string().min(1).optional(),
  durationYears: z.coerce.number().int().min(1).max(6).optional(),
});

export const createBatchSchema = z
  .object({
    startYear: z.coerce.number().int().min(2000).max(2100),
    endYear: z.coerce.number().int().min(2000).max(2100),
    label: z.string().min(4, "Label is required, e.g. 2025-2028"),
  })
  .refine((data) => data.endYear > data.startYear, {
    message: "End year must be after start year",
    path: ["endYear"],
  });

export const updateBatchSchema = z.object({
  startYear: z.coerce.number().int().min(2000).max(2100).optional(),
  endYear: z.coerce.number().int().min(2000).max(2100).optional(),
  label: z.string().min(4).optional(),
});

export const createSectionSchema = z.object({
  name: z.string().min(1, "Section name is required").max(5),
});

export const updateSectionSchema = z.object({
  name: z.string().min(1).max(5).optional(),
});
