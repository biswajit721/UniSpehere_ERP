import { Clock, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Alert, EmptyState, Spinner } from "../../components/ui/Feedback";
import { toast } from "../../store/toastStore";
import { extractErrorMessage } from "../../utils/errorMessage";
import { useRemote } from "../../utils/useRemote";
import { academicsApi, PeriodRow } from "./academics.api";

/** The university's period grid. The attendance form reads its Period list from here. */
export function PeriodsTab({ canEdit }: { canEdit: boolean }) {
  const remote = useRemote("periods", academicsApi.periods);
  const [rows, setRows] = useState<PeriodRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (remote.data) { setRows(remote.data.map((p) => ({ ...p }))); setDirty(false); }
  }, [remote.data]);

  const update = (i: number, patch: Partial<PeriodRow>) => { setRows((r) => r.map((x, k) => (k === i ? { ...x, ...patch } : x))); setDirty(true); };
  const add = () => {
    const last = rows[rows.length - 1];
    setRows((r) => [...r, { number: (last?.number ?? 0) + 1, label: "", startTime: last?.endTime ?? "", endTime: "", isActive: true }]);
    setDirty(true);
  };
  const remove = (i: number) => { setRows((r) => r.filter((_, k) => k !== i)); setDirty(true); };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const saved = await academicsApi.savePeriods(rows.map((r) => ({ number: r.number, label: r.label?.trim() && r.label !== `Period ${r.number}` ? r.label.trim() : null, startTime: r.startTime, endTime: r.endTime, isActive: r.isActive })));
      setRows(saved.map((p) => ({ ...p })));
      setDirty(false);
      toast.success("Period grid saved.");
    } catch (err) {
      setError(extractErrorMessage(err, "Could not save the period grid. Nothing was changed."));
    } finally {
      setBusy(false);
    }
  };

  if (remote.loading) return <div className="py-12 text-center"><Spinner label="Loading period grid…" /></div>;
  if (remote.error) return <Alert tone="danger" action={<button className="btn-secondary btn-sm" onClick={remote.reload}>Retry</button>}>{remote.error}</Alert>;

  return (
    <div className="space-y-4">
      <Alert tone="info">Attendance takes its periods from this grid, and the timetable is matched against it. Changing the grid never alters attendance already recorded - each sheet keeps its own start and end times.</Alert>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="card overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState icon={Clock} title="No periods configured" action={canEdit ? <button className="btn-primary" onClick={add}><Plus className="h-4 w-4" aria-hidden="true" />Add the first period</button> : undefined}>
            {canEdit ? "Attendance cannot be taken until the period grid is set up." : "Ask an administrator to set up the period grid."}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr><th className="w-20">No.</th><th>Label</th><th>Start</th><th>End</th><th>Active</th>{canEdit && <th />}</tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td>{canEdit ? <input className="input-field !min-h-9 !w-16 !py-1.5" type="number" min={1} max={20} value={r.number} aria-label="Period number" onChange={(e) => update(i, { number: Number(e.target.value) })} /> : <span className="num font-medium">{r.number}</span>}</td>
                    <td>{canEdit ? <input className="input-field !min-h-9 !py-1.5" value={r.label} placeholder={`Period ${r.number}`} aria-label="Label" onChange={(e) => update(i, { label: e.target.value })} /> : r.label}</td>
                    <td>{canEdit ? <input className="input-field !min-h-9 !w-32 !py-1.5" type="time" value={r.startTime} aria-label={`Period ${r.number} start`} onChange={(e) => update(i, { startTime: e.target.value })} /> : <span className="num">{r.startTime}</span>}</td>
                    <td>{canEdit ? <input className="input-field !min-h-9 !w-32 !py-1.5" type="time" value={r.endTime} aria-label={`Period ${r.number} end`} onChange={(e) => update(i, { endTime: e.target.value })} /> : <span className="num">{r.endTime}</span>}</td>
                    <td>{canEdit ? <input type="checkbox" className="h-4 w-4" checked={r.isActive} aria-label={`Period ${r.number} active`} onChange={(e) => update(i, { isActive: e.target.checked })} /> : r.isActive ? <span className="badge-success">Active</span> : <span className="badge-neutral">Inactive</span>}</td>
                    {canEdit && <td className="text-right"><button className="btn-ghost btn-sm !px-2 !text-danger" onClick={() => remove(i)} aria-label={`Remove period ${r.number}`}><Trash2 className="h-3.5 w-3.5" /></button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {canEdit && rows.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-border p-4 sm:flex-row sm:justify-between">
            <button className="btn-secondary" onClick={add}><Plus className="h-4 w-4" aria-hidden="true" />Add period</button>
            <button className="btn-primary" onClick={save} disabled={busy || !dirty}>{busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}Save period grid</button>
          </div>
        )}
      </div>
    </div>
  );
}
