import { BookOpen, CalendarRange, Clock, UserCheck } from "lucide-react";
import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/ui/Feedback";
import { Tabs } from "../components/ui/Tabs";
import { AssignmentsTab } from "../features/academics/AssignmentsTab";
import { PeriodsTab } from "../features/academics/PeriodsTab";
import { SessionsTab } from "../features/academics/SessionsTab";
import { SubjectsTab } from "../features/academics/SubjectsTab";
import { useAuthStore } from "../store/authStore";

type TabId = "subjects" | "assignments" | "sessions" | "periods";

/**
 * Academics is the source of truth for the academic structure. Attendance, registration and
 * promotion all read from what is configured here.
 */
export function AcademicsPage() {
  const role = useAuthStore((s) => s.user?.role);
  const [params, setParams] = useSearchParams();

  const isAdmin = role === "SUPER_ADMIN" || role === "UNIV_ADMIN";
  const canEditStructure = isAdmin || role === "HOD"; // subjects + faculty assignments (HOD limited to own department by the server)

  const tabs = useMemo(
    () => [
      { id: "subjects", label: "Subjects", icon: BookOpen },
      ...(role !== "STUDENT" ? [{ id: "assignments", label: "Faculty assignments", icon: UserCheck }] : []),
      ...(role !== "STUDENT" ? [{ id: "sessions", label: "Academic sessions", icon: CalendarRange }] : []),
      ...(role !== "STUDENT" ? [{ id: "periods", label: "Periods", icon: Clock }] : []),
    ],
    [role]
  );
  const requested = params.get("tab");
  const tab = (tabs.some((t) => t.id === requested) ? requested : "subjects") as TabId;

  return (
    <div>
      <PageHeader title="Academics" subtitle="Subjects, faculty allocation, academic sessions and the period grid. Attendance and student records are built on these." />
      <div className="mb-5"><Tabs tabs={tabs} value={tab} onChange={(id) => setParams({ tab: id }, { replace: true })} ariaLabel="Academics sections" /></div>
      {tab === "subjects" && <SubjectsTab canEdit={canEditStructure} />}
      {tab === "assignments" && <AssignmentsTab canEdit={canEditStructure} />}
      {tab === "sessions" && <SessionsTab canEdit={isAdmin} />}
      {tab === "periods" && <PeriodsTab canEdit={isAdmin} />}
    </div>
  );
}
