import { z } from "zod";

export const createCompanySchema = z.object({
  name: z.string().min(1),
  website: z.string().url().optional().or(z.literal("")),
  location: z.string().optional(),
});

export const createDriveSchema = z.object({
  companyId: z.string().uuid(),
  jobRole: z.string().min(1),
  description: z.string().optional(),
  eligibleDepartmentId: z.string().uuid().optional(),
  minCgpa: z.coerce.number().min(0).max(10).optional(),
  salaryPackage: z.string().optional(),
  driveDate: z.string().datetime(),
});

export const updateDriveStatusSchema = z.object({
  status: z.enum(["OPEN", "CLOSED"]),
});

export const updateApplicationStatusSchema = z.object({
  status: z.enum(["APPLIED", "SHORTLISTED", "SELECTED", "REJECTED"]),
});
