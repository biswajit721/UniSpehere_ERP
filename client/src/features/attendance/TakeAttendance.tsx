import { CalendarClock, CheckCircle2, ClipboardCheck, Clock, Eye, Loader2, Pencil, RotateCcw, Users } from "lucide-react";
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "../../components/ui/Feedback";
import { SelectField } from "../../components/ui/SelectField";
import { useAuthStore } from "../../store/authStore";
import { toast } from "../../store/toastStore";
import { formatDuration, formatLongDate, formatShortDate, isOutside, timeToMinutes, todayLocal } from "../../utils/dates";
import { extractErrorMessage } from "../../utils/errorMessage";
import { useRemote } from "../../utils/useRemote";
import { attendanceApi, ClassSelection } from "./attendance.api";
import { RosterResponse, SubmitResult } from "./attendance.types";
import { ConfirmSubmitModal } from "./ConfirmSubmitModal";
import { Marks, RosterPanel, summarize } from "./RosterPanel";

const isCompleteDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

function Step({ n, title, hint, children }: { n: number; title: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-3 flex items-center gap-2.5">
        <span className="num inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary" aria-hidden="true">{n}</span>
        <span className="text-sm font-semibold text-text-primary">{title}</span>
        {hint && <span className="hidden text-xs text-text-muted sm:inline">{hint}</span>}
      </legend>
      {children}
    </fieldset>
  );
}

interface Props {
  /** opens the attendance sheet (view or edit) - used when the class was already submitted */
  onOpenSheet: (id: string, mode?: "view" | "edit") => void;
}

