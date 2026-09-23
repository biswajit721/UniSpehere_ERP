import { z } from "zod";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const id = z.string().uuid();

export const promoteSchema = z.object({
  academicSessionId: id,
  semesterId: id,
  batchId: id.optional(),
  sectionId: id.nullable().optional(),
  effectiveDate: dateOnly.optional(),
  reasonNote: z.string().max(500).optional(),
});

export const readmitSchema = z
  .object({
    enrollmentType: z.enum(["READMISSION", "REPEAT"]),
    academicSessionId: id,
    semesterId: id,
    batchId: id,
    sectionId: id.nullable().optional(),
    readmissionReason: z.enum(["BACKLOG", "ACADEMIC_REPEAT", "OTHER"]),
    reasonNote: z.string().max(500).optional(),
    admissionYear: z.coerce.number().int().min(1990).max(2100).optional(),
    effectiveDate: dateOnly.optional(),
  })
  .refine((d) => d.readmissionReason !== "OTHER" || Boolean(d.reasonNote?.trim()), {
    message: "Please describe the reason when you choose Other",
    path: ["reasonNote"],
  });

export const transferSchema = z
  .object({
    departmentId: id.optional(),
    programId: id.optional(),
    batchId: id.optional(),
    semesterId: id.optional(),
    sectionId: id.nullable().optional(),
    effectiveDate: dateOnly.optional(),
    reasonNote: z.string().min(3, "A reason is required for a transfer").max(500),
  })
  .refine((d) => d.sectionId !== undefined || d.batchId || d.programId || d.departmentId || d.semesterId, {
    message: "Choose what should change",
    path: ["sectionId"],
  });

export const closeSchema = z.object({
  status: z.enum(["DEFERRED", "WITHDRAWN", "DETAINED", "COMPLETED"]),
  effectiveDate: dateOnly.optional(),
  reasonNote: z.string().max(500).optional(),
});

export const registerSubjectSchema = z.object({
  subjectId: id,
  sectionId: id,
  type: z.enum(["BACKLOG", "ELECTIVE"]),
});
