import { CalendarRange, Loader2, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { Alert, EmptyState, Spinner } from "../../components/ui/Feedback";
import { Modal } from "../../components/ui/Modal";
import { toast } from "../../store/toastStore";
import { formatShortDate } from "../../utils/dates";
import { extractErrorMessage } from "../../utils/errorMessage";
import { useRemote } from "../../utils/useRemote";
import { AcademicSession } from "../attendance/attendance.types";
import { academicsApi } from "./academics.api";

function SessionForm({ session, onClose, onSaved }: { session: AcademicSession | null; onClose: () => void; onSaved: () => void }) {
  const editing = Boolean(session);
  const [startYear, setStartYear] = useState(String(session?.startYear ?? ""));
  const [endYear, setEndYear] = useState(String(session?.endYear ?? ""));
  const [label, setLabel] = useState(session?.label ?? "");
  const [startDate, setStartDate] = useState(session?.startDate ?? "");
  const [endDate, setEndDate] = useState(session?.endDate ?? "");
  const [isCurrent, setIsCurrent] = useState(session?.isCurrent ?? false);
  const [isActive, setIsActive] = useState(session?.isActive ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const derivedLabel = startYear && endYear ? `${startYear}-${endYear}` : "";

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      if (editing) await academicsApi.updateSession(session!.id, { label, startDate, endDate, isCurrent, isActive });
      else await academicsApi.createSession({ startYear: Number(startYear), endYear: Number(endYear), label: label || undefined, startDate, endDate, isCurrent, isActive });
      toast.success(editing ? "Academic session updated." : "Academic session created.");
      onSaved();
    } catch (err) {
      setError(extractErrorMessage(err, "Could not save the academic session."));
    } finally {
      setBusy(false);
    }
  };

  const ready = editing ? label.trim() && startDate && endDate : Number(startYear) > 1999 && Number(endYear) > Number(startYear) && startDate && endDate;

  return (
    <Modal open onClose={onClose} dismissible={!busy} size="md" title={editing ? `Edit ${session!.label}` : "New academic session"}
      description="Attendance dates must fall inside a session's start and end dates."
      footer={<><button className="btn-secondary" onClick={onClose} disabled={busy}>Cancel</button><button className="btn-primary" onClick={save} disabled={busy || !ready}>{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}{editing ? "Save changes" : "Create session"}</button></>}>
      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        {!editing && (
          <>
            <div><label className="field-label">Start year<span className="ml-0.5 text-danger">*</span></label><input className="input-field" type="number" value={startYear} onChange={(e) => setStartYear(e.target.value)} placeholder="2027" /></div>
            <div><label className="field-label">End year<span className="ml-0.5 text-danger">*</span></label><input className="input-field" type="number" value={endYear} onChange={(e) => setEndYear(e.target.value)} placeholder="2028" /></div>
          </>
        )}
        <div className="sm:col-span-2"><label className="field-label">Label{editing && <span className="ml-0.5 text-danger">*</span>}</label><input className="input-field" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={derivedLabel || "e.g. 2027-2028"} />{!editing && <p className="mt-1 text-xs text-text-muted">Leave blank to use {derivedLabel || "the start and end years"}</p>}</div>
        <div><label className="field-label">Start date<span className="ml-0.5 text-danger">*</span></label><input className="input-field" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
        <div><label className="field-label">End date<span className="ml-0.5 text-danger">*</span></label><input className="input-field" type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} /></div>
        <label className="flex cursor-pointer items-start gap-2 text-sm text-text-primary sm:col-span-2"><input type="checkbox" className="mt-0.5 h-4 w-4" checked={isActive} onChange={(e) => { setIsActive(e.target.checked); if (!e.target.checked) setIsCurrent(false); }} /><span>Active<span className="block text-xs text-text-secondary">Inactive sessions cannot receive new enrollments or attendance.</span></span></label>
        <label className="flex cursor-pointer items-start gap-2 text-sm text-text-primary sm:col-span-2"><input type="checkbox" className="mt-0.5 h-4 w-4" checked={isCurrent} disabled={!isActive} onChange={(e) => setIsCurrent(e.target.checked)} /><span>Current session<span className="block text-xs text-text-secondary">Only a highlight (“Current”) in dropdowns. Nobody’s selection is ever filled in for them.</span></span></label>
      </div>
    </Modal>
  );
}

export function SessionsTab({ canEdit }: { canEdit: boolean }) {
  const [nonce, setNonce] = useState(0);
  const [form, setForm] = useState<null | { session: AcademicSession | null }>(null);
  const sessions = useRemote(`sessions:${nonce}`, () => academicsApi.sessions(false));
  const rows = sessions.data ?? [];

  const makeCurrent = async (s: AcademicSession) => {
    try {
      await academicsApi.updateSession(s.id, { isCurrent: true });
      toast.success(`${s.label} is now the current session.`);
      setNonce((n) => n + 1);
    } catch (err) {
      toast.error(extractErrorMessage(err, "Could not change the current session."));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-text-secondary">The academic calendar every enrollment and attendance record hangs off.</p>
        {canEdit && <button className="btn-primary self-start" onClick={() => setForm({ session: null })}><Plus className="h-4 w-4" aria-hidden="true" />New session</button>}
      </div>
      <div className="card overflow-hidden">
        {sessions.loading ? <div className="py-12 text-center"><Spinner label="Loading sessions…" /></div>
        : sessions.error ? <div className="p-5 text-sm text-danger">{sessions.error}</div>
        : rows.length === 0 ? <EmptyState icon={CalendarRange} title="No academic sessions yet">{canEdit ? "Create the first session before registering students or taking attendance." : "Ask an administrator to create one."}</EmptyState>
        : (
          <ul className="divide-y divide-border">
            {rows.map((s) => (
              <li key={s.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-text-primary">{s.label}{s.isCurrent && <span className="badge-success">Current</span>}{!s.isActive && <span className="badge-neutral">Inactive</span>}</p>
                  <p className="num mt-0.5 text-xs text-text-secondary">{s.startDate ? `${formatShortDate(s.startDate)} → ${formatShortDate(s.endDate)}` : <span className="text-warning">No dates set - edit to enable date checks</span>}</p>
                </div>
                {canEdit && <div className="flex gap-2">
                  {!s.isCurrent && s.isActive && <button className="btn-secondary btn-sm" onClick={() => makeCurrent(s)}>Set as current</button>}
                  <button className="btn-secondary btn-sm" onClick={() => setForm({ session: s })}><Pencil className="h-3.5 w-3.5" aria-hidden="true" />Edit</button>
                </div>}
              </li>
            ))}
          </ul>
        )}
      </div>
      {form && <SessionForm session={form.session} onClose={() => setForm(null)} onSaved={() => { setForm(null); setNonce((n) => n + 1); }} />}
    </div>
  );
}
