import { GraduationCap, Search } from "lucide-react";
import { useState } from "react";
import { EmptyState, PageHeader, Spinner } from "../components/ui/Feedback";
import { SelectField } from "../components/ui/SelectField";
import { AcademicRecordModal } from "../features/students/AcademicRecordModal";
import { StudentRow } from "../features/students/students.types";
import { api } from "../services/api";
import { useAuthStore } from "../store/authStore";
import { toast } from "../store/toastStore";
import { academicsApi } from "../features/academics/academics.api";
import { extractErrorMessage } from "../utils/errorMessage";
import { useRemote } from "../utils/useRemote";

export function StudentsPage() {
  const role = useAuthStore((s) => s.user?.role);
  const canManage = role === "UNIV_ADMIN" || role === "SUPER_ADMIN";
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [nonce, setNonce] = useState(0);
  const [selected, setSelected] = useState<StudentRow | null>(null);

  const departments = useRemote("departments", () => api.get<{ departments: { id: string; name: string }[] }>("/departments").then((r) => r.data.departments));
  const sessions = useRemote("sessions", () => academicsApi.sessions(false));
  // debounce the search box by keying the query on the settled value
  const [settled, setSettled] = useState("");
  const list = useRemote(`students:${settled}:${departmentId}:${sessionId}:${nonce}`, () =>
    api.get<{ data: StudentRow[]; total: number }>("/students", { params: { search: settled || undefined, departmentId: departmentId || undefined, academicSessionId: sessionId || undefined, pageSize: 50 } }).then((r) => r.data)
  );

  const onSearch = (v: string) => {
    setSearch(v);
    window.clearTimeout((onSearch as any).t);
    (onSearch as any).t = window.setTimeout(() => setSettled(v.trim()), 300);
  };

  const toggleActive = async (s: StudentRow) => {
    try {
      await api.patch(`/students/${s.id}/${s.isActive ? "suspend" : "activate"}`);
      toast.success(s.isActive ? `${s.fullName} suspended.` : `${s.fullName} activated.`);
      setNonce((n) => n + 1);
    } catch (err) {
      toast.error(extractErrorMessage(err, "Could not change the account status."));
    }
  };

  const rows = list.data?.data ?? [];

  const Placement = ({ s }: { s: StudentRow }) =>
    s.currentEnrollment ? (
      <>
        <span className="font-medium text-text-primary">{s.currentEnrollment.semester}</span>
        <span className="block text-xs text-text-secondary">{s.currentEnrollment.academicSession}{s.section ? ` · Section ${s.section}` : " · no section"}</span>
      </>
    ) : (
      <span className="badge-warning">No open enrollment</span>
    );

  return (
    <div>
      <PageHeader title="Students" subtitle="Browse students, open their academic record, and manage promotion, readmission and account status." />

      <div className="card mb-4 p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_15rem_15rem]">
          <div>
            <label htmlFor="stu-search" className="field-label">Search</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
              <input id="stu-search" value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Name, roll no., registration no. or email" className="input-field pl-9" />
            </div>
          </div>
          <SelectField label="Department" value={departmentId} onChange={setDepartmentId} placeholder="All departments" loading={departments.loading} error={departments.error} onRetry={departments.reload} options={(departments.data ?? []).map((d) => ({ value: d.id, label: d.name }))} />
          <SelectField label="Academic session" value={sessionId} onChange={setSessionId} placeholder="All sessions" loading={sessions.loading} error={sessions.error} onRetry={sessions.reload} options={(sessions.data ?? []).map((s) => ({ value: s.id, label: s.isCurrent ? `${s.label} (Current)` : s.label }))} />
        </div>
      </div>

      <div className="card overflow-hidden">
        {list.loading ? (
          <div className="py-14 text-center"><Spinner label="Loading students…" /></div>
        ) : list.error ? (
          <div className="p-5"><p className="text-sm text-danger">{list.error}</p><button className="btn-secondary btn-sm mt-3" onClick={list.reload}>Retry</button></div>
        ) : rows.length === 0 ? (
          <EmptyState icon={GraduationCap} title="No students found">Register a student from the Users page, or adjust the filters.</EmptyState>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="table-base">
                <thead>
                  <tr><th>Student</th><th>Roll / Registration</th><th>Program</th><th>Batch</th><th>Current placement</th><th>Status</th><th className="text-right">Actions</th></tr>
                </thead>
                <tbody>
                  {rows.map((s) => (
                    <tr key={s.id}>
                      <td className="whitespace-nowrap font-medium text-text-primary">{s.fullName}<span className="block text-xs font-normal text-text-secondary">{s.universityId}</span></td>
                      <td className="num whitespace-nowrap text-text-secondary">{s.rollNumber}<span className="block text-xs">{s.registrationNumber ?? "—"}</span></td>
                      <td className="whitespace-nowrap text-text-secondary">{s.program}<span className="block text-xs">{s.department}</span></td>
                      <td className="whitespace-nowrap text-text-secondary">{s.batch}</td>
                      <td className="whitespace-nowrap"><Placement s={s} /></td>
                      <td><span className={s.isActive ? "badge-success" : "badge-danger"}>{s.isActive ? "Active" : "Suspended"}</span></td>
                      <td className="whitespace-nowrap text-right">
                        <button className="btn-secondary btn-sm" onClick={() => setSelected(s)}>Academic record</button>
                        {canManage && <button onClick={() => toggleActive(s)} className={`btn-ghost btn-sm ml-1 ${s.isActive ? "!text-danger" : "!text-success"}`}>{s.isActive ? "Suspend" : "Activate"}</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-border md:hidden">
              {rows.map((s) => (
                <li key={s.id} className="space-y-2.5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text-primary">{s.fullName}</p>
                      <p className="num text-xs text-text-secondary">{s.rollNumber}{s.registrationNumber ? ` · ${s.registrationNumber}` : ""}</p>
                    </div>
                    <span className={s.isActive ? "badge-success" : "badge-danger"}>{s.isActive ? "Active" : "Suspended"}</span>
                  </div>
                  <p className="text-xs text-text-secondary">{s.program} · Batch {s.batch}</p>
                  <div className="text-sm"><Placement s={s} /></div>
                  <div className="flex gap-2">
                    <button className="btn-secondary btn-sm flex-1" onClick={() => setSelected(s)}>Academic record</button>
                    {canManage && <button onClick={() => toggleActive(s)} className="btn-ghost btn-sm">{s.isActive ? "Suspend" : "Activate"}</button>}
                  </div>
                </li>
              ))}
            </ul>
            <p className="border-t border-border px-4 py-2.5 text-xs text-text-secondary">Showing {rows.length} of {list.data?.total} students</p>
          </>
        )}
      </div>

      {selected && <AcademicRecordModal student={selected} onClose={() => setSelected(null)} onChanged={() => setNonce((n) => n + 1)} />}
    </div>
  );
}
