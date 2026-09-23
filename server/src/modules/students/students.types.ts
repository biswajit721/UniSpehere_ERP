export interface UpdateStudentInput {
  advisorId?: string | null;
  gender?: string;
  address?: string;
  dateOfBirth?: string; // ISO date
  registrationNumber?: string | null;
  guardianName?: string | null;
  guardianPhone?: string | null;
  guardianRelation?: string | null;
}

export interface StudentListItem {
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
  /** From the student's open enrollment - null when they have none (deferred / withdrawn). */
  currentEnrollment: {
    id: string;
    academicSessionId: string;
    academicSession: string;
    semesterId: string;
    semester: string;
    status: string;
    enrollmentType: string;
  } | null;
}
