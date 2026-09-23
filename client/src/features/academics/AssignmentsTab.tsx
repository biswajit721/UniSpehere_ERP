import { Loader2, Trash2, UserCheck } from "lucide-react";
import { useState } from "react";
import { Alert, EmptyState, Spinner } from "../../components/ui/Feedback";
import { SelectField } from "../../components/ui/SelectField";
import { api } from "../../services/api";
import { useAuthStore } from "../../store/authStore";
import { toast } from "../../store/toastStore";
import { extractErrorMessage } from "../../utils/errorMessage";
import { useRemote } from "../../utils/useRemote";
import { Department } from "../departments/departments.types";
import { FacultyRow } from "../faculty/faculty.types";
import { academicsApi } from "./academics.api";

/** Who teaches which subject to which section, per academic session. */
export function AssignmentsTab({ canEdit }: { canEdit: boolean }) {
  const role = useAuthStore((s) => s.user?.role);
  const [filterSession, setFilterSession] = useState("");
  const [nonce, setNonce] = useState(0);

  // create form
  const [sessionId, setSessionId] = useState("");
  const [programId, setProgramId] = useState("");
  const [semesterId, setSemesterId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [facultyId, setFacultyId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessions = useRemote("sessions", () => academicsApi.sessions(false));
  const tree = useRemote<Department[]>(canEdit ? "tree" : null, () => api.get("/departments/full").then(({ data }) => data.departments));
  const me = useRemote(role === "HOD" ? "me" : null, () => api.get<{ faculty: { departmentId: string } }>("/faculty/me").then((r) => r.data.faculty));
  const faculty = useRemote(canEdit ? "faculty" : null, () => api.get<{ data: FacultyRow[] }>("/faculty", { params: { pageSize: 100 } }).then((r) => r.data.data));
  const list = useRemote(`assign:${filterSession}:${nonce}`, () => academicsApi.assignments({ academicSessionId: filterSession }));
  const subjects = useRemote(programId && semesterId ? `subj:${programId}:${semesterId}` : null, () => academicsApi.subjects({ programId, semesterId }));

  // An HOD only sees their own department's programs; the server enforces it regardless.
  const departments = (tree.data ?? []).filter((d) => role !== "HOD" || !me.data || d.id === me.data.departmentId);
  const programs = departments.flatMap((d) => d.programs.map((p) => ({ ...p, dept: d.name })));
  const program = programs.find((p) => p.id === programId);
  const sections = (program?.batches ?? []).flatMap((b) => b.sections.map((s) => ({ value: s.id, label: `${b.label} · Section ${s.name}` })));

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      await academicsApi.createAssignment({ academicSessionId: sessionId, subjectId, sectionId, facultyId });
      toast.success("Faculty assigned. They can now take attendance for that class.");
      setSubjectId(""); setFacultyId("");
      setNonce((n) => n + 1);
    } catch (err) {
      setError(extractErrorMessage(err, "Could not assign the faculty member."));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Remove this assignment? The faculty member will no longer be able to take attendance for the class.")) return;
    try {
      await academicsApi.deleteAssignment(id);
      toast.success("Assignment removed.");
      setNonce((n) => n + 1);
    } catch (err) {
      toast.error(extractErrorMessage(err, "Could not remove the assignment."));
    }
  };

  const rows = list.data ?? [];

  return (
    <div className="space-y-4">
      {canEdit && (
        <section className="card p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-text-primary">Assign faculty to a class</h2>
          <p className="mt-0.5 text-xs text-text-secondary">A section-level assignment overrides the subject’s default faculty for that section. Only assigned faculty can take attendance for it.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <SelectField label="Academic session" required value={sessionId} onChange={setSessionId} placeholder="Select academic session" loading={sessions.loading} error={sessions.error} onRetry={sessions.reload} options={(sessions.data ?? []).filter((s) => s.isActive).map((s) => ({ value: s.id, label: s.isCurrent ? `${s.label} (Current)` : s.label }))} />
            <SelectField label="Program" required value={programId} onChange={(v) => { setProgramId(v); setSemesterId(""); setSectionId(""); setSubjectId(""); }} loading={tree.loading} error={tree.error} onRetry={tree.reload} options={programs.map((p) => ({ value: p.id, label: `${p.name} · ${p.dept}` }))} />
            <SelectField label="Semester" required value={semesterId} onChange={(v) => { setSemesterId(v); setSubjectId(""); }} waitingFor={!programId ? "program" : null} options={(program?.semesters ?? []).map((s) => ({ value: s.id, label: s.name }))} />
            <SelectField label="Section" required value={sectionId} onChange={setSectionId} waitingFor={!programId ? "program" : null} emptyText="No sections" options={sections} />
            <SelectField label="Subject" required value={subjectId} onChange={setSubjectId} waitingFor={!semesterId ? "semester" : null} loading={subjects.loading} error={subjects.error} onRetry={subjects.reload} emptyText="No subjects in this semester" options={(subjects.data ?? []).map((s) => ({ value: s.id, label: `${s.name}${s.isElective ? " (Elective)" : ""}` }))} />
            <SelectField label="Faculty" required value={facultyId} onChange={setFacultyId} loading={faculty.loading} error={faculty.error} onRetry={faculty.reload} options={(faculty.data ?? []).map((f) => ({ value: f.id, label: `${f.fullName} — ${f.department}` }))} />
          </div>
          {error && <Alert tone="danger" className="mt-3">{error}</Alert>}
          <div className="mt-4 flex justify-end">
            <button className="btn-primary" onClick={create} disabled={busy || !sessionId || !programId || !semesterId || !sectionId || !subjectId || !facultyId}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <UserCheck className="h-4 w-4" aria-hidden="true" />}Assign faculty
            </button>
          </div>
        </section>
      )}

      <div className="card p-4"><div className="max-w-sm"><SelectField label="Show assignments for" value={filterSession} onChange={setFilterSession} placeholder="All sessions" loading={sessions.loading} error={sessions.error} onRetry={sessions.reload} options={(sessions.data ?? []).map((s) => ({ value: s.id, label: s.isCurrent ? `${s.label} (Current)` : s.label }))} /></div></div>

      <div className="card overflow-hidden">
        {list.loading ? <div className="py-12 text-center"><Spinner label="Loading assignments…" /></div>
        : list.error ? <div className="p-5 text-sm text-danger">{list.error} <button className="btn-secondary btn-sm ml-2" onClick={list.reload}>Retry</button></div>
        : rows.length === 0 ? <EmptyState icon={UserCheck} title="No assignments">{role === "FACULTY" ? "You have no section-level assignments. Classes where you are the subject’s default faculty still appear when taking attendance." : "Assign faculty above to control who can take attendance for each class."}</EmptyState>
        : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Session</th><th>Program · Semester</th><th>Section</th><th>Subject</th><th>Faculty</th>{canEdit && <th />}</tr></thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id}>
                    <td className="whitespace-nowrap text-text-secondary">{a.academicSession.label}</td>
                    <td className="whitespace-nowrap text-text-secondary">{a.program?.name ?? "—"} · {a.semester?.name ?? "—"}</td>
                    <td className="whitespace-nowrap">Section {a.section.name}<span className="block text-xs text-text-secondary">Batch {a.section.batchLabel}</span></td>
                    <td className="font-medium text-text-primary">{a.subject.name}<span className="block text-xs font-normal text-text-secondary">{a.subject.code}</span></td>
                    <td className="whitespace-nowrap">{a.faculty.fullName}<span className="block text-xs text-text-secondary">{a.faculty.employeeId}</span></td>
                    {canEdit && <td className="text-right"><button className="btn-ghost btn-sm !px-2 !text-danger" onClick={() => remove(a.id)} aria-label={`Remove ${a.faculty.fullName} from ${a.subject.name}`}><Trash2 className="h-3.5 w-3.5" /></button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
