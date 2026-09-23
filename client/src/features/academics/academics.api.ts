import { api } from "../../services/api";
import { AcademicSession } from "../attendance/attendance.types";

export interface SubjectRow {
  id: string;
  name: string;
  code: string;
  credits: number;
  semester: number;
  type: "THEORY" | "PRACTICAL";
  isElective: boolean;
  department: string;
  departmentId: string;
  programId: string | null;
  program: string | null;
  semesterId: string | null;
  semesterName: string | null;
  facultyName: string | null;
  facultyId: string | null;
  /** false for legacy subjects that have not been linked to a program + semester yet */
  isMapped: boolean;
}

export interface PeriodRow { id?: string; number: number; label: string; startTime: string; endTime: string; isActive: boolean }
export interface SemesterRow { id: string; programId: string; number: number; name: string }

export interface AssignmentRow {
  id: string;
  academicSession: { id: string; label: string };
  subject: { id: string; code: string; name: string };
  program: { id: string; name: string } | null;
  semester: { id: string; number: number; name: string } | null;
  section: { id: string; name: string; batchLabel: string };
  faculty: { id: string; fullName: string; employeeId: string };
}

const clean = (p: Record<string, unknown>) => Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && v !== null && v !== ""));

export const academicsApi = {
  sessions: (activeOnly = false) =>
    api.get<{ sessions: AcademicSession[] }>("/academics/sessions", { params: activeOnly ? { activeOnly: true } : {} }).then((r) => r.data.sessions),
  createSession: (body: { startYear: number; endYear: number; startDate: string; endDate: string; label?: string; isCurrent: boolean; isActive: boolean }) =>
    api.post<{ session: AcademicSession }>("/academics/sessions", body).then((r) => r.data.session),
  updateSession: (id: string, body: Partial<{ label: string; startDate: string; endDate: string; isCurrent: boolean; isActive: boolean }>) =>
    api.patch<{ session: AcademicSession }>(`/academics/sessions/${id}`, body).then((r) => r.data.session),

  semesters: (programId?: string) => api.get<{ semesters: SemesterRow[] }>("/academics/semesters", { params: clean({ programId }) }).then((r) => r.data.semesters),

  periods: () => api.get<{ periods: PeriodRow[] }>("/academics/periods").then((r) => r.data.periods),
  savePeriods: (periods: { number: number; label?: string | null; startTime: string; endTime: string; isActive: boolean }[]) =>
    api.put<{ periods: PeriodRow[] }>("/academics/periods", { periods }).then((r) => r.data.periods),

  subjects: (params: Record<string, unknown> = {}) => api.get<{ subjects: SubjectRow[] }>("/academics/subjects", { params: clean(params) }).then((r) => r.data.subjects),
  createSubject: (body: Record<string, unknown>) => api.post("/academics/subjects", body).then((r) => r.data),
  updateSubject: (id: string, body: Record<string, unknown>) => api.put(`/academics/subjects/${id}`, body).then((r) => r.data),
  deleteSubject: (id: string) => api.delete(`/academics/subjects/${id}`).then((r) => r.data),

  assignments: (params: Record<string, unknown> = {}) => api.get<{ assignments: AssignmentRow[] }>("/academics/assignments", { params: clean(params) }).then((r) => r.data.assignments),
  createAssignment: (body: { academicSessionId: string; subjectId: string; sectionId: string; facultyId: string }) => api.post("/academics/assignments", body).then((r) => r.data),
  deleteAssignment: (id: string) => api.delete(`/academics/assignments/${id}`).then((r) => r.data),
};
