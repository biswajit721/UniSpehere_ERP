import { RotateCw } from "lucide-react";
import { useId } from "react";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /** shown as the first entry when nothing is chosen, e.g. "Select semester" */
  placeholder?: string;
  /** the parent choice this field depends on, e.g. "academic session". Disables the field until it is set. */
  waitingFor?: string | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  /** text when a successful load returned nothing */
  emptyText?: string;
  required?: boolean;
  disabled?: boolean;
  hint?: string;
}

/**
 * A dropdown that always tells the person what state it is in, instead of a permanent "Loading...":
 *   waiting for a parent  -> "Select academic session first"   (disabled)
 *   loading               -> "Loading…"                        (disabled)
 *   failed                -> "Error loading data" + Retry
 *   loaded but empty      -> "No data found"                   (disabled)
 *   ready                 -> "Select ..."                      (enabled)
 */
export function SelectField({
  label, value, onChange, options, placeholder, waitingFor, loading, error, onRetry, emptyText = "No data found", required, disabled, hint,
}: SelectFieldProps) {
  const id = useId();
  const waiting = Boolean(waitingFor);
  const empty = !waiting && !loading && !error && options.length === 0;
  const isDisabled = Boolean(disabled) || waiting || Boolean(loading) || Boolean(error) || empty;

  let first = placeholder ?? `Select ${label.toLowerCase()}`;
  if (waiting) first = `Select ${waitingFor} first`;
  else if (loading) first = "Loading…";
  else if (error) first = "Error loading data";
  else if (empty) first = emptyText;

  return (
    <div className="min-w-0">
      <label htmlFor={id} className="field-label">
        {label}
        {required && <span className="ml-0.5 text-danger" aria-hidden="true">*</span>}
      </label>
      <select
        id={id}
        className="input-field"
        value={isDisabled && !options.some((o) => o.value === value) ? "" : value}
        onChange={(e) => onChange(e.target.value)}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        aria-invalid={error ? true : undefined}
        required={required}
      >
        <option value="">{first}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>
        ))}
      </select>
      {error && (
        <p className="mt-1 flex items-center gap-2 text-xs text-danger" role="alert">
          <span className="min-w-0 truncate">{error}</span>
          {onRetry && (
            <button type="button" onClick={onRetry} className="inline-flex shrink-0 items-center gap-1 font-medium underline underline-offset-2">
              <RotateCw className="h-3 w-3" /> Retry
            </button>
          )}
        </p>
      )}
      {!error && hint && <p className="mt-1 text-xs text-text-muted">{hint}</p>}
    </div>
  );
}
