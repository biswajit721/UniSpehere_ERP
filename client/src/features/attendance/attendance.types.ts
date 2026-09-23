// Shapes returned by /api/attendance, /api/academics and /api/students. They mirror the server exactly -
// the frontend never derives an academic relationship, it only displays what the API validated.

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

export interface AcademicSession {
  id: string;
  label: string;
  startYear: number;
  endYear: number;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
  isActive: boolean;
}

export interface SemesterOption { number: number; name: string }
export interface DepartmentOption { id: string; name: string }
export interface ProgramOption { id: string; name: string; semesterId: string }
export interface SectionOption { id: string; name: string; batchId: string; batchLabel: string }
export interface SubjectOption { id: string; code: string; name: string; isElective: boolean }

export interface PeriodOption {
  number: number;
  label: string;
  startTime: string;
  endTime: string;
  scheduled: boolean;
  scheduledClasses: number | null;
  scheduledFaculty: string | null;
  room: string | null;
  taken: boolean;
}
export interface PeriodOptionsResponse { gridConfigured: boolean; hasTimetable: boolean; periods: PeriodOption[] }

export interface AttendancePolicy {
  minimumPercentage: number;
  warningPercentage: number;
  criticalPercentage: number;
  defaultStatusPresent: boolean;
  countExcusedAsPresent: boolean;
  allowFutureAttendance: boolean;
  enforceSessionDates: boolean;
  maxClassesPerSession: number;
  facultyEditWindowDays: number;
}

export interface ClassContext {
  academicSession: { id: string; label: string };
  semester: { id: string; number: number; name: string };
  department: { id: string; name: string };
  program: { id: string; name: string };
  section: { id: string; name: string; batchLabel: string };
  subject: { id: string; code: string; name: string };
  date: string;
  period: number;
  numberOfClasses: number;
  startTime: string;
  endTime: string;
  classes: { classNumber: number; periodNumber: number; startTime: string; endTime: string }[];
}

export interface RosterStudent {
  studentId: string;
  enrollmentId: string;
  rollNumber: string;
  registrationNumber: string;
  fullName: string;
  kind: "REGULAR" | "BACKLOG" | "ELECTIVE";
}

export interface ExistingSheet {
  id: string;
  status: "SUBMITTED" | "CANCELLED";
  period: number;
  numberOfClasses: number;
  submittedAt: string;
  recordedBy: string;
}

export interface RosterResponse {
  class: ClassContext;
  existing: ExistingSheet | null;
  defaultStatus: AttendanceStatus;
  total: number;
  students: RosterStudent[];
}

export interface SubmitResult {
  id: string;
  date: string;
  period: number;
  numberOfClasses: number;
  startTime: string;
  endTime: string;
  subject: { id: string; code: string; name: string };
  section: { id: string; name: string; batchLabel: string };
  total: number;
  present: number;
  absent: number;
  percentage: number;
}

export interface HistoryRow {
  id: string;
  status: "SUBMITTED" | "CANCELLED";
  date: string;
  period: number;
  numberOfClasses: number;
  startTime: string | null;
  endTime: string | null;
  academicSession: { id: string; label: string };
  semester: { id: string | null; number: number; name: string };
  program: { id: string; name: string } | null;
  section: { id: string; name: string; batchLabel: string };
  subject: { id: string; code: string; name: string };
  faculty: string | null;
  recordedBy: string;
  total: number;
  present: number;
  absent: number;
  percentage: number;
  canEdit: boolean;
  createdAt: string;
}

export interface EditTrailEntry { previousStatus: AttendanceStatus; newStatus: AttendanceStatus; editedBy: string; reason: string; at: string }
export interface SheetRecord {
  recordId: string;
  studentId: string;
  rollNumber: string;
  registrationNumber: string;
  fullName: string;
  status: AttendanceStatus;
  remarks: string | null;
  edits: EditTrailEntry[];
}
export interface AttendanceSheet {
  id: string;
  status: "SUBMITTED" | "CANCELLED";
  date: string;
  period: number;
  numberOfClasses: number;
  startTime: string | null;
  endTime: string | null;
  remarks: string | null;
  academicSession: { id: string; label: string };
  semester: { id: string | null; number: number; name: string };
  department: { id: string; name: string } | null;
  program: { id: string; name: string } | null;
  section: { id: string; name: string; batchLabel: string };
  subject: { id: string; code: string; name: string };
  faculty: string | null;
  recordedBy: string;
  createdAt: string;
  cancelled: { by: string | null; at: string | null; reason: string | null } | null;
  totals: { total: number; present: number; absent: number; percentage: number };
  permissions: { canEdit: boolean; canCancel: boolean; editBlockedReason: string | null };
  records: SheetRecord[];
}

// ------------------------------------------------------------------ student report
export type AttendanceHealth = "EXCELLENT" | "GOOD" | "WARNING" | "CRITICAL";
export type ReportView = "summary" | "daily" | "weekly" | "monthly" | "yearly" | "semester" | "session";

export interface StudentOverview {
  totalClasses: number;
  present: number;
  absent: number;
  percentage: number;
  minimumRequired: number;
  status: AttendanceHealth;
  hasShortage: boolean;
  classesNeededToRecover: number | null;
  classesCanMiss: number | null;
  ifAttendNext: number;
  ifMissNext: number;
}
export interface SubjectAttendance {
  subjectId: string;
  subject: string;
  code: string;
  registrationType: "REGULAR" | "BACKLOG" | "ELECTIVE";
  conducted: number;
  present: number;
  absent: number;
  percentage: number;
  status: AttendanceHealth;
  classesNeededToRecover: number | null;
}
export interface SeriesPoint { label: string; conducted: number; present: number; absent: number; percentage: number }
export interface DailyReport {
  date: string;
  periods: { period: number; numberOfClasses: number; startTime: string | null; endTime: string | null; subject: string; status: AttendanceStatus }[];
  conducted: number;
  present: number;
  absent: number;
  percentage: number;
}
export interface StudentReport {
  student: { id: string; fullName: string; rollNumber: string; registrationNumber: string; department: string; program: string; currentSemester: string; academicSession: string | null };
  view: ReportView;
  overview: StudentOverview;
  subjects?: SubjectAttendance[];
  daily?: DailyReport;
  series?: SeriesPoint[];
}

// ------------------------------------------------------------------ department analytics
export interface DepartmentReport {
  department: { id: string; name: string } | null;
  overall: { conducted: number; present: number; percentage: number; students: number; sessions: number };
  bySemester: { programId: string | null; programName: string | null; semester: number; conducted: number; present: number; percentage: number }[];
  bySection: { sectionId: string; sectionName: string; batchLabel: string; semester: number; conducted: number; present: number; percentage: number }[];
  bySubject: { subjectId: string; code: string; name: string; semester: number; conducted: number; present: number; percentage: number }[];
  byFaculty: { facultyId: string | null; name: string; sessions: number; classes: number; lastDate: string | null; averagePercentage: number }[];
  shortage: {
    students: number;
    belowWarning: number;
    belowCritical: number;
    averageStudentPercentage: number;
    thresholds: { warning: number; critical: number };
    totalListed: number;
    list: { studentId: string; rollNumber: string; name: string; conducted: number; present: number; percentage: number; critical: boolean }[];
  };
}
