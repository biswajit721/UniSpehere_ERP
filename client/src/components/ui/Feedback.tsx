import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from "lucide-react";
import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

type Tone = "info" | "success" | "warning" | "danger";

const TONES: Record<Tone, { box: string; icon: LucideIcon }> = {
  info: { box: "border-info/30 bg-info-soft text-text-primary", icon: Info },
  success: { box: "border-success/30 bg-success-soft text-text-primary", icon: CheckCircle2 },
  warning: { box: "border-warning/30 bg-warning-soft text-text-primary", icon: AlertTriangle },
  danger: { box: "border-danger/30 bg-danger-soft text-text-primary", icon: XCircle },
};
const ICON_COLOR: Record<Tone, string> = { info: "text-info", success: "text-success", warning: "text-warning", danger: "text-danger" };

/** Inline notice. Never relies on colour alone: every tone has its own icon and text. */
export function Alert({ tone = "info", title, children, action, className = "" }: { tone?: Tone; title?: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  const { box, icon: Icon } = TONES[tone];
  return (
    <div role={tone === "danger" || tone === "warning" ? "alert" : "status"} className={`flex items-start gap-3 rounded-lg border px-3.5 py-3 text-sm ${box} ${className}`}>
      <Icon className={`mt-0.5 h-[18px] w-[18px] shrink-0 ${ICON_COLOR[tone]}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? "mt-0.5 text-text-secondary" : ""}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function Spinner({ label, className = "" }: { label?: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 text-sm text-text-secondary ${className}`} role="status">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      {label ?? <span className="sr-only">Loading</span>}
      {label && <span className="sr-only">…</span>}
    </span>
  );
}

export function EmptyState({ icon: Icon, title, children, action }: { icon?: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {Icon && (
        <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-surface text-text-muted">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
      )}
      <p className="text-sm font-semibold text-text-primary">{title}</p>
      {children && <p className="mt-1 max-w-sm text-sm text-text-secondary">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatTile({ label, value, hint, tone = "neutral" }: { label: string; value: ReactNode; hint?: string; tone?: "neutral" | "success" | "danger" | "warning" | "primary" }) {
  const color = { neutral: "text-text-primary", success: "text-success", danger: "text-danger", warning: "text-warning", primary: "text-primary" }[tone];
  return (
    <div className="rounded-xl border border-border bg-surface-card p-4 shadow-card">
      <p className="text-xs font-medium text-text-secondary">{label}</p>
      <p className={`num mt-1 text-2xl font-semibold tracking-tight ${color}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-text-muted">{hint}</p>}
    </div>
  );
}
