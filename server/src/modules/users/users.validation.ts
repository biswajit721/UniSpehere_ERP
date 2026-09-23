import { z } from "zod";

const CREATABLE_ROLES = [
  "UNIV_ADMIN",
  "PRINCIPAL",
  "HOD",
  "FACULTY",
  "STUDENT",
  "EXAM_CONTROLLER",
  "ACCOUNTANT",
  "LIBRARIAN",
  "HOSTEL_WARDEN",
  "PLACEMENT_OFFICER",
] as const;

export const createUserSchema = z
  .object({
    role: z.enum(CREATABLE_ROLES),
    email: z.string().email(),
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    phone: z.string().optional(),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Must contain an uppercase letter")
      .regex(/[0-9]/, "Must contain a number")
      .optional(),
    mustResetPassword: z.boolean().optional(),
    // Faculty / HOD
    departmentId: z.string().uuid().optional(),
    employeeId: z.string().optional(),
    designation: z.string().optional(),
    qualification: z.string().optional(),
    // Student - master profile
    rollNumber: z.string().optional(),
    registrationNumber: z.string().min(3).max(40).optional(),
    dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").optional(),
    gender: z.string().max(20).optional(),
    address: z.string().max(300).optional(),
    guardianName: z.string().max(120).optional(),
    guardianPhone: z.string().max(30).optional(),
    guardianRelation: z.string().max(40).optional(),
    // Student - first enrollment
    programId: z.string().uuid().optional(),
    batchId: z.string().uuid().optional(),
    sectionId: z.string().uuid().optional(),
    academicSessionId: z.string().uuid().optional(),
    semesterId: z.string().uuid().optional(),
    enrollmentType: z.enum(["REGULAR", "LATERAL"]).optional(),
    admissionYear: z.coerce.number().int().min(1990).max(2100).optional(),
    admissionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === "FACULTY" || data.role === "HOD") {
      if (!data.departmentId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["departmentId"], message: "Department is required for this role" });
      }
      if (!data.designation) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["designation"], message: "Designation is required for this role" });
      }
    }
    if (data.role === "STUDENT") {
      if (!data.departmentId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["departmentId"], message: "Department is required" });
      }
      if (!data.programId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["programId"], message: "Program is required" });
      }
      if (!data.batchId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["batchId"], message: "Batch is required" });
      }
      if (!data.rollNumber) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["rollNumber"], message: "Roll number is required" });
      }
      if (!data.academicSessionId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["academicSessionId"], message: "Academic session is required" });
      }
      if (!data.semesterId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["semesterId"], message: "Semester is required" });
      }
      if (!data.enrollmentType) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["enrollmentType"], message: "Choose Regular admission or Lateral entry" });
      }
    }
  });
