import { Ban, History, Loader2, Pencil, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Alert, Spinner } from "../../components/ui/Feedback";
import { Modal } from "../../components/ui/Modal";
import { toast } from "../../store/toastStore";
import { formatLongDate } from "../../utils/dates";
import { extractErrorMessage } from "../../utils/errorMessage";
import { useRemote } from "../../utils/useRemote";
import { attendanceApi } from "./attendance.api";
import { AttendanceStatus, SheetRecord } from "./attendance.types";

const STATUS_LABEL: Record<AttendanceStatus, string> = { PRESENT: "Present", ABSENT: "Absent", LATE: "Late", EXCUSED: "Excused" };
const STATUS_BADGE: Record<AttendanceStatus, string> = { PRESENT: "badge-success", ABSENT: "badge-danger", LATE: "badge-warning", EXCUSED: "badge-info" };

interface Props {
  id: string | null;
  initialMode: "view" | "edit";
  onClose: () => void;
  /** called after a correction or cancellation so lists can refresh */
  onChanged: () => void;
}

interface Draft { status: AttendanceStatus; remarks: string }

function Trail({ record }: { record: SheetRecord }) {
  if (record.edits.length === 0) return null;
  return (
    <details className="mt-1 text-xs text-text-secondary">
      <summary className="inline-flex cursor-pointer select-none items-center gap-1 font-medium text-primary">
        <History className="h-3 w-3" aria-hidden="true" /> Edited {record.edits.length}×
      </summary>
      <ul className="mt-1 space-y-1 border-l-2 border-border pl-3">
        {record.edits.map((e, i) => (
          <li key={i}>
            <span className="font-medium text-text-primary">{STATUS_LABEL[e.previousStatus]} → {STATUS_LABEL[e.newStatus]}</span> by {e.editedBy}
            <span className="num"> · {new Date(e.at).toLocaleString()}</span>
            <br />“{e.reason}”
          </li>
        ))}
      </ul>
    </details>
  );
}

