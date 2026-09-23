import { BookOpen, Link2, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Alert, EmptyState, Spinner } from "../../components/ui/Feedback";
import { Modal } from "../../components/ui/Modal";
import { SelectField } from "../../components/ui/SelectField";
import { api } from "../../services/api";
import { toast } from "../../store/toastStore";
import { extractErrorMessage } from "../../utils/errorMessage";
import { useRemote } from "../../utils/useRemote";
import { Department } from "../departments/departments.types";
import { FacultyRow } from "../faculty/faculty.types";
import { academicsApi, SubjectRow } from "./academics.api";

interface Props { canEdit: boolean }

function SubjectForm({ subject, tree, onClose, onSaved }: { subject: SubjectRow | null; tree: Department[]; onClose: () => void; onSaved: () => void }) {
  const editing = Boolean(subject);
  const needsLink = editing && !subject!.isMapped;
  const [name, setName] = useState(subject?.name ?? "");
  const [code, setCode] = useState(subject?.code ?? "");
  const [credits, setCredits] = useState(String(subject?.credits ?? ""));
  const [type, setType] = useState<"THEORY" | "PRACTICAL">(subject?.type ?? "THEORY");
  const [isElective, setIsElective] = useState(subject?.isElective ?? false);
  const [departmentId, setDepartmentId] = useState(subject?.departmentId ?? "");
  const [programId, setProgramId] = useState(subject?.programId ?? "");
  const [semesterId, setSemesterId] = useState(subject?.semesterId ?? "");
  const [facultyId, setFacultyId] = useState(subject?.facultyId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const faculty = useRemote("faculty", () => api.get<{ data: FacultyRow[] }>("/faculty", { params: { pageSize: 100 } }).then((r) => r.data.data));
  const department = tree.find((d) => d.id === departmentId);
  const program = department?.programs.find((p) => p.id === programId);
  // Programs can't change once a subject is linked (its history hangs off it); semesters can move within the program.
  const lockProgram = editing && subject!.isMapped;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      if (editing) {
        await academicsApi.updateSubject(subject!.id, {
          name, credits: Number(credits), type, isElective, facultyId: facultyId || null,
          ...(program || subject!.programId ? { programId: lockProgram ? undefined : programId || undefined, semesterId: semesterId || undefined } : {}),
        });
      } else {
        await academicsApi.createSubject({ name, code, credits: Number(credits), type, isElective, programId, semesterId, facultyId: facultyId || undefined });
      }
      toast.success(editing ? "Subject updated." : "Subject created.");
      onSaved();
    } catch (err) {
      setError(extractErrorMessage(err, "Could not save the subject."));
    } finally {
      setBusy(false);
    }
  };

  const ready = name.trim() && Number(credits) > 0 && (editing ? (!needsLink || (programId && semesterId)) : code.trim().length >= 2 && programId && semesterId);

  return (
    <Modal open onClose={onClose} dismissible={!busy} size="md" title={needsLink ? "Link subject to a program" : editing ? "Edit subject" : "Add subject"}
      description={needsLink ? "This subject predates the academic structure. Choose the program and semester it is taught in so it can be used for attendance." : undefined}
      footer={<><button className="btn-secondary" onClick={onClose} disabled={busy}>Cancel</button><button className="btn-primary" onClick={save} disabled={busy || !ready}>{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}{editing ? "Save changes" : "Add subject"}</button></>}>
      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><label className="field-label">Subject name<span className="ml-0.5 text-danger">*</span></label><input className="input-field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Database Management System" /></div>
        <div><label className="field-label">Subject code<span className="ml-0.5 text-danger">*</span></label><input className="input-field" value={code} onChange={(e) => setCode(e.target.value)} disabled={editing} placeholder="MCA301" /></div>
        <div><label className="field-label">Credits<span className="ml-0.5 text-danger">*</span></label><input className="input-field" type="number" min={1} max={10} value={credits} onChange={(e) => setCredits(e.target.value)} placeholder="4" /></div>
        <SelectField label="Department" required value={departmentId} onChange={(v) => { setDepartmentId(v); setProgramId(""); setSemesterId(""); }} disabled={editing} options={tree.map((d) => ({ value: d.id, label: d.name }))} />
        <SelectField label="Program" required value={programId} onChange={(v) => { setProgramId(v); setSemesterId(""); }} disabled={lockProgram} waitingFor={!departmentId ? "department" : null} emptyText="No programs" options={(department?.programs ?? []).map((p) => ({ value: p.id, label: p.name }))} />
        <SelectField label="Semester" required value={semesterId} onChange={setSemesterId} waitingFor={!programId ? "program" : null} emptyText="No semesters" options={(program?.semesters ?? []).map((s) => ({ value: s.id, label: s.name }))} hint="Semesters come from the program's duration" />
        <SelectField label="Type" value={type} onChange={(v) => setType((v || "THEORY") as "THEORY" | "PRACTICAL")} placeholder="Theory" options={[{ value: "THEORY", label: "Theory" }, { value: "PRACTICAL", label: "Practical" }]} />
        <SelectField label="Default faculty (optional)" value={facultyId} onChange={setFacultyId} placeholder="Unassigned" loading={faculty.loading} error={faculty.error} onRetry={faculty.reload} options={(faculty.data ?? []).map((f) => ({ value: f.id, label: `${f.fullName} — ${f.department}` }))} hint="Teaches every section unless a section-level assignment says otherwise" />
        <label className="flex cursor-pointer items-center gap-2 self-end pb-2 text-sm text-text-primary sm:col-span-2"><input type="checkbox" className="h-4 w-4" checked={isElective} onChange={(e) => setIsElective(e.target.checked)} />Elective (only students who register for it attend)</label>
      </div>
    </Modal>
  );
}

