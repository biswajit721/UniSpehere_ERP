import { ArrowDownRight, ArrowUpRight, CalendarDays, ClipboardCheck, Target } from "lucide-react";
import { ReactNode, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Alert, EmptyState, Spinner, StatTile } from "../../components/ui/Feedback";
import { SelectField } from "../../components/ui/SelectField";
import { Tabs } from "../../components/ui/Tabs";
import { api } from "../../services/api";
import { formatLongDate, todayLocal } from "../../utils/dates";
import { useChartTheme } from "../../utils/useChartTheme";
import { useRemote } from "../../utils/useRemote";
import { StudentListItem } from "../students/students.types";
import { attendanceApi } from "./attendance.api";
import { AttendanceHealth, AttendanceStatus, ReportView, StudentOverview } from "./attendance.types";

const LENSES: { id: ReportView; label: string }[] = [
  { id: "summary", label: "Overview" },
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "yearly", label: "Yearly" },
  { id: "semester", label: "Semester" },
  { id: "session", label: "Academic session" },
];

const HEALTH: Record<AttendanceHealth, { label: string; badge: string }> = {
  EXCELLENT: { label: "Excellent", badge: "badge-success" },
  GOOD: { label: "Good", badge: "badge-primary" },
  WARNING: { label: "Shortage risk", badge: "badge-warning" },
  CRITICAL: { label: "Critical", badge: "badge-danger" },
};
const STATUS_BADGE: Record<AttendanceStatus, { label: string; cls: string }> = {
  PRESENT: { label: "Present", cls: "badge-success" },
  ABSENT: { label: "Absent", cls: "badge-danger" },
  LATE: { label: "Late", cls: "badge-warning" },
  EXCUSED: { label: "Excused", cls: "badge-info" },
};

const pctColor = (p: number, min: number) => (p >= min ? "text-success" : p >= min - 10 ? "text-warning" : "text-danger");

