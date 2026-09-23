import { BarChart3, ChevronLeft, ChevronRight, Download, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Alert, EmptyState, Spinner, StatTile } from "../../components/ui/Feedback";
import { SelectField } from "../../components/ui/SelectField";
import { api } from "../../services/api";
import { useAuthStore } from "../../store/authStore";
import { toast } from "../../store/toastStore";
import { formatShortDate } from "../../utils/dates";
import { extractErrorMessage } from "../../utils/errorMessage";
import { useChartTheme } from "../../utils/useChartTheme";
import { useRemote } from "../../utils/useRemote";
import { attendanceApi } from "./attendance.api";
import { DepartmentReport } from "./attendance.types";

const PAGE_SIZE = 25;

function tone(pct: number, t: { warning: number; critical: number }) {
  return pct < t.critical ? "danger" : pct < t.warning ? "warning" : "success";
}

/** Progress row: label, counts and a bar coloured by the policy thresholds (colour + number, never colour alone). */
function ProgressRow({ label, sub, pct, conducted, present, t }: { label: string; sub?: string; pct: number; conducted: number; present: number; t: { warning: number; critical: number } }) {
  const k = tone(pct, t);
  const bar = { success: "bg-success", warning: "bg-warning", danger: "bg-danger" }[k];
  const text = { success: "text-success", warning: "text-warning", danger: "text-danger" }[k];
  return (
    <li className="py-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-medium text-text-primary" title={label}>{label}{sub && <span className="ml-2 text-xs font-normal text-text-secondary">{sub}</span>}</p>
        <p className="num shrink-0 text-sm"><span className={`font-semibold ${text}`}>{pct}%</span> <span className="text-xs text-text-secondary">{present}/{conducted}</span></p>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${label} attendance`}>
        <div className={`h-full rounded-full ${bar} transition-[width] duration-500`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </li>
  );
}

function Card({ title, subtitle, children, className = "" }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card p-4 sm:p-5 ${className}`}>
      <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      {subtitle && <p className="mt-0.5 text-xs text-text-secondary">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function csv(rows: (string | number)[][]) {
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
}

export function AttendanceAnalytics() {
  const role = useAuthStore((s) => s.user?.role);
  const isHod = role === "HOD";
  const chart = useChartTheme();
  const [sessionId, setSessionId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  const sessions = useRemote("sessions", attendanceApi.sessions);
  const departments = useRemote(isHod ? null : "departments", () => api.get<{ departments: { id: string; name: string }[] }>("/departments").then((r) => r.data.departments));
  const report = useRemote(`dept:${sessionId}:${departmentId}:${page}`, () =>
    attendanceApi.departmentReport({ academicSessionId: sessionId, departmentId: isHod ? undefined : departmentId, page, pageSize: PAGE_SIZE })
  );

  const r: DepartmentReport | null = report.data;
  const t = r?.shortage.thresholds ?? { warning: 75, critical: 65 };
  const totalPages = r ? Math.max(1, Math.ceil(r.shortage.totalListed / PAGE_SIZE)) : 1;

  const exportShortage = async () => {
    setExporting(true);
    try {
      const all: DepartmentReport["shortage"]["list"] = [];
      for (let p = 1; p <= 25; p += 1) {
        const res = await attendanceApi.departmentReport({ academicSessionId: sessionId, departmentId: isHod ? undefined : departmentId, page: p, pageSize: 200 });
        all.push(...res.shortage.list);
        if (all.length >= res.shortage.totalListed) break;
      }
      const body = csv([["Roll no.", "Student", "Conducted", "Present", "Attendance %", "Below critical"], ...all.map((s) => [s.rollNumber, s.name, s.conducted, s.present, s.percentage, s.critical ? "Yes" : "No"])]);
      const url = URL.createObjectURL(new Blob([body], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `students-below-${t.warning}-percent.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(extractErrorMessage(err, "Could not export the list."));
    } finally {
      setExporting(false);
    }
  };

  const semesterData = (r?.bySemester ?? []).map((s) => ({ name: `${s.programName ?? "Program"} · Sem ${s.semester}`, pct: s.percentage, conducted: s.conducted, present: s.present }));
  const chartColor = (pct: number) => (pct < t.critical ? chart.danger : pct < t.warning ? chart.warning : chart.success);

  return (
    <div className="space-y-5">
      <section className="card p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SelectField label="Academic session" value={sessionId} onChange={(v) => { setSessionId(v); setPage(1); }} placeholder="All sessions" loading={sessions.loading} error={sessions.error} onRetry={sessions.reload} options={(sessions.data ?? []).map((s) => ({ value: s.id, label: s.isCurrent ? `${s.label} (Current)` : s.label }))} />
          {isHod ? (
            <div>
              <p className="field-label">Department</p>
              <p className="input-field flex items-center bg-surface text-text-secondary">{r?.department?.name ?? "Your department"}</p>
            </div>
          ) : (
            <SelectField label="Department" value={departmentId} onChange={(v) => { setDepartmentId(v); setPage(1); }} placeholder="All departments" loading={departments.loading} error={departments.error} onRetry={departments.reload} options={(departments.data ?? []).map((d) => ({ value: d.id, label: d.name }))} />
          )}
        </div>
      </section>

      {report.error && <Alert tone="danger" action={<button className="btn-secondary btn-sm" onClick={report.reload}>Retry</button>}>{report.error}</Alert>}
      {report.loading && <div className="py-16 text-center"><Spinner label="Calculating analytics…" /></div>}

      {r && r.overall.sessions === 0 && (
        <section className="card"><EmptyState icon={BarChart3} title="No attendance recorded yet">Analytics appear as soon as classes are submitted for this selection.</EmptyState></section>
      )}

      {r && r.overall.sessions > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatTile label="Overall attendance" value={`${r.overall.percentage}%`} tone={tone(r.overall.percentage, t) === "success" ? "success" : tone(r.overall.percentage, t) === "warning" ? "warning" : "danger"} hint={`${r.overall.present} of ${r.overall.conducted} classes`} />
            <StatTile label="Average per student" value={`${r.shortage.averageStudentPercentage}%`} hint={`${r.overall.students} students tracked`} />
            <StatTile label={`Students below ${t.warning}%`} value={r.shortage.belowWarning} tone={r.shortage.belowWarning ? "warning" : "success"} hint="Need attention" />
            <StatTile label={`Students below ${t.critical}%`} value={r.shortage.belowCritical} tone={r.shortage.belowCritical ? "danger" : "success"} hint="Critical" />
            <StatTile label="Sheets submitted" value={r.overall.sessions} hint="Attendance sessions" />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Semester-wise attendance" subtitle="Weighted by classes conducted. The dashed line is the minimum requirement.">
              <div className="h-64" role="img" aria-label={`Semester-wise attendance: ${semesterData.map((s) => `${s.name} ${s.pct}%`).join(", ")}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={semesterData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke={chart.grid} vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: chart.text, fontSize: 12 }} stroke={chart.grid} tickLine={false} interval={0} />
                    <YAxis domain={[0, 100]} tick={{ fill: chart.text, fontSize: 12 }} stroke={chart.grid} tickLine={false} tickFormatter={(v) => `${v}%`} />
                    <Tooltip cursor={{ fill: chart.grid, opacity: 0.35 }} contentStyle={{ background: chart.tooltipBg, border: `1px solid ${chart.tooltipBorder}`, borderRadius: 10, color: chart.ink }} labelStyle={{ color: chart.ink, fontWeight: 600 }} formatter={(v: number, _n, p) => [`${v}%  (${p.payload.present}/${p.payload.conducted} classes)`, "Attendance"]} />
                    <ReferenceLine y={t.warning} stroke={chart.warning} strokeDasharray="5 4" />
                    <Bar dataKey="pct" radius={[6, 6, 0, 0]} maxBarSize={56} isAnimationActive={false}>
                      {semesterData.map((d) => <Cell key={d.name} fill={chartColor(d.pct)} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card title="Section-wise attendance" subtitle="Each section within its semester">
              <ul className="divide-y divide-border">
                {r.bySection.map((s) => <ProgressRow key={`${s.sectionId}-${s.semester}`} label={`Section ${s.sectionName}`} sub={`Sem ${s.semester} · ${s.batchLabel}`} pct={s.percentage} conducted={s.conducted} present={s.present} t={t} />)}
              </ul>
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Subject-wise attendance">
              <ul className="divide-y divide-border">
                {r.bySubject.map((s) => <ProgressRow key={`${s.subjectId}-${s.semester}`} label={s.name} sub={`${s.code} · Sem ${s.semester}`} pct={s.percentage} conducted={s.conducted} present={s.present} t={t} />)}
              </ul>
            </Card>

            <Card title="Faculty attendance activity" subtitle="Who has been recording attendance">
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead><tr><th>Faculty</th><th className="text-right">Sheets</th><th className="text-right">Classes</th><th className="text-right">Avg. present</th><th>Last taken</th></tr></thead>
                  <tbody>
                    {r.byFaculty.map((f) => (
                      <tr key={f.facultyId ?? "none"}>
                        <td className="font-medium">{f.name}</td>
                        <td className="num text-right">{f.sessions}</td>
                        <td className="num text-right">{f.classes}</td>
                        <td className="num text-right">{f.averagePercentage}%</td>
                        <td className="whitespace-nowrap text-text-secondary">{formatShortDate(f.lastDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          <section className="card overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary"><TriangleAlert className="h-4 w-4 text-warning" aria-hidden="true" />Students below {t.warning}%</h3>
                <p className="mt-0.5 text-xs text-text-secondary">{r.shortage.totalListed} student{r.shortage.totalListed === 1 ? "" : "s"}, lowest attendance first. Critical means below {t.critical}%.</p>
              </div>
              <button className="btn-secondary btn-sm self-start" onClick={exportShortage} disabled={exporting || r.shortage.totalListed === 0}><Download className="h-3.5 w-3.5" aria-hidden="true" />{exporting ? "Preparing…" : "Export CSV"}</button>
            </div>
            {r.shortage.list.length === 0 ? (
              <EmptyState title="Nobody is below the requirement">Every student tracked is at or above {t.warning}%.</EmptyState>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="table-base">
                    <thead><tr><th>Roll no.</th><th>Student</th><th className="text-right">Present / Conducted</th><th className="text-right">Attendance</th><th>Level</th></tr></thead>
                    <tbody>
                      {r.shortage.list.map((s) => (
                        <tr key={s.studentId}>
                          <td className="num font-medium">{s.rollNumber}</td>
                          <td>{s.name}</td>
                          <td className="num text-right text-text-secondary">{s.present} / {s.conducted}</td>
                          <td className="num text-right font-semibold">{s.percentage}%</td>
                          <td><span className={s.critical ? "badge-danger" : "badge-warning"}>{s.critical ? "Critical" : "Warning"}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3 text-sm text-text-secondary">
                    <button className="btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
                    <span className="num">Page {page} of {totalPages}</span>
                    <button className="btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
                  </div>
                )}
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
