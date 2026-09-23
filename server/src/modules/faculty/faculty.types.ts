export interface UpdateFacultyInput {
  designation?: string;
  qualification?: string;
  experienceYrs?: number;
}

export interface FacultyListItem {
  id: string;
  userId: string;
  employeeId: string;
  fullName: string;
  email: string;
  universityId: string;
  isActive: boolean;
  department: string;
  departmentId: string;
  designation: string;
  qualification: string | null;
  experienceYrs: number | null;
}
