export type Role =
  | "SUPER_ADMIN"
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

export interface AuthUser {
  id: string;
  universityId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  mustResetPassword: boolean;
  profilePhoto: string | null;
  phone?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  address?: string | null;
  bio?: string | null;
}
