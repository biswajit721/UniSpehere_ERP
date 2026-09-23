import { ArrowUpRight, Ban, Loader2, Repeat2, Shuffle, Trash2 } from "lucide-react";
import { ReactNode, useMemo, useState } from "react";
import { Alert, Spinner } from "../../components/ui/Feedback";
import { Modal } from "../../components/ui/Modal";
import { SelectField } from "../../components/ui/SelectField";
import { api } from "../../services/api";
import { toast } from "../../store/toastStore";
import { formatShortDate, todayLocal } from "../../utils/dates";
import { extractErrorMessage } from "../../utils/errorMessage";
import { useRemote } from "../../utils/useRemote";
import { academicsApi } from "../academics/academics.api";
import { Department } from "../departments/departments.types";
import { Enrollment, EnrollmentStatus, EnrollmentType, StudentRow } from "./students.types";

const TYPE_LABEL: Record<EnrollmentType, string> = { REGULAR: "Regular admission", LATERAL: "Lateral entry", PROMOTION: "Promotion", READMISSION: "Readmission", REPEAT: "Repeat semester", TRANSFER: "Section / batch change" };
const STATUS_BADGE: Record<EnrollmentStatus, { label: string; cls: string }> = {
  ACTIVE: { label: "Current", cls: "badge-success" },
  PROMOTED: { label: "Promoted", cls: "badge-neutral" },
  COMPLETED: { label: "Completed", cls: "badge-neutral" },
  REPEATED: { label: "Repeated", cls: "badge-warning" },
  DETAINED: { label: "Detained", cls: "badge-danger" },
  DEFERRED: { label: "Deferred", cls: "badge-warning" },
  WITHDRAWN: { label: "Withdrawn", cls: "badge-danger" },
  TRANSFERRED: { label: "Transferred out", cls: "badge-neutral" },
};

type Action = "promote" | "readmit" | "transfer" | "close" | null;

interface Props {
  student: StudentRow;
  onClose: () => void;
  /** refresh the student list behind the dialog */
  onChanged: () => void;
}

function Textarea({ label, value, onChange, required, placeholder }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; placeholder?: string }) {
  return (
    <div className="sm:col-span-2">
      <label className="field-label">{label}{required && <span className="ml-0.5 text-danger" aria-hidden="true">*</span>}</label>
      <textarea className="input-field min-h-[4.5rem]" value={value} onChange={(e) => onChange(e.target.value)} maxLength={500} placeholder={placeholder} />
    </div>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <input type="date" className="input-field" value={value} onChange={(e) => onChange(e.target.value)} />
      <p className="mt-1 text-xs text-text-muted">The change takes effect on this date; earlier attendance is unaffected.</p>
    </div>
  );
}

