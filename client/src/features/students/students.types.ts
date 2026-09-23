export interface CurrentEnrollment {
  id: string;
  academicSessionId: string;
  academicSession: string;
  semesterId: string;
  semester: string;
  status: string;
  enrollmentType: string;
}

export interface StudentRow {
  id: string;
  userId: string;
  rollNumber: string;
  registrationNumber: string | null;
  fullName: string;
  email: string;
  universityId: string;
  isActive: boolean;
  department: string;
  departmentId: string;
  program: string;
  programId: string;
  batch: string;
  batchId: string;
  section: string | null;
  sectionId: string | null;
  currentSemester: number;
  cgpa: number | null;
  admissionYear: number | null;
  guardianName: string | null;
  guardianPhone: string | null;
  guardianRelation: string | null;
  /** the student's open enrollment - null when they have none (deferred / withdrawn) */
  currentEnrollment: CurrentEnrollment | null;
}

/** /students/me returns the same shape; kept as an alias so callers read naturally. */
export type StudentListItem = StudentRow;

export type EnrollmentType = "REGULAR" | "LATERAL" | "PROMOTION" | "READMISSION" | "REPEAT" | "TRANSFER";
export type EnrollmentStatus = "ACTIVE" | "PROMOTED" | "COMPLETED" | "REPEATED" | "DETAINED" | "DEFERRED" | "WITHDRAWN" | "TRANSFERRED";
export type ReadmissionReason = "BACKLOG" | "ACADEMIC_REPEAT" | "OTHER";

export interface SubjectRegistration {
  id: string;
  type: "BACKLOG" | "ELECTIVE";
  subject: { id: string; code: string; name: string; semester: number };
  section: { id: string; name: string; batchLabel: string };
}

export interface Enrollment {
  id: string;
  studentId: string;
  academicSession: { id: string; label: string };
  department: { id: string; name: string };
  program: { id: string; name: string };
  batch: { id: string; label: string };
  semester: { id: string; number: number; name: string };
  section: { id: string; name: string } | null;
  admissionYear: number;
  admissionDate: string;
  endDate: string | null;
  isCurrent: boolean;
  enrollmentType: EnrollmentType;
  status: EnrollmentStatus;
  readmissionReason: ReadmissionReason | null;
  reasonNote: string | null;
  previousEnrollmentId: string | null;
  createdAt: string;
  subjectRegistrations: SubjectRegistration[];
}
