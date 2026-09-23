import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ForgotPasswordPage } from "./features/auth/ForgotPasswordPage";
import { LoginPage } from "./features/auth/LoginPage";
import { DashboardLayout } from "./layouts/DashboardLayout";
import { AcademicsPage } from "./pages/AcademicsPage";
import { AdministrationPage } from "./pages/AdministrationPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { AttendancePage } from "./pages/AttendancePage";
import { DashboardHome } from "./pages/DashboardHome";
import { DepartmentsPage } from "./pages/DepartmentsPage";
import { DocumentsPage } from "./pages/DocumentsPage";
import { ExaminationPage } from "./pages/ExaminationPage";
import { FacultyPage } from "./pages/FacultyPage";
import { FeesPage } from "./pages/FeesPage";
import { GrievancePage } from "./pages/GrievancePage";
import { HostelPage } from "./pages/HostelPage";
import { IdCardPage } from "./pages/IdCardPage";
import { LeavePage } from "./pages/LeavePage";
import { LibraryPage } from "./pages/LibraryPage";
import { NoticesPage } from "./pages/NoticesPage";
import { PlacementPage } from "./pages/PlacementPage";
import { ReportsPage } from "./pages/ReportsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { StudentsPage } from "./pages/StudentsPage";
import { TimetablePage } from "./pages/TimetablePage";
import { UsersPage } from "./pages/UsersPage";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { RoleRoute } from "./routes/RoleRoute";
import { useAuthStore } from "./store/authStore";

export default function App() {
  const fetchCurrentUser = useAuthStore((s) => s.fetchCurrentUser);

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<DashboardHome />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route element={<RoleRoute allow={["UNIV_ADMIN"]} />}>
            <Route path="/users" element={<UsersPage />} />
          </Route>
          <Route element={<RoleRoute allow={["UNIV_ADMIN", "PRINCIPAL", "HOD", "FACULTY"]} />}>
            <Route path="/students" element={<StudentsPage />} />
          </Route>
          <Route element={<RoleRoute allow={["UNIV_ADMIN", "PRINCIPAL", "HOD"]} />}>
            <Route path="/faculty" element={<FacultyPage />} />
          </Route>
          <Route element={<RoleRoute allow={["UNIV_ADMIN", "PRINCIPAL", "HOD", "FACULTY", "STUDENT"]} />}>
            <Route path="/departments" element={<DepartmentsPage />} />
            <Route path="/academics" element={<AcademicsPage />} />
          </Route>
          <Route element={<RoleRoute allow={["UNIV_ADMIN", "HOD", "FACULTY", "STUDENT"]} />}>
            <Route path="/timetable" element={<TimetablePage />} />
          </Route>
          <Route element={<RoleRoute allow={["UNIV_ADMIN", "HOD", "PRINCIPAL", "FACULTY", "STUDENT"]} />}>
            <Route path="/attendance" element={<AttendancePage />} />
          </Route>
          <Route element={<RoleRoute allow={["EXAM_CONTROLLER", "FACULTY", "STUDENT"]} />}>
            <Route path="/examination" element={<ExaminationPage />} />
          </Route>
          <Route element={<RoleRoute allow={["ACCOUNTANT", "STUDENT"]} />}>
            <Route path="/fees" element={<FeesPage />} />
          </Route>
          <Route element={<RoleRoute allow={["LIBRARIAN", "STUDENT", "FACULTY"]} />}>
            <Route path="/library" element={<LibraryPage />} />
          </Route>
          <Route element={<RoleRoute allow={["PLACEMENT_OFFICER", "STUDENT"]} />}>
            <Route path="/placement" element={<PlacementPage />} />
          </Route>
          <Route path="/notices" element={<NoticesPage />} />
          <Route element={<RoleRoute allow={["STUDENT", "FACULTY", "HOD", "UNIV_ADMIN"]} />}>
            <Route path="/leave" element={<LeavePage />} />
            <Route path="/grievance" element={<GrievancePage />} />
          </Route>
          <Route element={<RoleRoute allow={[]} />}>
            <Route path="/administration" element={<AdministrationPage />} />
          </Route>
          <Route element={<RoleRoute allow={["UNIV_ADMIN", "STUDENT", "FACULTY"]} />}>
            <Route path="/documents" element={<DocumentsPage />} />
          </Route>
          <Route element={<RoleRoute allow={["STUDENT"]} />}>
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/id-card" element={<IdCardPage />} />
          </Route>
          <Route element={<RoleRoute allow={["HOSTEL_WARDEN", "STUDENT"]} />}>
            <Route path="/hostel" element={<HostelPage />} />
          </Route>
          <Route element={<RoleRoute allow={["UNIV_ADMIN", "ACCOUNTANT", "PRINCIPAL"]} />}>
            <Route path="/reports" element={<ReportsPage />} />
          </Route>
          {/* Additional module routes (students, attendance, fees, ...) mount here
              as each module is built. */}
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