export function TakeAttendance({ onOpenSheet }: Props) {
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === "SUPER_ADMIN" || role === "UNIV_ADMIN";

  // ------------------------------------------------------------------ selections (nothing is pre-selected)
  const [sessionId, setSessionId] = useState("");
  const [semesterNumber, setSemesterNumber] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [programId, setProgramId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [date, setDate] = useState(todayLocal()); // a convenience default that stays editable
  const [period, setPeriod] = useState("");
  const [numberOfClasses, setNumberOfClasses] = useState("1");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [timesEdited, setTimesEdited] = useState(false);
  const [allowOutside, setAllowOutside] = useState(false);

  // ------------------------------------------------------------------ roster state
  const [roster, setRoster] = useState<RosterResponse | null>(null);
  const [marks, setMarks] = useState<Marks>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<SubmitResult | null>(null);

  // ------------------------------------------------------------------ reference data, each level from the previous one
  const sessions = useRemote("sessions", attendanceApi.sessions);
  const policy = useRemote("policy", attendanceApi.policy);
  const semesters = useRemote(sessionId ? `sem:${sessionId}` : null, () => attendanceApi.semesters(sessionId));
  const departments = useRemote(sessionId && semesterNumber ? `dep:${sessionId}:${semesterNumber}` : null, () => attendanceApi.departments(sessionId, Number(semesterNumber)));
  const programs = useRemote(sessionId && semesterNumber && departmentId ? `prog:${sessionId}:${semesterNumber}:${departmentId}` : null, () =>
    attendanceApi.programs(sessionId, Number(semesterNumber), departmentId)
  );
  // The semester ID is resolved by the server for the chosen program - the page never guesses it.
  const semesterId = programs.data?.find((p) => p.id === programId)?.semesterId ?? "";
  const sections = useRemote(sessionId && semesterId && programId ? `sec:${sessionId}:${semesterId}:${programId}` : null, () =>
    attendanceApi.sections(sessionId, semesterId, programId)
  );
  const subjects = useRemote(sessionId && semesterId && sectionId ? `sub:${sessionId}:${semesterId}:${sectionId}` : null, () =>
    attendanceApi.subjects(sessionId, semesterId, sectionId)
  );
  const periods = useRemote(sessionId && sectionId && subjectId && isCompleteDate(date) ? `per:${sessionId}:${sectionId}:${subjectId}:${date}` : null, () =>
    attendanceApi.periods(sessionId, sectionId, subjectId, date)
  );

  const selectedSession = sessions.data?.find((s) => s.id === sessionId) ?? null;
  const maxClasses = policy.data?.maxClassesPerSession ?? 0;

  // ------------------------------------------------------------------ cascading resets: changing a parent clears everything below it
  const clearRoster = useCallback(() => {
    setRoster(null);
    setMarks({});
    setRemarks({});
    setLoadError(null);
    setSubmitted(null);
    setSubmitError(null);
  }, []);

  const onSession = (v: string) => { setSessionId(v); setSemesterNumber(""); setDepartmentId(""); setProgramId(""); setSectionId(""); setSubjectId(""); setPeriod(""); setAllowOutside(false); clearRoster(); };
  const onSemester = (v: string) => { setSemesterNumber(v); setDepartmentId(""); setProgramId(""); setSectionId(""); setSubjectId(""); setPeriod(""); clearRoster(); };
  const onDepartment = (v: string) => { setDepartmentId(v); setProgramId(""); setSectionId(""); setSubjectId(""); setPeriod(""); clearRoster(); };
  const onProgram = (v: string) => { setProgramId(v); setSectionId(""); setSubjectId(""); setPeriod(""); clearRoster(); };
  const onSection = (v: string) => { setSectionId(v); setSubjectId(""); setPeriod(""); clearRoster(); };
  const onSubject = (v: string) => { setSubjectId(v); setPeriod(""); clearRoster(); };
  const onDate = (v: string) => { setDate(v); clearRoster(); };

  // ------------------------------------------------------------------ period + time derivation (grid comes from the database)
  const periodList = periods.data?.periods ?? [];
  const selectedPeriod = periodList.find((p) => String(p.number) === period) ?? null;
  const classes = Number(numberOfClasses) || 1;
  const covered = selectedPeriod ? Array.from({ length: classes }, (_, i) => periodList.find((p) => p.number === selectedPeriod.number + i)) : [];
  const spanComplete = covered.length === classes && covered.every(Boolean);
  const defaultStart = selectedPeriod?.startTime ?? "";
  const defaultEnd = spanComplete ? covered[classes - 1]!.endTime : "";

  useEffect(() => {
    if (timesEdited) return;
    setStartTime(defaultStart);
    setEndTime(defaultEnd);
  }, [defaultStart, defaultEnd, timesEdited]);

  const onPeriod = (v: string) => {
    setPeriod(v);
    setTimesEdited(false);
    clearRoster();
    const p = periodList.find((x) => String(x.number) === v);
    // The timetable knows when a double period is scheduled - suggest it (still editable)
    if (p?.scheduledClasses && p.scheduledClasses > 0 && (maxClasses === 0 || p.scheduledClasses <= maxClasses)) setNumberOfClasses(String(p.scheduledClasses));
  };
  const onClasses = (v: string) => { setNumberOfClasses(v); setTimesEdited(false); clearRoster(); };
  const onTimeEdit = (which: "start" | "end", v: string) => {
    setTimesEdited(true);
    if (which === "start") setStartTime(v);
    else setEndTime(v);
    clearRoster();
  };

  const durationMinutes = startTime && endTime ? timeToMinutes(endTime) - timeToMinutes(startTime) : 0;

  // ------------------------------------------------------------------ validation that blocks "Load students"
  const problems: string[] = [];
  const warnings: string[] = [];
  const today = todayLocal();
  if (selectedPeriod && !spanComplete) problems.push(`The period grid has no Period ${selectedPeriod.number + covered.findIndex((c) => !c)}, so ${classes} consecutive classes cannot start at Period ${selectedPeriod.number}.`);
  if (startTime && endTime && durationMinutes <= 0) problems.push("End time must be after start time.");
  if (isCompleteDate(date) && date > today && policy.data && !policy.data.allowFutureAttendance) problems.push("Attendance cannot be recorded for a future date.");
  const outside = selectedSession && isCompleteDate(date) && policy.data?.enforceSessionDates !== false && isOutside(date, selectedSession.startDate, selectedSession.endDate);
  if (outside && !(isAdmin && allowOutside)) {
    problems.push(`${formatShortDate(date)} is outside academic session ${selectedSession!.label} (${formatShortDate(selectedSession!.startDate)} – ${formatShortDate(selectedSession!.endDate)}).`);
  }
  if (periods.data && !periods.data.gridConfigured) problems.push("No periods are configured yet. Ask an administrator to set up the period grid under Academics → Periods.");
  if (selectedPeriod?.taken) warnings.push(`Period ${selectedPeriod.number} already has attendance for this class. Load students to open it.`);

  const ready = Boolean(sessionId && semesterNumber && departmentId && programId && semesterId && sectionId && subjectId && isCompleteDate(date) && period && classes >= 1 && startTime && endTime);
  const canLoad = ready && problems.length === 0 && !loading;

  const selection: ClassSelection | null = ready
    ? { academicSessionId: sessionId, semesterId, departmentId, programId, sectionId, subjectId, date, period: Number(period), numberOfClasses: classes, startTime, endTime }
    : null;

  // ------------------------------------------------------------------ actions
  const loadStudents = async () => {
    if (!selection) return;
    clearRoster();
    setLoading(true);
    try {
      const res = await attendanceApi.roster(selection, isAdmin && allowOutside);
      setRoster(res);
      if (!res.existing) {
        // The policy decides the starting state (default: everyone ABSENT, teacher ticks who is present)
        const start = res.defaultStatus === "PRESENT" ? "PRESENT" : "ABSENT";
        setMarks(Object.fromEntries(res.students.map((s) => [s.studentId, start])));
      }
    } catch (err) {
      setLoadError(extractErrorMessage(err, "Could not load the students for this class."));
    } finally {
      setLoading(false);
    }
  };

  const totals = useMemo(() => (roster ? summarize(roster.students, marks) : { total: 0, present: 0, absent: 0, percentage: 0 }), [roster, marks]);
  const defaultMark = roster?.defaultStatus === "PRESENT" ? "PRESENT" : "ABSENT";
  const dirty = Boolean(roster && !roster.existing && !submitted && roster.students.some((s) => marks[s.studentId] !== defaultMark));

  // warn before the tab closes with unsaved marks
  useEffect(() => {
    if (!dirty) return;
    const guard = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);

  // lift the floating assistant button above the sticky submit bar on phones
  const barVisible = Boolean(roster && !roster.existing && !submitted);
  useEffect(() => {
    if (!barVisible) return;
    document.documentElement.style.setProperty("--sticky-bar", "5.5rem");
    document.documentElement.setAttribute("data-sticky-bar", "");
    return () => {
      document.documentElement.style.removeProperty("--sticky-bar");
      document.documentElement.removeAttribute("data-sticky-bar");
    };
  }, [barVisible]);

  const submit = async () => {
    if (!selection || !roster) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const records = roster.students.map((s) => ({
        studentId: s.studentId,
        status: marks[s.studentId] ?? "ABSENT",
        ...(remarks[s.studentId]?.trim() ? { remarks: remarks[s.studentId].trim() } : {}),
      }));
      const res = await attendanceApi.submit(selection, records, isAdmin && allowOutside);
      setSubmitted(res.attendance);
      setRoster(null);
      setConfirmOpen(false);
      toast.success("Attendance submitted successfully.");
    } catch (err: any) {
      const existingId = err?.response?.data?.details?.attendanceId as string | undefined;
      if (err?.response?.status === 409 && existingId) {
        setConfirmOpen(false);
        setRoster(null);
        setLoadError("Attendance has already been submitted for this class.");
        setSubmitError(existingId);
      } else {
        setSubmitError(extractErrorMessage(err, "Could not submit attendance. Nothing was saved."));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const takeAnother = () => {
    clearRoster();
    setPeriod("");
    setTimesEdited(false);
    window.scrollTo?.({ top: 0 });
    document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const noClasses = sessionId && semesters.data && semesters.data.length === 0;

  // Bring the outcome (student list, "already submitted", or the success card) into view - on a phone or
  // a short laptop screen it would otherwise appear below the fold and look like nothing happened.
  const resultsRef = useRef<HTMLDivElement>(null);
  const hasOutcome = Boolean(roster || submitted || loadError);
  useEffect(() => {
    if (hasOutcome) resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hasOutcome, submitted, roster]);

  // ==================================================================================================
  return (
    <div className="space-y-5">
      <section className="card">
        <div className="border-b border-border px-4 py-4 sm:px-6">
          <h2 className="text-base font-semibold text-text-primary">Class setup</h2>
          <p className="mt-0.5 text-sm text-text-secondary">Choose the academic structure, then the class you are taking. Each list only offers what exists for your previous choice.</p>
        </div>

        <div className="space-y-6 p-4 sm:p-6">
          <Step n={1} title="Academic context" hint="Session → Semester → Department → Program → Section">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
              <SelectField
                label="Academic session"
                required
                value={sessionId}
                onChange={onSession}
                placeholder="Select academic session"
                loading={sessions.loading}
                error={sessions.error}
                onRetry={sessions.reload}
                emptyText="No academic sessions"
                options={(sessions.data ?? []).map((s) => ({ value: s.id, label: s.isCurrent ? `${s.label} (Current)` : s.label }))}
              />
              <SelectField
                label="Semester"
                required
                value={semesterNumber}
                onChange={onSemester}
                waitingFor={!sessionId ? "academic session" : null}
                loading={semesters.loading}
                error={semesters.error}
                onRetry={semesters.reload}
                emptyText="No classes found"
                options={(semesters.data ?? []).map((s) => ({ value: String(s.number), label: s.name }))}
              />
              <SelectField
                label="Department"
                required
                value={departmentId}
                onChange={onDepartment}
                waitingFor={!semesterNumber ? "semester" : null}
                loading={departments.loading}
                error={departments.error}
                onRetry={departments.reload}
                options={(departments.data ?? []).map((d) => ({ value: d.id, label: d.name }))}
              />
              <SelectField
                label="Program"
                required
                value={programId}
                onChange={onProgram}
                waitingFor={!departmentId ? "department" : null}
                loading={programs.loading}
                error={programs.error}
                onRetry={programs.reload}
                options={(programs.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
              />
              <SelectField
                label="Section"
                required
                value={sectionId}
                onChange={onSection}
                waitingFor={!programId ? "program" : null}
                loading={sections.loading}
                error={sections.error}
                onRetry={sections.reload}
                options={(sections.data ?? []).map((s) => ({ value: s.id, label: `${s.name} · Batch ${s.batchLabel}` }))}
              />
            </div>
            {noClasses && (
              <Alert tone="info" className="mt-4" title="No classes found for this session">
                {role === "FACULTY"
                  ? "You are not assigned to any class in this academic session, or no students are enrolled yet. Ask your HOD to assign your subjects under Academics → Faculty assignments."
                  : "No students are enrolled in this academic session yet."}
              </Alert>
            )}
          </Step>

          <Step n={2} title="Class details" hint="Subject, date and periods">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-6 lg:grid-cols-12">
              <div className="sm:col-span-6 lg:col-span-5">
                <SelectField
                  label="Subject"
                  required
                  value={subjectId}
                  onChange={onSubject}
                  waitingFor={!sectionId ? "section" : null}
                  loading={subjects.loading}
                  error={subjects.error}
                  onRetry={subjects.reload}
                  emptyText={role === "FACULTY" ? "No subject assigned to you" : "No subjects found"}
                  options={(subjects.data ?? []).map((s) => ({ value: s.id, label: `${s.name}${s.isElective ? " (Elective)" : ""}` }))}
                />
              </div>
              <div className="sm:col-span-3 lg:col-span-3">
                <label htmlFor="att-date" className="field-label">Date<span className="ml-0.5 text-danger" aria-hidden="true">*</span></label>
                <input
                  id="att-date"
                  type="date"
                  className="input-field"
                  value={date}
                  max={policy.data && !policy.data.allowFutureAttendance ? today : undefined}
                  onChange={(e) => onDate(e.target.value)}
                />
                {selectedSession && (
                  <p className="mt-1 text-xs text-text-muted">Session runs {formatShortDate(selectedSession.startDate)} – {formatShortDate(selectedSession.endDate)}</p>
                )}
              </div>
              <div className="sm:col-span-3 lg:col-span-4">
                <SelectField
                  label="Period"
                  required
                  value={period}
                  onChange={onPeriod}
                  waitingFor={!subjectId ? "subject" : !isCompleteDate(date) ? "date" : null}
                  loading={periods.loading}
                  error={periods.error}
                  onRetry={periods.reload}
                  emptyText="No periods configured"
                  options={periodList.map((p) => ({
                    value: String(p.number),
                    label: `${p.label} · ${p.startTime}–${p.endTime}${p.taken ? " · taken" : p.scheduled ? " · scheduled" : ""}`,
                  }))}
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-4">
                <SelectField
                  label="Number of classes"
                  required
                  value={numberOfClasses}
                  onChange={onClasses}
                  loading={policy.loading}
                  error={policy.error}
                  onRetry={policy.reload}
                  placeholder="Select"
                  waitingFor={!period ? "period" : null}
                  options={Array.from({ length: maxClasses }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))}
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-4">
                <label htmlFor="att-start" className="field-label">Start time</label>
                <input id="att-start" type="time" className="input-field" value={startTime} disabled={!period} onChange={(e) => onTimeEdit("start", e.target.value)} />
              </div>
              <div className="sm:col-span-2 lg:col-span-4">
                <label htmlFor="att-end" className="field-label">End time</label>
                <input id="att-end" type="time" className="input-field" value={endTime} disabled={!period} onChange={(e) => onTimeEdit("end", e.target.value)} />
              </div>
            </div>

            {/* what the timetable and grid say about the chosen period */}
            {selectedPeriod && (
              <div className="mt-4 space-y-2 rounded-lg bg-surface px-3.5 py-3 text-sm">
                {selectedPeriod.scheduled ? (
                  <p className="flex items-start gap-2 text-text-primary">
                    <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                    <span>On the timetable{selectedPeriod.scheduledFaculty ? ` · ${selectedPeriod.scheduledFaculty}` : ""}{selectedPeriod.room ? ` · Room ${selectedPeriod.room}` : ""}{selectedPeriod.scheduledClasses && selectedPeriod.scheduledClasses > 1 ? ` · ${selectedPeriod.scheduledClasses} consecutive periods` : ""}</span>
                  </p>
                ) : periods.data?.hasTimetable ? (
                  <p className="flex items-start gap-2 text-text-secondary">
                    <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>This class is not on the timetable for {formatShortDate(date)}. You can still record it.</span>
                  </p>
                ) : null}
                <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-text-secondary">
                  <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4" aria-hidden="true" />Duration <strong className="num font-semibold text-text-primary">{formatDuration(durationMinutes)}</strong></span>
                  {spanComplete && classes > 1 && covered.map((c, i) => (
                    <span key={c!.number} className="num">Class {i + 1}: {c!.startTime}–{c!.endTime}</span>
                  ))}
                  {timesEdited && (
                    <button type="button" className="inline-flex items-center gap-1 font-medium text-primary" onClick={() => { setTimesEdited(false); }}>
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Reset to period times
                    </button>
                  )}
                </p>
              </div>
            )}
          </Step>

          {problems.length > 0 && (
            <div className="space-y-2">
              {problems.map((p) => <Alert key={p} tone="warning">{p}</Alert>)}
              {isAdmin && outside && (
                <label className="flex cursor-pointer items-center gap-2 text-sm text-text-primary">
                  <input type="checkbox" checked={allowOutside} onChange={(e) => { setAllowOutside(e.target.checked); clearRoster(); }} className="h-4 w-4" />
                  Allow this date outside the academic session (administrators only, recorded in the audit log)
                </label>
              )}
            </div>
          )}
          {problems.length === 0 && warnings.map((w) => <Alert key={w} tone="info">{w}</Alert>)}
        </div>

        <div className="flex flex-col gap-3 border-t border-border bg-surface/50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-sm text-text-secondary">
            {ready ? "Ready. Load the students enrolled in this class." : "Complete every field above to load the students."}
          </p>
          <button type="button" className="btn-primary w-full sm:w-auto" disabled={!canLoad} onClick={loadStudents}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Users className="h-4 w-4" aria-hidden="true" />}
            {loading ? "Loading students…" : "Load students"}
          </button>
        </div>
      </section>

      {/* ------------------------------------------------------------------ outcomes */}
      <div ref={resultsRef} className="scroll-mt-4 space-y-5">
      {loadError && (
        <Alert
          tone={submitError ? "warning" : "danger"}
          title={submitError ? "Already submitted" : "Could not load students"}
          action={submitError ? <button className="btn-secondary btn-sm" onClick={() => onOpenSheet(submitError, "view")}><Eye className="h-3.5 w-3.5" aria-hidden="true" />View attendance</button> : undefined}
        >
          {loadError}
        </Alert>
      )}

      {roster?.existing && (
        <Alert
          tone="warning"
          title="Attendance has already been submitted for this class."
          action={
            <div className="flex flex-wrap gap-2">
              <button className="btn-secondary btn-sm" onClick={() => onOpenSheet(roster.existing!.id, "view")}><Eye className="h-3.5 w-3.5" aria-hidden="true" />View attendance</button>
              <button className="btn-primary btn-sm" onClick={() => onOpenSheet(roster.existing!.id, "edit")}><Pencil className="h-3.5 w-3.5" aria-hidden="true" />Edit attendance</button>
            </div>
          }
        >
          Submitted by {roster.existing.recordedBy} on {formatLongDate(roster.existing.submittedAt.slice(0, 10))}. Corrections are logged with a reason; only permitted roles can edit.
        </Alert>
      )}

      {roster && !roster.existing && (
        <>
          <RosterPanel students={roster.students} marks={marks} onMarksChange={setMarks} remarks={remarks} onRemarksChange={setRemarks} />

          {/* sticky action bar: always in reach, on a phone too */}
          <div className="pb-safe sticky bottom-0 z-20 -mx-3 border-t border-border bg-surface-card/95 px-3 py-3 backdrop-blur sm:-mx-0 sm:rounded-xl sm:border sm:px-5 sm:shadow-pop">
            <div className="flex items-center justify-between gap-3">
              <p className="num text-sm text-text-secondary" aria-live="polite">
                <span className="sm:hidden"><strong className="text-success">{totals.present}</strong>/{totals.total} present · <strong className="text-text-primary">{totals.percentage}%</strong></span>
                <span className="hidden sm:inline"><strong className="text-success">{totals.present}</strong> present · <strong className="text-danger">{totals.absent}</strong> absent · <strong className="text-text-primary">{totals.percentage}%</strong></span>
              </p>
              <button type="button" className="btn-primary shrink-0 whitespace-nowrap" onClick={() => { setSubmitError(null); setConfirmOpen(true); }}>
                <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                Submit attendance
              </button>
            </div>
          </div>
        </>
      )}

      {submitted && (
        <section className="card animate-pop-in border-success/40 p-5 sm:p-6" aria-live="polite">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
              <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-text-primary">Attendance submitted successfully.</h2>
              <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
                {[
                  ["Attendance ID", <span key="id" className="num break-all font-mono text-xs">{submitted.id.slice(0, 8).toUpperCase()}</span>],
                  ["Date", formatShortDate(submitted.date)],
                  ["Subject", submitted.subject.name],
                  ["Section", `${submitted.section.name} · ${submitted.section.batchLabel}`],
                  ["Present", <span key="p" className="num font-semibold text-success">{submitted.present}</span>],
                  ["Absent", <span key="a" className="num font-semibold text-danger">{submitted.absent}</span>],
                ].map(([k, v]) => (
                  <div key={String(k)} className="min-w-0">
                    <dt className="text-xs text-text-secondary">{k}</dt>
                    <dd className="mt-0.5 font-medium text-text-primary">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="btn-primary btn-sm" onClick={takeAnother}>Take another class</button>
                <button className="btn-secondary btn-sm" onClick={() => onOpenSheet(submitted.id, "view")}><Eye className="h-3.5 w-3.5" aria-hidden="true" />View attendance</button>
              </div>
            </div>
          </div>
        </section>
      )}

      </div>

      <ConfirmSubmitModal
        open={confirmOpen}
        ctx={roster?.class ?? null}
        totals={totals}
        submitting={submitting}
        error={submitError && !loadError ? submitError : null}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={submit}
      />
    </div>
  );
}