export function AttendanceDetailModal({ id, initialMode, onClose, onChanged }: Props) {
  const [nonce, setNonce] = useState(0);
  const sheet = useRemote(id ? `sheet:${id}:${nonce}` : null, () => attendanceApi.sheet(id!));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, Draft>>({});
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const data = sheet.data;

  // reset transient state whenever a different sheet opens
  useEffect(() => {
    setEditing(false); setDraft({}); setReason(""); setError(null); setCancelling(false); setCancelReason("");
  }, [id]);

  // open straight into edit mode when asked to (and allowed)
  useEffect(() => {
    if (data && initialMode === "edit" && data.permissions.canEdit && !editing && Object.keys(draft).length === 0) startEdit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.id]);

  const startEdit = () => {
    if (!data) return;
    setDraft(Object.fromEntries(data.records.map((r) => [r.recordId, { status: r.status, remarks: r.remarks ?? "" }])));
    setEditing(true);
    setError(null);
  };

  const changes = useMemo(() => {
    if (!data || !editing) return [];
    return data.records.flatMap((r) => {
      const d = draft[r.recordId];
      if (!d) return [];
      const statusChanged = d.status !== r.status;
      const remarkChanged = (d.remarks.trim() || null) !== (r.remarks ?? null);
      return statusChanged || remarkChanged ? [{ recordId: r.recordId, status: d.status, remarks: d.remarks.trim() || null, statusChanged }] : [];
    });
  }, [data, draft, editing]);

  const save = async () => {
    if (!data) return;
    setSaving(true);
    setError(null);
    try {
      const res = await attendanceApi.edit(data.id, reason.trim(), changes.map(({ recordId, status, remarks }) => ({ recordId, status, remarks })));
      toast.success(`Correction saved (${res.statusChanges} status change${res.statusChanges === 1 ? "" : "s"}) and logged.`);
      setEditing(false); setDraft({}); setReason("");
      setNonce((n) => n + 1);
      onChanged();
    } catch (err) {
      setError(extractErrorMessage(err, "Could not save the correction. Nothing was changed."));
    } finally {
      setSaving(false);
    }
  };

  const cancelSheet = async () => {
    if (!data) return;
    setSaving(true);
    setError(null);
    try {
      await attendanceApi.cancel(data.id, cancelReason.trim());
      toast.success("Attendance cancelled. The class can now be recorded again.");
      setCancelling(false); setCancelReason("");
      setNonce((n) => n + 1);
      onChanged();
    } catch (err) {
      setError(extractErrorMessage(err, "Could not cancel this attendance."));
    } finally {
      setSaving(false);
    }
  };

  const meta: [string, string][] = data
    ? [
        ["Academic session", data.academicSession.label],
        ["Semester", data.semester.name],
        ["Program", data.program?.name ?? "—"],
        ["Section", `${data.section.name} · ${data.section.batchLabel}`],
        ["Subject", `${data.subject.code} · ${data.subject.name}`],
        ["Date", formatLongDate(data.date)],
        ["Period", `${data.period}${data.numberOfClasses > 1 ? `–${data.period + data.numberOfClasses - 1}` : ""}${data.startTime ? ` · ${data.startTime}–${data.endTime}` : ""}`],
        ["Classes counted", String(data.numberOfClasses)],
        ["Faculty", data.faculty ?? "—"],
        ["Recorded by", data.recordedBy],
      ]
    : [];

  const canSave = editing && changes.length > 0 && reason.trim().length >= 3 && !saving;

  return (
    <Modal
      open={Boolean(id)}
      onClose={onClose}
      size="xl"
      dismissible={!saving}
      title={data ? `${data.subject.name} · ${data.section.name}` : "Attendance sheet"}
      description={data ? `${formatLongDate(data.date)} · ${data.program?.name ?? ""} ${data.semester.name}` : undefined}
      footer={
        data && (
          editing ? (
            <>
              <button className="btn-secondary" onClick={() => { setEditing(false); setDraft({}); setReason(""); setError(null); }} disabled={saving}>Discard changes</button>
              <button className="btn-primary" onClick={save} disabled={!canSave}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
                Save correction{changes.length ? ` (${changes.length})` : ""}
              </button>
            </>
          ) : cancelling ? (
            <>
              <button className="btn-secondary" onClick={() => setCancelling(false)} disabled={saving}>Keep attendance</button>
              <button className="btn-danger" onClick={cancelSheet} disabled={saving || cancelReason.trim().length < 3}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Cancel this attendance
              </button>
            </>
          ) : (
            <>
              <button className="btn-secondary" onClick={onClose}>Close</button>
              {data.permissions.canCancel && <button className="btn-secondary !text-danger" onClick={() => setCancelling(true)}><Ban className="h-4 w-4" aria-hidden="true" />Cancel attendance</button>}
              {data.permissions.canEdit && <button className="btn-primary" onClick={startEdit}><Pencil className="h-4 w-4" aria-hidden="true" />Edit attendance</button>}
            </>
          )
        )
      }
    >
      {sheet.loading && <div className="py-10 text-center"><Spinner label="Loading attendance…" /></div>}
      {sheet.error && <Alert tone="danger" action={<button className="btn-secondary btn-sm" onClick={sheet.reload}>Retry</button>}>{sheet.error}</Alert>}

      {data && (
        <div className="space-y-5">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
            {meta.map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="text-xs text-text-secondary">{k}</dt>
                <dd className="mt-0.5 break-words text-sm font-medium text-text-primary">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {[
              { l: "Students", v: data.totals.total, c: "text-text-primary" },
              { l: "Present", v: data.totals.present, c: "text-success" },
              { l: "Absent", v: data.totals.absent, c: "text-danger" },
              { l: "Attendance", v: `${data.totals.percentage}%`, c: "text-text-primary" },
            ].map((t) => (
              <div key={t.l} className="rounded-lg bg-surface px-3 py-2.5 text-center">
                <p className={`num text-xl font-semibold ${t.c}`}>{t.v}</p>
                <p className="text-xs text-text-secondary">{t.l}</p>
              </div>
            ))}
            <div className="col-span-2 flex items-center justify-center rounded-lg bg-surface px-3 py-2.5 sm:col-span-1">
              <span className={data.status === "SUBMITTED" ? "badge-success" : "badge-danger"}>{data.status === "SUBMITTED" ? "Submitted" : "Cancelled"}</span>
            </div>
          </div>

          {data.cancelled && (
            <Alert tone="danger" title="This attendance was cancelled">
              {data.cancelled.by ? `By ${data.cancelled.by}` : ""}{data.cancelled.at ? ` on ${new Date(data.cancelled.at).toLocaleString()}` : ""}. Reason: {data.cancelled.reason}. It no longer counts toward any percentage.
            </Alert>
          )}
          {!editing && !data.permissions.canEdit && data.permissions.editBlockedReason && <Alert tone="info">{data.permissions.editBlockedReason}</Alert>}
          {error && <Alert tone="danger">{error}</Alert>}

          {cancelling && (
            <div>
              <label htmlFor="cancel-reason" className="field-label">Reason for cancelling (recorded in the audit log)</label>
              <textarea id="cancel-reason" data-autofocus className="input-field min-h-[5rem]" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} maxLength={300} placeholder="e.g. Class was not held; recorded against the wrong section" />
            </div>
          )}

          {editing && (
            <div>
              <label htmlFor="edit-reason" className="field-label">Reason for the correction <span className="text-danger">*</span></label>
              <textarea id="edit-reason" className="input-field min-h-[4.5rem]" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="Explain why the attendance is being corrected. This is stored with every change." />
              <p className="mt-1 text-xs text-text-muted">The previous status, new status, your name, the time and this reason are kept permanently.</p>
            </div>
          )}

          {/* ---------- records ---------- */}
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="hidden md:block">
              <table className="table-base">
                <thead>
                  <tr><th className="w-12">#</th><th>Roll no.</th><th>Registration no.</th><th>Student</th><th>Status</th><th>Remarks</th></tr>
                </thead>
                <tbody>
                  {data.records.map((r, i) => {
                    const d = draft[r.recordId];
                    const changed = editing && d && (d.status !== r.status || (d.remarks.trim() || null) !== (r.remarks ?? null));
                    return (
                      <tr key={r.recordId} className={changed ? "bg-warning-soft" : ""}>
                        <td className="num text-text-muted">{i + 1}</td>
                        <td className="num font-medium">{r.rollNumber}</td>
                        <td className="num text-text-secondary">{r.registrationNumber}</td>
                        <td>{r.fullName}<Trail record={r} /></td>
                        <td>
                          {editing && d ? (
                            <select className="input-field !min-h-9 !py-1.5" value={d.status} aria-label={`Status for ${r.fullName}`} onChange={(e) => setDraft((p) => ({ ...p, [r.recordId]: { ...p[r.recordId], status: e.target.value as AttendanceStatus } }))}>
                              {(Object.keys(STATUS_LABEL) as AttendanceStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                            </select>
                          ) : <span className={STATUS_BADGE[r.status]}>{STATUS_LABEL[r.status]}</span>}
                        </td>
                        <td className="min-w-[10rem] text-text-secondary">
                          {editing && d ? (
                            <input className="input-field !min-h-9 !py-1.5" value={d.remarks} maxLength={200} aria-label={`Remark for ${r.fullName}`} onChange={(e) => setDraft((p) => ({ ...p, [r.recordId]: { ...p[r.recordId], remarks: e.target.value } }))} />
                          ) : r.remarks ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-border md:hidden">
              {data.records.map((r, i) => {
                const d = draft[r.recordId];
                return (
                  <li key={r.recordId} className="space-y-2 p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-text-primary"><span className="num mr-1 font-normal text-text-muted">{i + 1}.</span>{r.fullName}</p>
                        <p className="num text-xs text-text-secondary">{r.rollNumber} · {r.registrationNumber}</p>
                        <Trail record={r} />
                      </div>
                      {!(editing && d) && <span className={STATUS_BADGE[r.status]}>{STATUS_LABEL[r.status]}</span>}
                    </div>
                    {editing && d && (
                      <div className="grid grid-cols-2 gap-2">
                        <select className="input-field" value={d.status} aria-label={`Status for ${r.fullName}`} onChange={(e) => setDraft((p) => ({ ...p, [r.recordId]: { ...p[r.recordId], status: e.target.value as AttendanceStatus } }))}>
                          {(Object.keys(STATUS_LABEL) as AttendanceStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                        </select>
                        <input className="input-field" value={d.remarks} placeholder="Remark" maxLength={200} aria-label={`Remark for ${r.fullName}`} onChange={(e) => setDraft((p) => ({ ...p, [r.recordId]: { ...p[r.recordId], remarks: e.target.value } }))} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </Modal>
  );
}
