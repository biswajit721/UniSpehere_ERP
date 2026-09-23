import { AlertTriangle, Loader2 } from "lucide-react";
import { ReactNode } from "react";
import { Alert } from "../../components/ui/Feedback";
import { Modal } from "../../components/ui/Modal";
import { formatLongDate } from "../../utils/dates";
import { ClassContext } from "./attendance.types";

interface Props {
  open: boolean;
  ctx: ClassContext | null;
  totals: { total: number; present: number; absent: number; percentage: number };
  submitting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-sm text-text-secondary">{label}</dt>
      <dd className="text-right text-sm font-medium text-text-primary">{children}</dd>
    </div>
  );
}

export function ConfirmSubmitModal({ open, ctx, totals, submitting, error, onCancel, onConfirm }: Props) {
  if (!ctx) return null;
  const periods = ctx.classes.length > 1 ? `${ctx.classes[0].periodNumber}–${ctx.classes[ctx.classes.length - 1].periodNumber}` : String(ctx.period);

  return (
    <Modal
      open={open}
      onClose={onCancel}
      dismissible={!submitting}
      title="Confirm attendance"
      description="Check the details below. Corrections after submitting need a reason and are logged."
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={submitting}>Cancel</button>
          <button type="button" className="btn-primary" onClick={onConfirm} disabled={submitting} data-autofocus>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {submitting ? "Submitting…" : "Submit attendance"}
          </button>
        </>
      }
    >
      <dl className="divide-y divide-border">
        <Row label="Academic session">{ctx.academicSession.label}</Row>
        <Row label="Semester">{ctx.semester.name}</Row>
        <Row label="Program">{ctx.program.name}</Row>
        <Row label="Section">{ctx.section.name} <span className="font-normal text-text-secondary">({ctx.section.batchLabel})</span></Row>
        <Row label="Subject">{ctx.subject.name}</Row>
        <Row label="Date">{formatLongDate(ctx.date)}</Row>
        <Row label="Period">{periods} <span className="num font-normal text-text-secondary">· {ctx.startTime}–{ctx.endTime}</span></Row>
        <Row label="Classes">{ctx.numberOfClasses}</Row>
      </dl>

      <div className="mt-4 grid grid-cols-4 gap-2 rounded-xl bg-surface p-3 text-center">
        {[
          { l: "Total students", v: totals.total, c: "text-text-primary" },
          { l: "Present", v: totals.present, c: "text-success" },
          { l: "Absent", v: totals.absent, c: "text-danger" },
          { l: "Attendance", v: `${totals.percentage}%`, c: "text-text-primary" },
        ].map((x) => (
          <div key={x.l}>
            <p className={`num text-xl font-semibold ${x.c}`}>{x.v}</p>
            <p className="mt-0.5 text-[11px] leading-tight text-text-secondary">{x.l}</p>
          </div>
        ))}
      </div>

      {totals.present === 0 && (
        <Alert tone="warning" className="mt-3" title="Nobody is marked present">
          <span className="inline-flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> If that is not right, cancel and tick the students who attended.</span>
        </Alert>
      )}
      {error && <Alert tone="danger" className="mt-3">{error}</Alert>}
    </Modal>
  );
}