export function SubjectsTab({ canEdit }: Props) {
  const [departmentId, setDepartmentId] = useState("");
  const [programId, setProgramId] = useState("");
  const [semesterId, setSemesterId] = useState("");
  const [unmappedOnly, setUnmappedOnly] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [form, setForm] = useState<null | { subject: SubjectRow | null }>(null);

  const tree = useRemote<Department[]>("tree", () => api.get("/departments/full").then(({ data }) => data.departments));
  const subjects = useRemote(`subjects:${departmentId}:${programId}:${semesterId}:${unmappedOnly}:${nonce}`, () => academicsApi.subjects({ departmentId, programId, semesterId, unmapped: unmappedOnly ? "true" : undefined }));

  const dept = tree.data?.find((d) => d.id === departmentId);
  const prog = dept?.programs.find((p) => p.id === programId);
  const rows = subjects.data ?? [];
  const unmappedCount = useMemo(() => rows.filter((s) => !s.isMapped).length, [rows]);

  const remove = async (s: SubjectRow) => {
    if (!window.confirm(`Delete ${s.name}? Attendance already recorded for it is kept.`)) return;
    try {
      await academicsApi.deleteSubject(s.id);
      toast.success("Subject deleted.");
      setNonce((n) => n + 1);
    } catch (err) {
      toast.error(extractErrorMessage(err, "Could not delete the subject."));
    }
  };

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SelectField label="Department" value={departmentId} onChange={(v) => { setDepartmentId(v); setProgramId(""); setSemesterId(""); }} placeholder="All departments" loading={tree.loading} error={tree.error} onRetry={tree.reload} options={(tree.data ?? []).map((d) => ({ value: d.id, label: d.name }))} />
          <SelectField label="Program" value={programId} onChange={(v) => { setProgramId(v); setSemesterId(""); }} placeholder="All programs" waitingFor={!departmentId ? "department" : null} options={(dept?.programs ?? []).map((p) => ({ value: p.id, label: p.name }))} />
          <SelectField label="Semester" value={semesterId} onChange={setSemesterId} placeholder="All semesters" waitingFor={!programId ? "program" : null} options={(prog?.semesters ?? []).map((s) => ({ value: s.id, label: s.name }))} />
          {canEdit && <div className="flex items-end justify-between gap-3">
            <label className="flex cursor-pointer items-center gap-2 pb-2.5 text-sm text-text-primary"><input type="checkbox" className="h-4 w-4" checked={unmappedOnly} onChange={(e) => setUnmappedOnly(e.target.checked)} />Needs linking only</label>
            <button className="btn-primary" onClick={() => setForm({ subject: null })}><Plus className="h-4 w-4" aria-hidden="true" />Add subject</button>
          </div>}
        </div>
      </div>

      {canEdit && unmappedCount > 0 && !unmappedOnly && (
        <Alert tone="warning" title={`${unmappedCount} subject${unmappedCount === 1 ? "" : "s"} not linked to a program and semester`}>
          These cannot be used for attendance until you link them. Use the link button on the highlighted rows.
        </Alert>
      )}

      <div className="card overflow-hidden">
        {subjects.loading ? <div className="py-12 text-center"><Spinner label="Loading subjects…" /></div>
        : subjects.error ? <div className="p-5 text-sm text-danger">{subjects.error} <button className="btn-secondary btn-sm ml-2" onClick={subjects.reload}>Retry</button></div>
        : rows.length === 0 ? <EmptyState icon={BookOpen} title="No subjects found">{canEdit ? "Add a subject to a program’s semester to start." : "Nothing matches these filters."}</EmptyState>
        : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="table-base">
                <thead><tr><th>Subject</th><th>Code</th><th>Program</th><th>Semester</th><th>Credits</th><th>Type</th><th>Default faculty</th>{canEdit && <th className="text-right">Actions</th>}</tr></thead>
                <tbody>
                  {rows.map((s) => (
                    <tr key={s.id} className={s.isMapped ? "" : "bg-warning/[0.06]"}>
                      <td className="font-medium text-text-primary">{s.name}{s.isElective && <span className="badge-info ml-2">Elective</span>}</td>
                      <td className="num text-text-secondary">{s.code}</td>
                      <td className="whitespace-nowrap text-text-secondary">{s.program ?? <span className="badge-warning">Not linked</span>}<span className="block text-xs">{s.department}</span></td>
                      <td className="whitespace-nowrap text-text-secondary">{s.semesterName ?? `Sem ${s.semester}`}</td>
                      <td className="num text-text-secondary">{s.credits}</td>
                      <td className="text-text-secondary">{s.type === "THEORY" ? "Theory" : "Practical"}</td>
                      <td className="whitespace-nowrap text-text-secondary">{s.facultyName ?? "Unassigned"}</td>
                      {canEdit && <td className="whitespace-nowrap text-right">
                        <button className="btn-ghost btn-sm !px-2" onClick={() => setForm({ subject: s })} aria-label={`${s.isMapped ? "Edit" : "Link"} ${s.name}`}>{s.isMapped ? <Pencil className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}</button>
                        <button className="btn-ghost btn-sm !px-2 !text-danger" onClick={() => remove(s)} aria-label={`Delete ${s.name}`}><Trash2 className="h-3.5 w-3.5" /></button>
                      </td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-border md:hidden">
              {rows.map((s) => (
                <li key={s.id} className={`space-y-1.5 p-4 ${s.isMapped ? "" : "bg-warning/[0.06]"}`}>
                  <div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold text-text-primary">{s.name}{s.isElective && <span className="badge-info ml-2">Elective</span>}</p><span className="num text-xs text-text-secondary">{s.code}</span></div>
                  <p className="text-xs text-text-secondary">{s.program ?? "Not linked to a program"} · {s.semesterName ?? `Sem ${s.semester}`} · {s.credits} credits · {s.type === "THEORY" ? "Theory" : "Practical"}</p>
                  <p className="text-xs text-text-secondary">Faculty: {s.facultyName ?? "Unassigned"}</p>
                  {canEdit && <div className="flex gap-2 pt-1"><button className="btn-secondary btn-sm" onClick={() => setForm({ subject: s })}>{s.isMapped ? "Edit" : "Link"}</button><button className="btn-ghost btn-sm !text-danger" onClick={() => remove(s)}>Delete</button></div>}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {form && tree.data && <SubjectForm subject={form.subject} tree={tree.data} onClose={() => setForm(null)} onSaved={() => { setForm(null); setNonce((n) => n + 1); }} />}
    </div>
  );
}
