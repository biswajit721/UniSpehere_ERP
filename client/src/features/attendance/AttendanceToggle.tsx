import { Check, X } from "lucide-react";

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** accessible name, e.g. "Amit Kumar present" */
  label: string;
  block?: boolean;
}

/**
 * The one control a teacher touches 60 times: a real checkbox (Space toggles it, screen readers announce it)
 * dressed as a large pill. Present and Absent differ by icon AND wording, never colour alone.
 */
export function AttendanceToggle({ checked, onChange, label, block }: Props) {
  return (
    <label className={`relative inline-flex cursor-pointer select-none ${block ? "w-full" : ""}`}>
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
      <span
        className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold transition-all
          peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface-card
          active:scale-[0.97] sm:min-h-9 ${block ? "w-full" : "min-w-[7.75rem]"} ${
          checked
            ? "border-success bg-success text-white shadow-sm"
            : "border-danger/40 bg-danger/[0.06] text-danger hover:border-danger/70 hover:bg-danger-soft"
        }`}
      >
        {checked ? <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" /> : <X className="h-4 w-4" strokeWidth={3} aria-hidden="true" />}
        {checked ? "Present" : "Absent"}
      </span>
    </label>
  );
}