function Bar100({ pct, min }: { pct: number; min: number }) {
  const cls = pct >= min ? "bg-success" : pct >= min - 10 ? "bg-warning" : "bg-danger";
  return (
    <div className="h-2 w-full min-w-[4rem] overflow-hidden rounded-full bg-surface" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full ${cls}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

/** "How many more classes do I need?" - every number comes from the server's exact integer maths. */
function ShortageCard({ o }: { o: StudentOverview }) {
  if (o.totalClasses === 0) return null;
  return (
    <section className="card p-4 sm:p-5" aria-labelledby="short-h">
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${o.hasShortage ? "bg-warning-soft text-warning" : "bg-success-soft text-success"}`}>
          <Target className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 id="short-h" className="text-sm font-semibold text-text-primary">Attendance requirement: {o.minimumRequired}%</h3>
          <p className="mt-1 text-sm text-text-secondary">
            {o.hasShortage ? (
              o.classesNeededToRecover === null ? "The requirement can no longer be reached." : (
                <>You are <strong className="text-warning">short</strong>. Attend the next <strong className="num text-text-primary">{o.classesNeededToRecover}</strong> {o.classesNeededToRecover === 1 ? "class" : "classes"} in a row to reach {o.minimumRequired}%.</>
              )
            ) : (
              <>You are <strong className="text-success">on track</strong>{o.classesCanMiss !== null && <>. You can miss up to <strong className="num text-text-primary">{o.classesCanMiss}</strong> more {o.classesCanMiss === 1 ? "class" : "classes"} and stay at or above {o.minimumRequired}%.</>}</>
            )}
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg bg-surface p-3"><p className="text-xs text-text-secondary">Current attendance</p><p className={`num text-xl font-semibold ${pctColor(o.percentage, o.minimumRequired)}`}>{o.percentage}%</p><p className="num text-xs text-text-muted">{o.present} of {o.totalClasses} classes</p></div>
        <div className="rounded-lg bg-surface p-3"><p className="text-xs text-text-secondary">Required</p><p className="num text-xl font-semibold text-text-primary">{o.minimumRequired}%</p><p className="text-xs text-text-muted">University minimum</p></div>
        <div className="rounded-lg bg-surface p-3"><p className="flex items-center gap-1 text-xs text-text-secondary"><ArrowUpRight className="h-3.5 w-3.5 text-success" aria-hidden="true" />If you attend the next class</p><p className={`num text-xl font-semibold ${pctColor(o.ifAttendNext, o.minimumRequired)}`}>{o.ifAttendNext}%</p></div>
        <div className="rounded-lg bg-surface p-3"><p className="flex items-center gap-1 text-xs text-text-secondary"><ArrowDownRight className="h-3.5 w-3.5 text-danger" aria-hidden="true" />If you miss the next class</p><p className={`num text-xl font-semibold ${pctColor(o.ifMissNext, o.minimumRequired)}`}>{o.ifMissNext}%</p></div>
      </div>
    </section>
  );
}

export function MyAttendance() {
  const chart = useChartTheme();
  const [view, setView] = useState<ReportView>("summary");
  const [sessionId, setSessionId] = useState("");
  const [semesterId, setSemesterId] = useState("");
  const [date, setDate] = useState(todayLocal());

  const me = useRemote("me", () => api.get<{ student: StudentListItem }>("/students/me").then((r) => r.data.student));
  const sessions = useRemote("sessions", attendanceApi.sessions);
  const semesters = useRemote(me.data ? `sems:${me.data.programId}` : null, () =>
    api.get<{ semesters: { id: string; name: string }[] }>("/academics/semesters", { params: { programId: me.data!.programId } }).then((r) => r.data.semesters)
  );
  const report = useRemote(`rep:${view}:${sessionId}:${semesterId}:${date}`, () =>
    attendanceApi.studentReport("me", { view, academicSessionId: sessionId, semesterId, date: view === "daily" ? date : undefined })
  );

  const r = report.data;
  const o = r?.overview;
  const min = o?.minimumRequired ?? 75;
  const filtersApply = view !== "daily";

  const seriesChart = (title: string) =>
    r?.series && r.series.length > 0 ? (
      <section className="card p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        <div className="mt-3 h-64" role="img" aria-label={`${title}: ${r.series.map((s) => `${s.label} ${s.percentage}%`).join(", ")}`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={r.series} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid stroke={chart.grid} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: chart.text, fontSize: 11 }} stroke={chart.grid} tickLine={false} interval="preserveStartEnd" />
              <YAxis domain={[0, 100]} tick={{ fill: chart.text, fontSize: 12 }} stroke={chart.grid} tickLine={false} tickFormatter={(v) => `${v}%`} />
              <Tooltip cursor={{ fill: chart.grid, opacity: 0.35 }} contentStyle={{ background: chart.tooltipBg, border: `1px solid ${chart.tooltipBorder}`, borderRadius: 10, color: chart.ink }} labelStyle={{ color: chart.ink, fontWeight: 600 }} formatter={(v: number, _n, p) => [`${v}%  (${p.payload.present}/${p.payload.conducted} classes)`, "Attendance"]} />
              <ReferenceLine y={min} stroke={chart.warning} strokeDasharray="5 4" />
              <Bar dataKey="percentage" radius={[6, 6, 0, 0]} maxBarSize={48} isAnimationActive={false}>
                {r.series.map((s) => <Cell key={s.label} fill={s.percentage >= min ? chart.success : s.percentage >= min - 10 ? chart.warning : chart.danger} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>Period</th><th className="text-right">Conducted</th><th className="text-right">Present</th><th className="text-right">Absent</th><th className="text-right">Attendance</th></tr></thead>
            <tbody>
              {r.series.map((s) => (
                <tr key={s.label}><td className="font-medium">{s.label}</td><td className="num text-right">{s.conducted}</td><td className="num text-right">{s.present}</td><td className="num text-right">{s.absent}</td><td className={`num text-right font-semibold ${pctColor(s.percentage, min)}`}>{s.percentage}%</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    ) : null;

  let body: ReactNode = null;
  if (r && o) {
    if (o.totalClasses === 0 && view !== "daily") {
      body = <section className="card"><EmptyState icon={ClipboardCheck} title="No attendance recorded yet">When your faculty submit attendance it appears here, with your subject-wise percentage and how many classes you need to stay above {min}%.</EmptyState></section>;
    } else if (view === "summary") {
      body = (
        <>
          <ShortageCard o={o} />
          <section className="card overflow-hidden">
            <div className="border-b border-border px-4 py-3.5 sm:px-5"><h3 className="text-sm font-semibold text-text-primary">Subject-wise attendance</h3></div>
            <div className="hidden overflow-x-auto md:block">
              <table className="table-base">
                <thead><tr><th>Subject</th><th className="text-right">Conducted</th><th className="text-right">Present</th><th className="text-right">Absent</th><th className="w-48">Attendance</th><th>Status</th><th className="text-right">To reach {min}%</th></tr></thead>
                <tbody>
                  {(r.subjects ?? []).map((s) => (
                    <tr key={s.subjectId}>
                      <td className="font-medium">{s.subject}{s.registrationType !== "REGULAR" && <span className="badge-info ml-2">{s.registrationType === "BACKLOG" ? "Backlog" : "Elective"}</span>}<span className="block text-xs font-normal text-text-secondary">{s.code}</span></td>
                      <td className="num text-right">{s.conducted}</td><td className="num text-right">{s.present}</td><td className="num text-right">{s.absent}</td>
                      <td><div className="flex items-center gap-3"><Bar100 pct={s.percentage} min={min} /><span className={`num w-14 text-right font-semibold ${pctColor(s.percentage, min)}`}>{s.percentage}%</span></div></td>
                      <td><span className={HEALTH[s.status].badge}>{HEALTH[s.status].label}</span></td>
                      <td className="num text-right text-text-secondary">{s.percentage >= min ? "—" : s.classesNeededToRecover === null ? "n/a" : `+${s.classesNeededToRecover}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-border md:hidden">
              {(r.subjects ?? []).map((s) => (
                <li key={s.subjectId} className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 text-sm font-semibold text-text-primary">{s.subject}{s.registrationType !== "REGULAR" && <span className="badge-info ml-2">{s.registrationType === "BACKLOG" ? "Backlog" : "Elective"}</span>}</p>
                    <span className={`num text-base font-semibold ${pctColor(s.percentage, min)}`}>{s.percentage}%</span>
                  </div>
                  <Bar100 pct={s.percentage} min={min} />
                  <p className="num flex flex-wrap items-center gap-x-3 text-xs text-text-secondary"><span>Conducted {s.conducted}</span><span>Present {s.present}</span><span>Absent {s.absent}</span><span className={HEALTH[s.status].badge}>{HEALTH[s.status].label}</span>{s.percentage < min && s.classesNeededToRecover !== null && <span>Attend next {s.classesNeededToRecover}</span>}</p>
                </li>
              ))}
            </ul>
          </section>
        </>
      );
    } else if (view === "daily" && r.daily) {
      body = (
        <section className="card overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
            <div><h3 className="text-sm font-semibold text-text-primary">{formatLongDate(r.daily.date)}</h3><p className="num mt-0.5 text-xs text-text-secondary">{r.daily.present} of {r.daily.conducted} classes attended · {r.daily.percentage}%</p></div>
            <div><label htmlFor="my-date" className="field-label">Choose a day</label><input id="my-date" type="date" className="input-field" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} /></div>
          </div>
          {r.daily.periods.length === 0 ? <EmptyState icon={CalendarDays} title="No classes recorded on this day" /> : (
            <ul className="divide-y divide-border">
              {r.daily.periods.map((p, i) => (
                <li key={i} className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
                  <div className="min-w-0"><p className="text-sm font-medium text-text-primary">{p.subject}</p><p className="num text-xs text-text-secondary">Period {p.period}{p.numberOfClasses > 1 ? `–${p.period + p.numberOfClasses - 1}` : ""}{p.startTime ? ` · ${p.startTime}–${p.endTime}` : ""}{p.numberOfClasses > 1 ? ` · counts as ${p.numberOfClasses} classes` : ""}</p></div>
                  <span className={STATUS_BADGE[p.status].cls}>{STATUS_BADGE[p.status].label}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      );
    } else {
      body = seriesChart(LENSES.find((l) => l.id === view)!.label + " attendance");
    }
  }

  return (
    <div className="space-y-5">
      {r && (
        <section className="card flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="min-w-0"><p className="truncate text-base font-semibold text-text-primary">{r.student.fullName}</p><p className="num text-sm text-text-secondary">{r.student.rollNumber} · {r.student.registrationNumber}</p></div>
          <p className="text-sm text-text-secondary">{r.student.program} · {r.student.currentSemester}{r.student.academicSession ? ` · ${r.student.academicSession}` : ""}</p>
        </section>
      )}

      <Tabs tabs={LENSES.map((l) => ({ id: l.id, label: l.label }))} value={view} onChange={(v) => setView(v as ReportView)} ariaLabel="Attendance view" />

      {filtersApply && (
        <section className="card p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Academic session" value={sessionId} onChange={setSessionId} placeholder="All sessions" loading={sessions.loading} error={sessions.error} onRetry={sessions.reload} options={(sessions.data ?? []).map((s) => ({ value: s.id, label: s.isCurrent ? `${s.label} (Current)` : s.label }))} />
            <SelectField label="Semester" value={semesterId} onChange={setSemesterId} placeholder="All semesters" loading={me.loading || semesters.loading} error={me.error ?? semesters.error} onRetry={semesters.reload} options={(semesters.data ?? []).map((s) => ({ value: s.id, label: s.name }))} />
          </div>
        </section>
      )}

      {o && view === "summary" && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Total classes" value={o.totalClasses} hint="Conducted so far" />
          <StatTile label="Present" value={o.present} tone="success" />
          <StatTile label="Absent" value={o.absent} tone={o.absent ? "danger" : "neutral"} />
          <div className="rounded-xl border border-border bg-surface-card p-4 shadow-card">
            <p className="text-xs font-medium text-text-secondary">Attendance</p>
            <p className={`num mt-1 text-2xl font-semibold tracking-tight ${o.totalClasses ? pctColor(o.percentage, min) : "text-text-primary"}`}>{o.percentage}%</p>
            <span className={`${HEALTH[o.status].badge} mt-0.5`}>{HEALTH[o.status].label}</span>
          </div>
        </div>
      )}

      {report.error && <Alert tone="danger" action={<button className="btn-secondary btn-sm" onClick={report.reload}>Retry</button>}>{report.error}</Alert>}
      {report.loading && <div className="py-16 text-center"><Spinner label="Loading your attendance…" /></div>}
      {!report.loading && body}
    </div>
  );
}
