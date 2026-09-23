import { MessageSquarePlus, Search, UserCheck, UserX } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { EmptyState } from "../../components/ui/Feedback";
import { AttendanceToggle } from "./AttendanceToggle";
import { RosterStudent } from "./attendance.types";

export type Marks = Record<string, "PRESENT" | "ABSENT">;

export function summarize(students: RosterStudent[], marks: Marks) {
  const total = students.length;
  const present = students.reduce((n, s) => n + (marks[s.studentId] === "PRESENT" ? 1 : 0), 0);
  return { total, present, absent: total - present, percentage: total ? Math.round((present / total) * 1000) / 10 : 0 };
}

const KIND_LABEL = { BACKLOG: "Backlog", ELECTIVE: "Elective" } as const;

function KindBadge({ kind }: { kind: RosterStudent["kind"] }) {
  if (kind === "REGULAR") return null;
  return <span className="badge-info ml-2 align-middle">{KIND_LABEL[kind]}</span>;
}

// -------------------------------------------------------------------------------------------------
// Rows are memoised: toggling one student must not re-render all 60-150 rows.
// -------------------------------------------------------------------------------------------------
interface RowProps {
  index: number;
  student: RosterStudent;
  checked: boolean;
  remark: string;
  disabled?: boolean;
  onToggle: (studentId: string, present: boolean) => void;
  onRemark: (studentId: string, value: string) => void;
}

const TableRow = memo(function TableRow({ index, student, checked, remark, onToggle, onRemark }: RowProps) {
  return (
    <tr className={checked ? "" : "bg-danger/[0.03]"}>
      <td className="num w-12 text-text-muted">{index}</td>
      <td className="num whitespace-nowrap font-medium text-text-primary">{student.rollNumber}</td>
      <td className="num whitespace-nowrap text-text-secondary">{student.registrationNumber}</td>
      <td className="min-w-[10rem] text-text-primary">
        {student.fullName}
        <KindBadge kind={student.kind} />
      </td>
      <td className="whitespace-nowrap">
        <AttendanceToggle checked={checked} onChange={(v) => onToggle(student.studentId, v)} label={`${student.fullName} – ${checked ? "present" : "absent"}`} />
      </td>
      <td className="min-w-[10rem]">
        <input
          className="input-field !min-h-9 !py-1.5"
          value={remark}
          maxLength={200}
          placeholder="Optional remark"
          aria-label={`Remark for ${student.fullName}`}
          onChange={(e) => onRemark(student.studentId, e.target.value)}
        />
      </td>
    </tr>
  );
});

