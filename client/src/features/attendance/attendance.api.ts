import { api } from "../../services/api";
import {
  AcademicSession, AttendancePolicy, AttendanceSheet, AttendanceStatus, DepartmentOption, DepartmentReport, HistoryRow,
  PeriodOptionsResponse, ProgramOption, RosterResponse, SectionOption, SemesterOption, StudentReport, SubjectOption, SubmitResult,
} from "./attendance.types";

/** Drops empty values so optional filters never reach the server as "undefined" or "". */
const clean = (params: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""));

export interface ClassSelection {
  academicSessionId: string;
  semesterId: string;
  departmentId: string;
  programId: string;
  sectionId: string;
  subjectId: string;
  date: string;
  period: number;
  numberOfClasses: number;
  startTime?: string;
  endTime?: string;
}

export const attendanceApi = {
  // ---- reference data (Academics is the source of truth)
  // Only ACTIVE sessions are offered for recording attendance (inactive ones cannot receive new attendance).
  sessions: (): Promise<AcademicSession[]> => api.get<{ sessions: AcademicSession[] }>("/academics/sessions", { params: { activeOnly: true } }).then((r) => r.data.sessions),
  policy: () => api.get<{ policy: AttendancePolicy }>("/attendance/policy").then((r) => r.data.policy),

  // ---- cascading options, each derived from the previous choice and the caller's permissions
  semesters: (academicSessionId: string) =>
    api.get<{ options: SemesterOption[] }>("/attendance/options", { params: { level: "semesters", academicSessionId } }).then((r) => r.data.options),
  departments: (academicSessionId: string, semesterNumber: number) =>
    api.get<{ options: DepartmentOption[] }>("/attendance/options", { params: { level: "departments", academicSessionId, semesterNumber } }).then((r) => r.data.options),
  programs: (academicSessionId: string, semesterNumber: number, departmentId: string) =>
    api.get<{ options: ProgramOption[] }>("/attendance/options", { params: { level: "programs", academicSessionId, semesterNumber, departmentId } }).then((r) => r.data.options),
  sections: (academicSessionId: string, semesterId: string, programId: string) =>
    api.get<{ options: SectionOption[] }>("/attendance/options", { params: { level: "sections", academicSessionId, semesterId, programId } }).then((r) => r.data.options),
  subjects: (academicSessionId: string, semesterId: string, sectionId: string) =>
    api.get<{ options: SubjectOption[] }>("/attendance/options", { params: { level: "subjects", academicSessionId, semesterId, sectionId } }).then((r) => r.data.options),
  periods: (academicSessionId: string, sectionId: string, subjectId: string, date: string) =>
    api.get<PeriodOptionsResponse>("/attendance/options", { params: { level: "periods", academicSessionId, sectionId, subjectId, date } }).then((r) => r.data),

  // ---- taking attendance
  roster: (sel: ClassSelection, allowOutsideSession: boolean) =>
    api.get<RosterResponse>("/attendance/students", { params: clean({ ...sel, allowOutsideSession: allowOutsideSession ? "true" : undefined }) }).then((r) => r.data),
  submit: (sel: ClassSelection, records: { studentId: string; status: AttendanceStatus; remarks?: string }[], allowOutsideSession: boolean) =>
    api.post<{ message: string; attendance: SubmitResult }>("/attendance", { ...clean({ ...sel }), allowOutsideSession: allowOutsideSession || undefined, records }).then((r) => r.data),

  // ---- sheets
  history: (params: Record<string, unknown>) =>
    api.get<{ total: number; page: number; pageSize: number; data: HistoryRow[] }>("/attendance/history", { params: clean(params) }).then((r) => r.data),
  sheet: (id: string) => api.get<{ attendance: AttendanceSheet }>(`/attendance/${id}`).then((r) => r.data.attendance),
  edit: (id: string, reason: string, changes: { recordId: string; status: AttendanceStatus; remarks?: string | null }[]) =>
    api.put<{ message: string; recordsUpdated: number; statusChanges: number }>(`/attendance/${id}`, { reason, changes }).then((r) => r.data),
  cancel: (id: string, reason: string) => api.post<{ message: string }>(`/attendance/${id}/cancel`, { reason }).then((r) => r.data),

  // ---- reports
  studentReport: (studentId: string, params: Record<string, unknown>) =>
    api.get<StudentReport>(`/attendance/student/${studentId}`, { params: clean(params) }).then((r) => r.data),
  departmentReport: (params: Record<string, unknown>) =>
    api.get<DepartmentReport>("/attendance/reports/department", { params: clean(params) }).then((r) => r.data),
  classPdf: (params: { academicSessionId: string; sectionId: string; subjectId: string }) =>
    api.get<Blob>("/reports/attendance.pdf", { params, responseType: "blob" }).then((r) => r.data),
};
