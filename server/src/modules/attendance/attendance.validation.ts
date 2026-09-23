import { z } from "zod";

const uuid = z.string().uuid();
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24-hour)");
const status = z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]);

// ------------------------------------------------------------------ cascading options
export const optionsQuerySchema = z.object({
  level: z.enum(["semesters", "departments", "programs", "sections", "subjects", "periods"]),
  academicSessionId: uuid.optional(),
  semesterNumber: z.coerce.number().int().min(1).max(12).optional(),
  semesterId: uuid.optional(),
  departmentId: uuid.optional(),
  programId: uuid.optional(),
  sectionId: uuid.optional(),
  subjectId: uuid.optional(),
  date: dateOnly.optional(),
});

// ------------------------------------------------------------------ the class being taught
const classFields = {
  academicSessionId: uuid,
  semesterId: uuid,
  departmentId: uuid,
  programId: uuid,
  sectionId: uuid,
  subjectId: uuid,
  date: dateOnly,
  period: z.coerce.number().int().min(1).max(20),
  numberOfClasses: z.coerce.number().int().min(1).max(12).default(1),
  startTime: hhmm.optional(),
  endTime: hhmm.optional(),
};

export const rosterQuerySchema = z.object({
  ...classFields,
  allowOutsideSession: z.enum(["true", "false"]).optional(),
});

export const submitAttendanceSchema = z.object({
  ...classFields,
  remarks: z.string().max(300).optional(),
  // Only honoured for administrators; lets them back-fill a date outside the session window.
  allowOutsideSession: z.boolean().optional(),
  records: z
    .array(
      z.object({
        studentId: uuid,
        status,
        remarks: z.string().max(200).optional(),
      })
    )
    .min(1, "Attendance needs at least one student"),
});

export const editAttendanceSchema = z.object({
  reason: z.string().trim().min(3, "A reason is required for attendance corrections").max(300),
  changes: z
    .array(
      z.object({
        recordId: uuid,
        status,
        remarks: z.string().max(200).nullable().optional(),
      })
    )
    .min(1, "Nothing to change"),
});

export const cancelAttendanceSchema = z.object({
  reason: z.string().trim().min(3, "A reason is required to cancel attendance").max(300),
});

// ------------------------------------------------------------------ history & reports
export const historyQuerySchema = z.object({
  academicSessionId: uuid.optional(),
  semesterId: uuid.optional(),
  programId: uuid.optional(),
  sectionId: uuid.optional(),
  subjectId: uuid.optional(),
  facultyId: uuid.optional(),
  from: dateOnly.optional(),
  to: dateOnly.optional(),
  includeCancelled: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const studentReportQuerySchema = z.object({
  view: z.enum(["summary", "daily", "weekly", "monthly", "yearly", "semester", "session"]).default("summary"),
  academicSessionId: uuid.optional(),
  semesterId: uuid.optional(),
  from: dateOnly.optional(),
  to: dateOnly.optional(),
  date: dateOnly.optional(),
});

export const departmentReportQuerySchema = z.object({
  departmentId: uuid.optional(),
  academicSessionId: uuid.optional(),
  programId: uuid.optional(),
  semesterId: uuid.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export type RosterQuery = z.infer<typeof rosterQuerySchema>;
export type SubmitAttendanceInput = z.infer<typeof submitAttendanceSchema>;
export type EditAttendanceInput = z.infer<typeof editAttendanceSchema>;
export type HistoryQuery = z.infer<typeof historyQuerySchema>;
export type StudentReportQuery = z.infer<typeof studentReportQuerySchema>;
export type DepartmentReportQuery = z.infer<typeof departmentReportQuerySchema>;
