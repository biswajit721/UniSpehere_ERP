import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useToastStore } from "../../store/toastStore";

const STYLE = {
  success: { icon: CheckCircle2, color: "text-success" },
  error: { icon: XCircle, color: "text-danger" },
  info: { icon: Info, color: "text-info" },
} as const;

/** Transient confirmations. Bottom-centre on phones (clear of the sticky action bar), top-right on desktop. */
export function Toaster() {
  const { toasts, dismiss } = useToastStore();
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-3 bottom-24 z-[70] flex flex-col items-center gap-2 sm:inset-x-auto sm:bottom-auto sm:right-5 sm:top-20 sm:items-end"
    >
      {toasts.map((t) => {
        const { icon: Icon, color } = STYLE[t.tone];
        return (
          <div key={t.id} className="pointer-events-auto flex w-full max-w-sm animate-pop-in items-start gap-3 rounded-xl border border-border bg-surface-raised px-4 py-3 shadow-pop">
            <Icon className={`mt-0.5 h-[18px] w-[18px] shrink-0 ${color}`} aria-hidden="true" />
            <p className="min-w-0 flex-1 text-sm text-text-primary">{t.message}</p>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="-mr-1 rounded p-0.5 text-text-muted hover:text-text-primary">
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
