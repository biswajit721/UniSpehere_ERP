import { ChevronLeft, ChevronRight, ClipboardList, Download, Eye, Pencil } from "lucide-react";
import { useState } from "react";
import { Alert, EmptyState, Spinner } from "../../components/ui/Feedback";
import { SelectField } from "../../components/ui/SelectField";
import { toast } from "../../store/toastStore";
import { formatShortDate, weekdayShort } from "../../utils/dates";
import { extractErrorMessage } from "../../utils/errorMessage";
import { useRemote } from "../../utils/useRemote";
import { attendanceApi } from "./attendance.api";
import { HistoryRow } from "./attendance.types";

interface Props {
  refreshKey: number;
  onOpenSheet: (id: string, mode?: "view" | "edit") => void;
}

const PAGE_SIZE = 15;

function Percent({ row }: { row: HistoryRow }) {
  const tone = row.percentage >= 75 ? "text-success" : row.percentage >= 65 ? "text-warning" : "text-danger";
  return (
    <span className="num">
      <span className={`font-semibold ${tone}`}>{row.percentage}%</span>
      <span className="ml-1.5 text-xs text-text-secondary">{row.present}/{row.total}</span>
    </span>
  );
}

export function AttendanceRecords({ refreshKey, onOpenSheet }: Props) {
  const [sessionId, setSessionId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [includeCancelled, setIncludeCancelled] = useState(false);
  const [page, setPage] = useState(1);
  const [downloading, setDownloading] = useState<string | null>(null);

  const sessions = useRemote("sessions", attendanceApi.sessions);
  const history = useRemote(`history:${sessionId}:${from}:${to}:${includeCancelled}:${page}:${refreshKey}`, () =>
    attendanceApi.history({ academicSessionId: sessionId, from, to, includeCancelled: includeCancelled ? "true" : undefined, page, pageSize: PAGE_SIZE })
  );

  const reset = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setPage(1); };
  const rows = history.data?.data ?? [];
  const totalPages = history.data ? Math.max(1, Math.ceil(history.data.total / history.data.pageSize)) : 1;

  const downloadPdf = async (row: HistoryRow) => {
    setDownloading(row.id);
    try {
      const blob = await attendanceApi.classPdf({ academicSessionId: row.academicSession.id, sectionId: row.section.id, subjectId: row.subject.id });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attendance-${row.subject.code}-${row.section.name}-${row.academicSession.label}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(extractErrorMessage(err, "Could not download the class report."));
    } finally {
      setDownloading(null);
    }
  };

  const Actions = ({ row }: { row: HistoryRow }) => (
    <div className="flex items-center justify-end gap-1.5">
      <button className="btn-secondary btn-sm" onClick={() => onOpenSheet(row.id, "view")} aria-label={`View attendance for ${row.subject.name} on ${formatShortDate(row.date)}`}><Eye className="h-3.5 w-3.5" aria-hidden="true" />View</button>
      {row.canEdit && <button className="btn-secondary btn-sm" onClick={() => onOpenSheet(row.id, "edit")} aria-label={`Edit attendance for ${row.subject.name} on ${formatShortDate(row.date)}`}><Pencil className="h-3.5 w-3.5" aria-hidden="true" />Edit</button>}
      <button className="btn-ghost btn-sm !px-2" onClick={() => downloadPdf(row)} disabled={downloading === row.id} aria-label="Download class report as PDF" title="Class report (PDF)"><Download className="h-3.5 w-3.5" aria-hidden="true" /></button>
    </div>
  );

  return (
    <div className="space-y-4">
      <section className="card p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SelectField label="Academic session" value={sessionId} onChange={reset(setSessionId)} placeholder="All sessions" loading={sessions.loading} error={sessions.error} onRetry={sessions.reload} options={(sessions.data ?? []).map((s) => ({ value: s.id, label: s.isCurrent ? `${s.label} (Current)` : s.label }))} />
          <div>
            <label htmlFor="rec-from" className="field-label">From date</label>
            <input id="rec-from" type="date" className="input-field" value={from} max={to || undefined} onChange={(e) => reset(setFrom)(e.target.value)} />
          </div>
          <div>
            <label htmlFor="rec-to" className="field-label">To date</label>
            <input id="rec-to" type="date" className="input-field" value={to} min={from || undefined} onChange={(e) => reset(setTo)(e.target.value)} />
          </div>
          <label className="flex cursor-pointer items-end gap-2 pb-2.5 text-sm text-text-primary">
            <input type="checkbox" className="mb-0.5 h-4 w-4" checked={includeCancelled} onChange={(e) => reset(setIncludeCancelled)(e.target.checked)} />
            Include cancelled sheets
          </label>
        </div>
      </section>

      {history.error && <Alert tone="danger" action={<button className="btn-secondary btn-sm" onClick={history.reload}>Retry</button>}>{history.error}</Alert>}

      <section className="card overflow-hidden">
        {history.loading ? (
          <div className="py-14 text-center"><Spinner label="Loading attendance records…" /></div>
        ) : rows.length === 0 && !history.error ? (
          <EmptyState icon={ClipboardList} title="No attendance records found">
            Records appear here once a class has been submitted. Try widening the dates or choosing another session.
          </EmptyState>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="table-base">
                <thead>
                  <tr><th>Date</th><th>Class</th><th>Subject</th><th>Faculty</th><th>Periods</th><th>Attendance</th><th /></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className={r.status === "CANCELLED" ? "opacity-60" : ""}>
                      <td className="whitespace-nowrap"><span className="font-medium">{formatShortDate(r.date)}</span><span className="ml-1.5 text-xs text-text-secondary">{weekdayShort(r.date)}</span></td>
                      <td className="whitespace-nowrap">{r.program?.name ?? "—"} · {r.semester.name}<br /><span className="text-xs text-text-secondary">Section {r.section.name} · {r.section.batchLabel}</span></td>
                      <td>{r.subject.name}{r.status === "CANCELLED" && <span className="badge-danger ml-2">Cancelled</span>}</td>
                      <td className="whitespace-nowrap text-text-secondary">{r.faculty ?? "—"}</td>
                      <td className="num whitespace-nowrap text-text-secondary">{r.period}{r.numberOfClasses > 1 ? `–${r.period + r.numberOfClasses - 1}` : ""}{r.startTime ? ` · ${r.startTime}–${r.endTime}` : ""}</td>
                      <td className="whitespace-nowrap"><Percent row={r} /></td>
                      <td><Actions row={r} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-border md:hidden">
              {rows.map((r) => (
                <li key={r.id} className={`space-y-2.5 p-4 ${r.status === "CANCELLED" ? "opacity-60" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text-primary">{r.subject.name}{r.status === "CANCELLED" && <span className="badge-danger ml-2">Cancelled</span>}</p>
                      <p className="text-xs text-text-secondary">{r.program?.name ?? "—"} · {r.semester.name} · Section {r.section.name}</p>
                    </div>
                    <Percent row={r} />
                  </div>
                  <p className="num text-xs text-text-secondary">{formatShortDate(r.date)} ({weekdayShort(r.date)}) · Period {r.period}{r.numberOfClasses > 1 ? `–${r.period + r.numberOfClasses - 1}` : ""}{r.faculty ? ` · ${r.faculty}` : ""}</p>
                  <Actions row={r} />
                </li>
              ))}
            </ul>

            <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-text-secondary">
              <span className="num">{history.data!.total} record{history.data!.total === 1 ? "" : "s"}</span>
              <div className="flex items-center gap-2">
                <button className="btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
                <span className="num">Page {page} of {totalPages}</span>
                <button className="btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
