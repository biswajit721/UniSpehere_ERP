import { z } from "zod";

export const createExamSchema = z.object({
  title: z.string().min(1, "Title is required"),
  subjectId: z.string().uuid(),
  examType: z.enum(["INTERNAL", "EXTERNAL", "PRACTICAL"]),
  examDate: z.string().datetime(),
  totalMarks: z.coerce.number().int().min(1).max(500),
});

export const enterMarksSchema = z.object({
  records: z
    .array(
      z.object({
        studentId: z.string().uuid(),
        marksObtained: z.coerce.number().min(0),
      })
    )
    .min(1),
});

export const listExamsQuerySchema = z.object({
  subjectId: z.string().uuid().optional(),
});
