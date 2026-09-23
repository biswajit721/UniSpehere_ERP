export type CreatableRole =
  | "UNIV_ADMIN"
  | "PRINCIPAL"
  | "HOD"
  | "FACULTY"
  | "STUDENT"
  | "EXAM_CONTROLLER"
  | "ACCOUNTANT"
  | "LIBRARIAN"
  | "HOSTEL_WARDEN"
  | "PLACEMENT_OFFICER";

export interface CreateUserInput {
  role: CreatableRole;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  password?: string;
  mustResetPassword?: boolean;
  // Faculty-only
  departmentId?: string;
  employeeId?: string;
  designation?: string;
  qualification?: string;
  // Student-only: master profile
  rollNumber?: string;
  registrationNumber?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  guardianName?: string;
  guardianPhone?: string;
  guardianRelation?: string;
  // Student-only: first academic enrollment (session-aware; nothing is defaulted)
  programId?: string;
  batchId?: string;
  sectionId?: string;
  academicSessionId?: string;
  semesterId?: string;
  enrollmentType?: "REGULAR" | "LATERAL";
  admissionYear?: number;
  admissionDate?: string;
}

export interface CreateUserResult {
  id: string;
  universityId: string;
  email: string;
  role: string;
  tempPassword: string | null; // null when an admin supplied their own password
  passwordWasCustom: boolean;
}

const ROLE_PREFIX: Record<CreatableRole, string> = {
  UNIV_ADMIN: "ADM",
  PRINCIPAL: "PRN",
  HOD: "HOD",
  FACULTY: "FAC",
  STUDENT: "STU",
  EXAM_CONTROLLER: "EXC",
  ACCOUNTANT: "ACC",
  LIBRARIAN: "LIB",
  HOSTEL_WARDEN: "HSW",
  PLACEMENT_OFFICER: "PLO",
};

export function prefixForRole(role: CreatableRole): string {
  return ROLE_PREFIX[role];
}
