import { X } from "lucide-react";
import { useState } from "react";
import { extractErrorMessage } from "../../utils/errorMessage";

export interface FieldConfig {
  key: string;
  label: string;
  type?: "text" | "number" | "select" | "date";
  placeholder?: string;
  options?: { value: string; label: string }[];
  optional?: boolean;
}

interface Props {
  title: string;
  fields: FieldConfig[];
  initialValues?: Record<string, string | number>;
  onClose: () => void;
  onSubmit: (values: Record<string, string | number>) => Promise<void>;
}

export function EntityFormModal({ title, fields, initialValues, onClose, onSubmit }: Props) {
  const [values, setValues] = useState<Record<string, string | number>>(
    initialValues ?? Object.fromEntries(fields.map((f) => [f.key, ""]))
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(values);
      onClose();
    } catch (err: any) {
      setError(extractErrorMessage(err, "Something went wrong. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="fixed inset-0 -z-10" onClick={onClose} />
      <div className="w-full max-w-sm card p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-text-primary dark:text-text-dark-primary">
            {title}
          </h3>
          <button onClick={onClose}>
            <X className="h-5 w-5 text-text-secondary" />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {fields.map((f) => (
            <div key={f.key}>
              <label className="block text-sm font-medium text-text-primary mb-1.5">{f.label}</label>
              {f.type === "select" ? (
                <select
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  className="input-field"
                  required={!f.optional}
                >
                  {!f.optional && (
                    <option value="" disabled>
                      Select {f.label.toLowerCase()}
                    </option>
                  )}
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={f.type ?? "text"}
                  placeholder={f.placeholder}
                  value={values[f.key] ?? ""}
                  onChange={(e) =>
                    setValues((v) => ({
                      ...v,
                      [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value,
                    }))
                  }
                  className="input-field"
                  required={!f.optional}
                />
              )}
            </div>
          ))}
          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? "Saving..." : "Save"}
          </button>
        </form>
      </div>
    </div>
  );
}
