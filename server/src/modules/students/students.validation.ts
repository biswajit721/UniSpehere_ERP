import { z } from "zod";

export const updateStudentSchema = z.object({
  advisorId: z.string().uuid().nullable().optional(),
  gender: z.string().optional(),
  address: z.string().optional(),
  dateOfBirth: z.string().datetime().optional(),
  registrationNumber: z.string().min(3).max(40).nullable().optional(),
  guardianName: z.string().max(120).nullable().optional(),
  guardianPhone: z.string().max(30).nullable().optional(),
  guardianRelation: z.string().max(40).nullable().optional(),
  // Semester and section are no longer editable in place. They are rejected explicitly (rather than
  // silently ignored) so an outdated client learns why nothing changed.
  currentSemester: z.unknown().optional(),
  sectionId: z.unknown().optional(),
});

export const listStudentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  departmentId: z.string().uuid().optional(),
  programId: z.string().uuid().optional(),
  academicSessionId: z.string().uuid().optional(),
  semesterId: z.string().uuid().optional(),
  semester: z.coerce.number().int().optional(),
  sectionId: z.string().uuid().optional(),
});

export type ListStudentsQuery = z.infer<typeof listStudentsQuerySchema>;
