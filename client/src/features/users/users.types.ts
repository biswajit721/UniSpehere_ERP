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

export const CREATABLE_ROLES: { value: CreatableRole; label: string }[] = [
  { value: "STUDENT", label: "Student" },
  { value: "FACULTY", label: "Faculty" },
  { value: "HOD", label: "HOD" },
  { value: "PRINCIPAL", label: "Principal" },
  { value: "UNIV_ADMIN", label: "University Admin" },
  { value: "EXAM_CONTROLLER", label: "Examination Controller" },
  { value: "ACCOUNTANT", label: "Accountant" },
  { value: "LIBRARIAN", label: "Librarian" },
  { value: "HOSTEL_WARDEN", label: "Hostel Warden" },
  { value: "PLACEMENT_OFFICER", label: "Placement Officer" },
];

export interface UserRow {
  id: string;
  universityId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export interface Section {
  id: string;
  name: string;
}
export interface Batch {
  id: string;
  label: string;
  sections: Section[];
}
export interface Semester {
  id: string;
  number: number;
  name: string;
}
export interface Program {
  id: string;
  name: string;
  batches: Batch[];
  semesters: Semester[];
}
export interface Department {
  id: string;
  name: string;
  code: string;
  programs: Program[];
}

export interface CreatedUserResult {
  id: string;
  universityId: string;
  email: string;
  role: string;
  tempPassword: string | null;
  passwordWasCustom: boolean;
}