export function AcademicRecordModal({ student, onClose, onChanged }: Props) {
  const [nonce, setNonce] = useState(0);
  const history = useRemote(`enr:${student.id}:${nonce}`, () => api.get<{ enrollments: Enrollment[] }>(`/students/${student.id}/enrollments`).then((r) => r.data.enrollments));
  const tree = useRemote<Department[]>("tree", () => api.get("/departments/full").then(({ data }) => data.departments));
  const sessions = useRemote("sessions", () => academicsApi.sessions(true));

  const [action, setAction] = useState<Action>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- shared form fields
  const [sessionId, setSessionId] = useState("");
  const [semesterId, setSemesterId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [effective, setEffective] = useState(todayLocal());
  const [note, setNote] = useState("");
  const [readmitType, setReadmitType] = useState<"READMISSION" | "REPEAT" | "">("");
  const [reason, setReason] = useState<"BACKLOG" | "ACADEMIC_REPEAT" | "OTHER" | "">("");
  const [admissionYear, setAdmissionYear] = useState("");
  const [closeStatus, setCloseStatus] = useState<"DEFERRED" | "WITHDRAWN" | "DETAINED" | "COMPLETED" | "">("");

  // ---- backlog / elective registration
  const [regType, setRegType] = useState<"BACKLOG" | "ELECTIVE" | "">("");
  const [regSubjectId, setRegSubjectId] = useState("");
  const [regSectionId, setRegSectionId] = useState("");

  const rows = history.data ?? [];
  const current = rows.find((e) => e.isCurrent) ?? null;
  const program = useMemo(() => tree.data?.flatMap((d) => d.programs).find((p) => p.id === student.programId) ?? null, [tree.data, student.programId]);
  const batches = program?.batches ?? [];
  const chosenBatch = batches.find((b) => b.id === (batchId || current?.batch.id));
  const semesters = program?.semesters ?? [];
  const allSections = batches.flatMap((b) => b.sections.map((s) => ({ value: s.id, label: `${b.label} · Section ${s.name}` })));

  const subjects = useRemote(program && current && regType ? `subj:${program.id}:${regType}:${current.semester.number}` : null, () => academicsApi.subjects({ programId: program!.id }));
  const eligibleSubjects = (subjects.data ?? []).filter((s) => (regType === "BACKLOG" ? s.semester < (current?.semester.number ?? 0) : s.isElective && s.semester === current?.semester.number));

  const open = (a: Action) => {
    setAction(a);
    setError(null);
    setSessionId(""); setSemesterId(""); setSectionId(""); setNote(""); setReadmitType(""); setReason(""); setAdmissionYear(""); setCloseStatus("");
    setBatchId(a === "readmit" ? "" : current?.batch.id ?? "");
    setEffective(todayLocal());
  };

  const run = async (path: string, body: Record<string, unknown>, success: string) => {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/students/${student.id}/${path}`, body);
      toast.success(success);
      setAction(null);
      setNonce((n) => n + 1);
      onChanged();
    } catch (err) {
      setError(extractErrorMessage(err, "The change could not be saved. Nothing was modified."));
    } finally {
      setBusy(false);
    }
  };

  const submitAction = () => {
    if (action === "promote") return run("enrollments/promote", { academicSessionId: sessionId, semesterId, batchId: batchId || undefined, sectionId: sectionId || null, effectiveDate: effective, reasonNote: note || undefined }, "Student promoted. Their earlier enrollment is kept in the history below.");
    if (action === "readmit") return run("enrollments/readmit", { enrollmentType: readmitType, academicSessionId: sessionId, semesterId, batchId, sectionId: sectionId || null, readmissionReason: reason, reasonNote: note || undefined, admissionYear: admissionYear ? Number(admissionYear) : undefined, effectiveDate: effective }, "Readmission recorded. Their earlier enrollment is kept in the history below.");
    if (action === "transfer") return run("enrollments/transfer", { batchId: batchId && batchId !== current?.batch.id ? batchId : undefined, sectionId: sectionId || null, effectiveDate: effective, reasonNote: note }, "Placement changed. Attendance already taken stays with the previous section.");
    if (action === "close") return run("enrollments/close", { status: closeStatus, effectiveDate: effective, reasonNote: note || undefined }, "Enrollment closed.");
  };

  const canSubmit =
    !busy &&
    ((action === "promote" && sessionId && semesterId) ||
      (action === "readmit" && readmitType && sessionId && semesterId && batchId && reason && (reason !== "OTHER" || note.trim())) ||
      (action === "transfer" && note.trim().length >= 3 && (sectionId || (batchId && batchId !== current?.batch.id))) ||
      (action === "close" && closeStatus));

  const registerSubject = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/students/${student.id}/subject-registrations`, { subjectId: regSubjectId, sectionId: regSectionId, type: regType });
      toast.success("Subject registered. The student now appears on that class's attendance list.");
      setRegType(""); setRegSubjectId(""); setRegSectionId("");
      setNonce((n) => n + 1);
    } catch (err) {
      setError(extractErrorMessage(err, "Could not register the subject."));
    } finally {
      setBusy(false);
    }
  };
  const removeRegistration = async (id: string) => {
    try {
      await api.delete(`/students/subject-registrations/${id}`);
      toast.success("Registration removed.");
      setNonce((n) => n + 1);
    } catch (err) {
      toast.error(extractErrorMessage(err, "Could not remove the registration."));
    }
  };

  const sessionOptions = (sessions.data ?? []).map((s) => ({ value: s.id, label: s.isCurrent ? `${s.label} (Current)` : s.label }));
  const promoteSemesters = semesters.filter((s) => s.number > (current?.semester.number ?? 0));
  const sameBatchSections = (chosenBatch?.sections ?? []).filter((s) => s.id !== current?.section?.id);

  const form: ReactNode =
    action === null ? null : (
      <div className="rounded-xl border border-primary/30 bg-primary/[0.04] p-4">
        <p className="mb-3 text-sm font-semibold text-text-primary">
          {{ promote: "Promote to a later semester", readmit: "Readmit or repeat a semester", transfer: "Change section / batch", close: "Defer, withdraw or close enrollment" }[action]}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {action === "promote" && (
            <>
              <SelectField label="Academic session" required value={sessionId} onChange={setSessionId} loading={sessions.loading} error={sessions.error} onRetry={sessions.reload} options={sessionOptions} placeholder="Select academic session" />
              <SelectField label="New semester" required value={semesterId} onChange={setSemesterId} emptyText="No later semester in this program" options={promoteSemesters.map((s) => ({ value: s.id, label: s.name }))} />
              <SelectField label="Batch" value={batchId} onChange={(v) => { setBatchId(v); setSectionId(""); }} options={batches.map((b) => ({ value: b.id, label: b.id === current?.batch.id ? `${b.label} (current)` : b.label }))} />
              <SelectField label="Section (optional)" value={sectionId} onChange={setSectionId} placeholder="Unassigned" options={(chosenBatch?.sections ?? []).map((s) => ({ value: s.id, label: `Section ${s.name}` }))} hint="A student appears on attendance lists only when a section is set" />
              <DateField label="Effective date" value={effective} onChange={setEffective} />
              <Textarea label="Note (optional)" value={note} onChange={setNote} />
            </>
          )}
          {action === "readmit" && (
            <>
              <SelectField label="Type" required value={readmitType} onChange={(v) => setReadmitType(v as "READMISSION" | "REPEAT")} placeholder="Select type" options={[{ value: "REPEAT", label: "Repeat semester" }, { value: "READMISSION", label: "Readmission (after a break)" }]} />
              <SelectField label="Reason" required value={reason} onChange={(v) => setReason(v as typeof reason)} placeholder="Select reason" options={[{ value: "BACKLOG", label: "Backlog" }, { value: "ACADEMIC_REPEAT", label: "Academic repeat" }, { value: "OTHER", label: "Other" }]} />
              <SelectField label="Academic session" required value={sessionId} onChange={setSessionId} loading={sessions.loading} error={sessions.error} onRetry={sessions.reload} options={sessionOptions} placeholder="Select academic session" />
              <SelectField label="Batch" required value={batchId} onChange={(v) => { setBatchId(v); setSectionId(""); }} placeholder="Select batch" options={batches.map((b) => ({ value: b.id, label: b.label }))} hint="Readmitted students usually join the junior batch" />
              <SelectField label="Semester" required value={semesterId} onChange={setSemesterId} placeholder="Select semester" options={semesters.map((s) => ({ value: s.id, label: s.name }))} />
              <SelectField label="Section (optional)" value={sectionId} onChange={setSectionId} placeholder="Unassigned" waitingFor={!batchId ? "batch" : null} options={(chosenBatch?.sections ?? []).map((s) => ({ value: s.id, label: `Section ${s.name}` }))} />
              <div>
                <label className="field-label">Readmission year (optional)</label>
                <input type="number" className="input-field" value={admissionYear} onChange={(e) => setAdmissionYear(e.target.value)} placeholder="Defaults to the session's start year" />
              </div>
              <DateField label="Effective date" value={effective} onChange={setEffective} />
              <Textarea label="Note" required={reason === "OTHER"} value={note} onChange={setNote} placeholder={reason === "OTHER" ? "Describe the reason" : "Optional"} />
            </>
          )}
          {action === "transfer" && (
            <>
              <SelectField label="Batch" value={batchId} onChange={(v) => { setBatchId(v); setSectionId(""); }} options={batches.map((b) => ({ value: b.id, label: b.id === current?.batch.id ? `${b.label} (current)` : b.label }))} />
              <SelectField label="New section" value={sectionId} onChange={setSectionId} placeholder="Select section" emptyText="No other section" options={sameBatchSections.map((s) => ({ value: s.id, label: `Section ${s.name}` }))} />
              <DateField label="Effective date" value={effective} onChange={setEffective} />
              <Textarea label="Reason" required value={note} onChange={setNote} placeholder="e.g. Timetable clash, section rebalancing" />
            </>
          )}
          {action === "close" && (
            <>
              <SelectField label="Outcome" required value={closeStatus} onChange={(v) => setCloseStatus(v as typeof closeStatus)} placeholder="Select outcome" options={[{ value: "DEFERRED", label: "Deferred (academic break)" }, { value: "WITHDRAWN", label: "Withdrawn" }, { value: "DETAINED", label: "Detained" }, { value: "COMPLETED", label: "Completed" }]} />
              <DateField label="Effective date" value={effective} onChange={setEffective} />
              <Textarea label="Note (optional)" value={note} onChange={setNote} />
            </>
          )}
        </div>
        {error && <Alert tone="danger" className="mt-3">{error}</Alert>}
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button className="btn-secondary" onClick={() => setAction(null)} disabled={busy}>Cancel</button>
          <button className="btn-primary" onClick={submitAction} disabled={!canSubmit}>{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}Save change</button>
        </div>
      </div>
    );

  return (
    <Modal open onClose={onClose} size="lg" title={student.fullName} description={`${student.rollNumber}${student.registrationNumber ? ` · ${student.registrationNumber}` : ""} · ${student.program}`}>
      {history.loading && <div className="py-10 text-center"><Spinner label="Loading academic record…" /></div>}
      {history.error && <Alert tone="danger" action={<button className="btn-secondary btn-sm" onClick={history.reload}>Retry</button>}>{history.error}</Alert>}

      {!history.loading && !history.error && (
        <div className="space-y-6">
          {/* current placement */}
          {current ? (
            <section className="rounded-xl border border-border bg-surface p-4">
              <p className="text-xs font-medium text-text-secondary">Current placement</p>
              <p className="mt-1 text-lg font-semibold text-text-primary">{current.semester.name}{current.section ? ` · Section ${current.section.name}` : " · No section"}</p>
              <p className="text-sm text-text-secondary">{current.academicSession.label} · {current.program.name} · Batch {current.batch.label} · since {formatShortDate(current.admissionDate)}</p>
            </section>
          ) : (
            <Alert tone="warning" title="No open enrollment">This student is not currently enrolled (deferred, withdrawn or detained). Use “Readmit / repeat” to enrol them again. They will not appear on attendance lists until then.</Alert>
          )}
          {current && !current.section && <Alert tone="info">This student has no section, so they will not appear on any attendance list. Use “Change section”.</Alert>}

          {/* actions */}
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary btn-sm" onClick={() => open("promote")} disabled={!current}><ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />Promote</button>
            <button className="btn-secondary btn-sm" onClick={() => open("readmit")}><Repeat2 className="h-3.5 w-3.5" aria-hidden="true" />Readmit / repeat</button>
            <button className="btn-secondary btn-sm" onClick={() => open("transfer")} disabled={!current}><Shuffle className="h-3.5 w-3.5" aria-hidden="true" />Change section</button>
            <button className="btn-secondary btn-sm !text-danger" onClick={() => open("close")} disabled={!current}><Ban className="h-3.5 w-3.5" aria-hidden="true" />Defer / withdraw</button>
          </div>
          {form}
          {action === null && error && <Alert tone="danger">{error}</Alert>}

          {/* backlog & electives */}
          {current && (
            <section>
              <h3 className="text-sm font-semibold text-text-primary">Backlog and elective subjects</h3>
              <p className="mt-0.5 text-xs text-text-secondary">Lets the student appear on another section’s class list for that subject while their attendance stays with their own enrollment.</p>
              {current.subjectRegistrations.length > 0 && (
                <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
                  {current.subjectRegistrations.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm">
                      <span className="min-w-0"><span className="font-medium text-text-primary">{r.subject.name}</span><span className="ml-2 text-xs text-text-secondary">{r.section.batchLabel} · Section {r.section.name}</span><span className={`ml-2 ${r.type === "BACKLOG" ? "badge-warning" : "badge-info"}`}>{r.type === "BACKLOG" ? "Backlog" : "Elective"}</span></span>
                      <button className="btn-ghost btn-sm !px-2 !text-danger" onClick={() => removeRegistration(r.id)} aria-label={`Remove ${r.subject.name}`}><Trash2 className="h-3.5 w-3.5" /></button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <SelectField label="Type" value={regType} onChange={(v) => { setRegType(v as "BACKLOG" | "ELECTIVE"); setRegSubjectId(""); }} placeholder="Add a registration" options={[{ value: "BACKLOG", label: "Backlog subject" }, { value: "ELECTIVE", label: "Elective subject" }]} />
                <SelectField label="Subject" value={regSubjectId} onChange={setRegSubjectId} waitingFor={!regType ? "type" : null} loading={subjects.loading} error={subjects.error} emptyText={regType === "BACKLOG" ? "No earlier-semester subjects" : "No electives this semester"} options={eligibleSubjects.map((s) => ({ value: s.id, label: `${s.name} · Sem ${s.semester}` }))} />
                <SelectField label="Class to attend" value={regSectionId} onChange={setRegSectionId} waitingFor={!regSubjectId ? "subject" : null} options={allSections} hint="The section whose class they sit in" />
              </div>
              <div className="mt-3"><button className="btn-secondary btn-sm" disabled={busy || !regType || !regSubjectId || !regSectionId} onClick={registerSubject}>Register subject</button></div>
            </section>
          )}

          {/* history */}
          <section>
            <h3 className="text-sm font-semibold text-text-primary">Enrollment history</h3>
            <p className="mt-0.5 text-xs text-text-secondary">Nothing here is ever overwritten. Attendance stays linked to the enrollment that was true when it was taken.</p>
            <ol className="mt-4 space-y-0">
              {rows.map((e, i) => (
                <li key={e.id} className="relative pl-7">
                  {i < rows.length - 1 && <span className="absolute bottom-0 left-[9px] top-5 w-px bg-border" aria-hidden="true" />}
                  <span className={`absolute left-0 top-1.5 h-[19px] w-[19px] rounded-full border-2 ${e.isCurrent ? "border-success bg-success/20" : "border-border-strong bg-surface-card"}`} aria-hidden="true" />
                  <div className="pb-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-text-primary">{e.academicSession.label} · {e.semester.name}{e.section ? ` · Section ${e.section.name}` : ""}</p>
                      <span className={STATUS_BADGE[e.status].cls}>{STATUS_BADGE[e.status].label}</span>
                      <span className="badge-neutral">{TYPE_LABEL[e.enrollmentType]}</span>
                    </div>
                    <p className="num mt-0.5 text-xs text-text-secondary">{e.program.name} · Batch {e.batch.label} · admission year {e.admissionYear} · {formatShortDate(e.admissionDate)} → {e.endDate ? formatShortDate(e.endDate) : "present"}</p>
                    {(e.readmissionReason || e.reasonNote) && <p className="mt-1 text-xs text-text-secondary">{e.readmissionReason ? `${e.readmissionReason.replace("_", " ").toLowerCase()}` : ""}{e.readmissionReason && e.reasonNote ? " — " : ""}{e.reasonNote}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </Modal>
  );
}
