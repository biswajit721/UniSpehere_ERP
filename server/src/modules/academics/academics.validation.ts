import { z } from "zod";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24-hour)");

// ------------------------------------------------------------------ subjects
export const createSubjectSchema = z.object({
  name: z.string().min(1, "Subject name is required"),
  code: z.string().min(2, "Subject code is required"),
  credits: z.coerce.number().int().min(1).max(10),
  programId: z.string().uuid("Select the program this subject belongs to"),
  semesterId: z.string().uuid("Select the semester this subject is taught in"),
  type: z.enum(["THEORY", "PRACTICAL"]).default("THEORY"),
  isElective: z.boolean().default(false),
  facultyId: z.string().uuid().optional(),
});

export const updateSubjectSchema = z.object({
  name: z.string().min(1).optional(),
  credits: z.coerce.number().int().min(1).max(10).optional(),
  type: z.enum(["THEORY", "PRACTICAL"]).optional(),
  isElective: z.boolean().optional(),
  facultyId: z.string().uuid().nullable().optional(),
  // A subject may move between semesters of its own program. Legacy subjects that were never
  // mapped can be given a program + semester exactly once.
  programId: z.string().uuid().optional(),
  semesterId: z.string().uuid().optional(),
});

export const listSubjectsQuerySchema = z.object({
  departmentId: z.string().uuid().optional(),
  programId: z.string().uuid().optional(),
  semesterId: z.string().uuid().optional(),
  semester: z.coerce.number().int().optional(),
  facultyId: z.string().uuid().optional(),
  unmapped: z.enum(["true", "false"]).optional(),
});

// ------------------------------------------------------------------ academic sessions
export const createSessionSchema = z
  .object({
    label: z.string().min(4).max(20).optional(),
    startYear: z.coerce.number().int().min(2000).max(2100),
    endYear: z.coerce.number().int().min(2000).max(2100),
    startDate: dateOnly,
    endDate: dateOnly,
    isCurrent: z.boolean().default(false),
    isActive: z.boolean().default(true),
  })
  .refine((d) => d.endYear > d.startYear, { message: "End year must be after start year", path: ["endYear"] })
  .refine((d) => d.endDate > d.startDate, { message: "End date must be after start date", path: ["endDate"] });

export const updateSessionSchema = z.object({
  label: z.string().min(4).max(20).optional(),
  startDate: dateOnly.optional(),
  endDate: dateOnly.optional(),
  isCurrent: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const listSessionsQuerySchema = z.object({
  activeOnly: z.enum(["true", "false"]).optional(),
});

// ------------------------------------------------------------------ semesters / periods
export const listSemestersQuerySchema = z.object({
  programId: z.string().uuid().optional(),
});

export const replacePeriodsSchema = z.object({
  periods: z
    .array(
      z.object({
        number: z.coerce.number().int().min(1).max(20),
        label: z.string().max(40).optional().nullable(),
        startTime: hhmm,
        endTime: hhmm,
        isActive: z.boolean().default(true),
      })
    )
    .max(20),
});

// ------------------------------------------------------------------ faculty assignments
export const createAssignmentSchema = z.object({
  academicSessionId: z.string().uuid(),
  subjectId: z.string().uuid(),
  sectionId: z.string().uuid(),
  facultyId: z.string().uuid(),
});

export const listAssignmentsQuerySchema = z.object({
  academicSessionId: z.string().uuid().optional(),
  programId: z.string().uuid().optional(),
  semesterId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional(),
  subjectId: z.string().uuid().optional(),
  facultyId: z.string().uuid().optional(),
});
