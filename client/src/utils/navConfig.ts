import {
  Banknote,
  BarChart3,
  Bell,
  BookOpen,
  Briefcase,
  Building2,
  CalendarDays,
  ClipboardCheck,
  Clock,
  FileText,
  FileSpreadsheet,
  IdCard,
  FolderLock,
  GraduationCap,
  LayoutDashboard,
  Library,
  MessageSquareWarning,
  Settings,
  ShieldCheck,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import { Role } from "../types/auth";

export interface NavItem {
  label: string;
  path: string;
  icon: typeof LayoutDashboard;
  colorVar: string; // tailwind text-module-* class suffix
}

const ALL_ITEMS: Record<string, NavItem> = {
  dashboard: { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard, colorVar: "dashboard" },
  users: { label: "Users", path: "/users", icon: UserPlus, colorVar: "administration" },
  students: { label: "Students", path: "/students", icon: GraduationCap, colorVar: "students" },
  faculty: { label: "Faculty", path: "/faculty", icon: Users, colorVar: "faculty" },
  departments: { label: "Departments", path: "/departments", icon: Building2, colorVar: "administration" },
  academics: { label: "Academics", path: "/academics", icon: BookOpen, colorVar: "academics" },
  attendance: { label: "Attendance", path: "/attendance", icon: ClipboardCheck, colorVar: "attendance" },
  timetable: { label: "Timetable", path: "/timetable", icon: CalendarDays, colorVar: "timetable" },
  examination: { label: "Examination", path: "/examination", icon: FileText, colorVar: "examination" },
  results: { label: "Results", path: "/results", icon: BarChart3, colorVar: "results" },
  fees: { label: "Fees", path: "/fees", icon: Banknote, colorVar: "fees" },
  library: { label: "Library", path: "/library", icon: Library, colorVar: "library" },
  hostel: { label: "Hostel", path: "/hostel", icon: Building2, colorVar: "hostel" },
  placement: { label: "Placement", path: "/placement", icon: Briefcase, colorVar: "placement" },
  notices: { label: "Notices", path: "/notices", icon: Bell, colorVar: "notices" },
  leave: { label: "Leave", path: "/leave", icon: Clock, colorVar: "notices" },
  grievance: { label: "Grievance", path: "/grievance", icon: MessageSquareWarning, colorVar: "grievance" },
  administration: { label: "Administration", path: "/administration", icon: ShieldCheck, colorVar: "administration" },
  documents: { label: "Documents", path: "/documents", icon: FolderLock, colorVar: "administration" },
  analytics: { label: "My Performance", path: "/analytics", icon: TrendingUp, colorVar: "analytics" },
  idcard: { label: "ID Card", path: "/id-card", icon: IdCard, colorVar: "idcard" },
  reports: { label: "Reports", path: "/reports", icon: FileSpreadsheet, colorVar: "reports" },
  settings: { label: "Settings", path: "/settings", icon: Settings, colorVar: "settings" },
};

export const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  SUPER_ADMIN: [
    ALL_ITEMS.dashboard, ALL_ITEMS.users, ALL_ITEMS.students, ALL_ITEMS.faculty,
    ALL_ITEMS.departments, ALL_ITEMS.academics, ALL_ITEMS.timetable, ALL_ITEMS.attendance, ALL_ITEMS.examination, ALL_ITEMS.fees,
    ALL_ITEMS.library, ALL_ITEMS.placement, ALL_ITEMS.notices, ALL_ITEMS.leave, ALL_ITEMS.grievance,
    ALL_ITEMS.hostel, ALL_ITEMS.reports, ALL_ITEMS.administration, ALL_ITEMS.settings,
  ],
  UNIV_ADMIN: [
    ALL_ITEMS.dashboard, ALL_ITEMS.users, ALL_ITEMS.students, ALL_ITEMS.faculty, ALL_ITEMS.departments,
    ALL_ITEMS.academics, ALL_ITEMS.timetable, ALL_ITEMS.attendance, ALL_ITEMS.notices, ALL_ITEMS.leave, ALL_ITEMS.grievance,
    ALL_ITEMS.documents, ALL_ITEMS.reports, ALL_ITEMS.settings,
  ],
  PRINCIPAL: [
    ALL_ITEMS.dashboard, ALL_ITEMS.students, ALL_ITEMS.faculty, ALL_ITEMS.departments,
    ALL_ITEMS.academics, ALL_ITEMS.attendance, ALL_ITEMS.notices, ALL_ITEMS.settings,
  ],
  HOD: [
    ALL_ITEMS.dashboard, ALL_ITEMS.faculty, ALL_ITEMS.students, ALL_ITEMS.academics,
    ALL_ITEMS.timetable, ALL_ITEMS.attendance, ALL_ITEMS.notices, ALL_ITEMS.leave, ALL_ITEMS.grievance, ALL_ITEMS.settings,
  ],
  FACULTY: [
    ALL_ITEMS.dashboard, ALL_ITEMS.attendance, ALL_ITEMS.timetable, ALL_ITEMS.academics,
    ALL_ITEMS.examination, ALL_ITEMS.library, ALL_ITEMS.notices, ALL_ITEMS.leave, ALL_ITEMS.grievance,
    ALL_ITEMS.documents, ALL_ITEMS.settings,
  ],
  STUDENT: [
    ALL_ITEMS.dashboard, ALL_ITEMS.attendance, ALL_ITEMS.timetable, ALL_ITEMS.academics, ALL_ITEMS.examination,
    ALL_ITEMS.fees, ALL_ITEMS.library, ALL_ITEMS.placement, ALL_ITEMS.notices, ALL_ITEMS.leave, ALL_ITEMS.grievance,
    ALL_ITEMS.documents, ALL_ITEMS.analytics, ALL_ITEMS.hostel, ALL_ITEMS.idcard, ALL_ITEMS.settings,
  ],
  EXAM_CONTROLLER: [ALL_ITEMS.dashboard, ALL_ITEMS.examination, ALL_ITEMS.notices, ALL_ITEMS.settings],
  ACCOUNTANT: [ALL_ITEMS.dashboard, ALL_ITEMS.fees, ALL_ITEMS.reports, ALL_ITEMS.notices, ALL_ITEMS.settings],
  LIBRARIAN: [ALL_ITEMS.dashboard, ALL_ITEMS.library, ALL_ITEMS.notices, ALL_ITEMS.settings],
  HOSTEL_WARDEN: [ALL_ITEMS.dashboard, ALL_ITEMS.hostel, ALL_ITEMS.notices, ALL_ITEMS.settings],
  PLACEMENT_OFFICER: [ALL_ITEMS.dashboard, ALL_ITEMS.placement, ALL_ITEMS.students, ALL_ITEMS.notices, ALL_ITEMS.settings],
};
