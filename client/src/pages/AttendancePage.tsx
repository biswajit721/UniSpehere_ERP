import { BarChart3, ClipboardCheck, History } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/ui/Feedback";
import { Tabs } from "../components/ui/Tabs";
import { AttendanceAnalytics } from "../features/attendance/AttendanceAnalytics";
import { AttendanceDetailModal } from "../features/attendance/AttendanceDetailModal";
import { AttendanceRecords } from "../features/attendance/AttendanceRecords";
import { MyAttendance } from "../features/attendance/MyAttendance";
import { TakeAttendance } from "../features/attendance/TakeAttendance";
import { useAuthStore } from "../store/authStore";

type TabId = "take" | "records" | "analytics";

export function AttendancePage() {
  const role = useAuthStore((s) => s.user?.role);
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState<{ id: string; mode: "view" | "edit" } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const canRecord = role === "FACULTY" || role === "HOD" || role === "PRINCIPAL" || role === "UNIV_ADMIN" || role === "SUPER_ADMIN";
  const canAnalyse = role === "HOD" || role === "PRINCIPAL" || role === "UNIV_ADMIN" || role === "SUPER_ADMIN";

  const tabs = useMemo(
    () => [
      ...(canRecord ? [{ id: "take", label: "Take attendance", icon: ClipboardCheck }] : []),
      { id: "records", label: "Records", icon: History },
      ...(canAnalyse ? [{ id: "analytics", label: "Analytics", icon: BarChart3 }] : []),
    ],
    [canRecord, canAnalyse]
  );

  const requested = params.get("tab") as TabId | null;
  const tab: TabId = tabs.some((t) => t.id === requested) ? (requested as TabId) : (tabs[0].id as TabId);
  const setTab = (id: string) => setParams({ tab: id }, { replace: true });

  const openSheet = useCallback((id: string, mode: "view" | "edit" = "view") => setOpen({ id, mode }), []);

  if (role === "STUDENT") {
    return (
      <>
        <PageHeader title="My attendance" subtitle="Your attendance across subjects, semesters and sessions" />
        <MyAttendance />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle={tab === "take" ? "Select the academic structure, then mark the students who are present" : tab === "records" ? "Review, correct or cancel attendance that has been submitted" : "Department attendance, shortage and faculty activity"}
      />
      <div className="mb-5">
        <Tabs tabs={tabs} value={tab} onChange={setTab} ariaLabel="Attendance sections" />
      </div>

      {tab === "take" && <TakeAttendance onOpenSheet={openSheet} />}
      {tab === "records" && <AttendanceRecords refreshKey={refreshKey} onOpenSheet={openSheet} />}
      {tab === "analytics" && <AttendanceAnalytics />}

      <AttendanceDetailModal
        id={open?.id ?? null}
        initialMode={open?.mode ?? "view"}
        onClose={() => setOpen(null)}
        onChanged={() => setRefreshKey((k) => k + 1)}
      />
    </>
  );
}