const CardRow = memo(function CardRow({ index, student, checked, remark, onToggle, onRemark }: RowProps) {
  const [showRemark, setShowRemark] = useState(Boolean(remark));
  return (
    <li className={`rounded-xl border p-3.5 transition-colors ${checked ? "border-border bg-surface-card" : "border-danger/25 bg-danger/[0.04]"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-snug text-text-primary">
            <span className="num mr-1.5 font-normal text-text-muted">{index}.</span>
            {student.fullName}
            <KindBadge kind={student.kind} />
          </p>
          <p className="num mt-0.5 text-xs text-text-secondary">
            {student.rollNumber} · {student.registrationNumber}
          </p>
        </div>
        <AttendanceToggle checked={checked} onChange={(v) => onToggle(student.studentId, v)} label={`${student.fullName} – ${checked ? "present" : "absent"}`} />
      </div>
      {showRemark ? (
        <input
          className="input-field mt-2.5"
          value={remark}
          maxLength={200}
          placeholder="Optional remark"
          aria-label={`Remark for ${student.fullName}`}
          onChange={(e) => onRemark(student.studentId, e.target.value)}
        />
      ) : (
        <button type="button" onClick={() => setShowRemark(true)} className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary">
          <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden="true" /> Add remark
        </button>
      )}
    </li>
  );
});

// -------------------------------------------------------------------------------------------------
interface PanelProps {
  students: RosterStudent[];
  marks: Marks;
  onMarksChange: (updater: (prev: Marks) => Marks) => void;
  remarks: Record<string, string>;
  onRemarksChange: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
}

export function RosterPanel({ students, marks, onMarksChange, remarks, onRemarksChange }: PanelProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const terms = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return students;
    return students.filter((s) => {
      const haystack = `${s.rollNumber} ${s.registrationNumber} ${s.fullName}`.toLowerCase();
      return terms.every((t) => haystack.includes(t));
    });
  }, [students, search]);

  const stats = summarize(students, marks);
  const filtering = search.trim().length > 0;
  // serial numbers stay stable while filtering (row 17 is always #17)
  const serial = useMemo(() => new Map(students.map((s, i) => [s.studentId, i + 1])), [students]);

  const onToggle = useCallback(
    (studentId: string, present: boolean) => onMarksChange((prev) => ({ ...prev, [studentId]: present ? "PRESENT" : "ABSENT" })),
    [onMarksChange]
  );
  const onRemark = useCallback(
    (studentId: string, value: string) => onRemarksChange((prev) => ({ ...prev, [studentId]: value })),
    [onRemarksChange]
  );

  // Bulk actions touch only the students currently shown; everyone else keeps their mark (search never loses state).
  const setShown = (status: "PRESENT" | "ABSENT") =>
    onMarksChange((prev) => {
      const next = { ...prev };
      for (const s of filtered) next[s.studentId] = status;
      return next;
    });

  const healthTone = stats.total === 0 ? "" : stats.percentage >= 75 ? "text-success" : stats.percentage >= 65 ? "text-warning" : "text-danger";

  return (
    <section className="card overflow-hidden" aria-label="Student attendance">
      {/* ---------- header: live counters + bulk actions ---------- */}
      <div className="border-b border-border p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-text-primary">Mark attendance</h2>
            <p className="mt-0.5 text-sm text-text-secondary">Everyone starts as absent by default. Tick the students who are present.</p>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:gap-3" role="status" aria-live="polite" aria-label={`${stats.present} present, ${stats.absent} absent, ${stats.total} total`}>
            {[
              { label: "Total", value: stats.total, cls: "text-text-primary" },
              { label: "Present", value: stats.present, cls: "text-success" },
              { label: "Absent", value: stats.absent, cls: "text-danger" },
              { label: "Attendance", value: `${stats.percentage}%`, cls: healthTone },
            ].map((t) => (
              <div key={t.label} className="min-w-[4.25rem] rounded-lg bg-surface px-2.5 py-2 text-center sm:px-4">
                <p className={`num text-lg font-semibold leading-none sm:text-xl ${t.cls}`}>{t.value}</p>
                <p className="mt-1 text-[11px] font-medium text-text-secondary sm:text-xs">{t.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-danger/20" aria-hidden="true">
          <div className="bg-success transition-[width] duration-300" style={{ width: `${stats.total ? (stats.present / stats.total) * 100 : 0}%` }} />
        </div>

        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
            <input
              type="search"
              className="input-field pl-9"
              placeholder="Search roll no., reg. no., name"
              aria-label="Search students"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 md:flex">
            <button type="button" className="btn-primary !bg-success hover:!brightness-110" onClick={() => setShown("PRESENT")}>
              <UserCheck className="h-4 w-4" aria-hidden="true" />
              {filtering ? `Select shown present (${filtered.length})` : "Select all present"}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setShown("ABSENT")}>
              <UserX className="h-4 w-4" aria-hidden="true" />
              {filtering ? `Mark shown absent (${filtered.length})` : "Mark all absent"}
            </button>
          </div>
        </div>
        {filtering && (
          <p className="mt-2 text-xs text-text-secondary" aria-live="polite">
            Showing {filtered.length} of {students.length} students. Bulk actions apply only to the students shown; everyone else keeps their mark.
          </p>
        )}
      </div>

      {/* ---------- list ---------- */}
      {filtered.length === 0 ? (
        <EmptyState icon={Search} title="No student matches your search">
          Check the spelling, or search by roll number or registration number.
        </EmptyState>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="table-base">
              <thead>
                <tr>
                  <th className="w-12">#</th>
                  <th>Roll no.</th>
                  <th>Registration no.</th>
                  <th>Student name</th>
                  <th>Attendance</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <TableRow key={s.studentId} index={serial.get(s.studentId) ?? 0} student={s} checked={marks[s.studentId] === "PRESENT"} remark={remarks[s.studentId] ?? ""} onToggle={onToggle} onRemark={onRemark} />
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-2.5 p-3 md:hidden">
            {filtered.map((s) => (
              <CardRow key={s.studentId} index={serial.get(s.studentId) ?? 0} student={s} checked={marks[s.studentId] === "PRESENT"} remark={remarks[s.studentId] ?? ""} onToggle={onToggle} onRemark={onRemark} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
