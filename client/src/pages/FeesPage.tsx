import { useEffect, useState } from "react";
import { api } from "../services/api";
import { useAuthStore } from "../store/authStore";
import { extractErrorMessage } from "../utils/errorMessage";

interface FeeRow {
  id: string;
  studentId: string;
  studentName: string;
  universityId: string;
  feeType: string;
  amountDue: number;
  amountPaid: number;
  amountPending: number;
  dueDate: string;
  status: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE";
  payments: { id: string; amountPaid: number; method: string; receiptNumber: string; paidAt: string }[];
}

const STATUS_STYLE: Record<string, string> = {
  PAID: "bg-success-soft text-success",
  PARTIAL: "bg-warning-soft text-warning",
  PENDING: "bg-info-soft text-info",
  OVERDUE: "bg-danger-soft text-danger",
};

export function FeesPage() {
  const role = useAuthStore((s) => s.user?.role);
  return role === "STUDENT" ? <StudentFeesView /> : <AccountantFeesView />;
}

function FeesTable({ fees, onPay }: { fees: FeeRow[]; onPay?: (fee: FeeRow) => void }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="bg-surface dark:bg-surface-dark text-left text-text-secondary">
          <tr>
            {onPay && <th className="px-4 py-3 font-medium">Student</th>}
            <th className="px-4 py-3 font-medium">Fee type</th>
            <th className="px-4 py-3 font-medium">Due amount</th>
            <th className="px-4 py-3 font-medium">Paid</th>
            <th className="px-4 py-3 font-medium">Pending</th>
            <th className="px-4 py-3 font-medium">Due date</th>
            <th className="px-4 py-3 font-medium">Status</th>
            {onPay && <th className="px-4 py-3 font-medium text-right">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-border dark:divide-border-dark">
          {fees.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-6 text-center text-text-secondary">No fee records yet.</td>
            </tr>
          )}
          {fees.map((f) => (
            <tr key={f.id}>
              {onPay && (
                <td className="px-4 py-3 text-text-primary dark:text-text-dark-primary whitespace-nowrap">
                  {f.studentName}
                  <div className="text-xs text-text-secondary">{f.universityId}</div>
                </td>
              )}
              <td className="px-4 py-3 text-text-secondary whitespace-nowrap">{f.feeType}</td>
              <td className="px-4 py-3 text-text-secondary">₹{f.amountDue.toLocaleString()}</td>
              <td className="px-4 py-3 text-text-secondary">₹{f.amountPaid.toLocaleString()}</td>
              <td className="px-4 py-3 text-text-secondary">₹{f.amountPending.toLocaleString()}</td>
              <td className="px-4 py-3 text-text-secondary whitespace-nowrap">{new Date(f.dueDate).toLocaleDateString()}</td>
              <td className="px-4 py-3">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[f.status]}`}>
                  {f.status}
                </span>
              </td>
              {onPay && (
                <td className="px-4 py-3 text-right">
                  {f.status !== "PAID" && (
                    <button onClick={() => onPay(f)} className="text-primary text-xs font-medium">
                      Record payment
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AccountantFeesView() {
  const [fees, setFees] = useState<FeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [payFee, setPayFee] = useState<FeeRow | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/fees");
      setFees(data.fees);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary dark:text-text-dark-primary">Fees</h1>
          <p className="text-sm text-text-secondary mt-1">Create fee records and record payments.</p>
        </div>
        <button onClick={() => setCreateOpen(true)} className="btn-primary self-start sm:self-auto">
          Create fee record
        </button>
      </div>

      {loading ? <p className="text-text-secondary text-sm">Loading...</p> : <FeesTable fees={fees} onPay={setPayFee} />}

      {createOpen && <CreateFeeModal onClose={() => setCreateOpen(false)} onCreated={() => { setCreateOpen(false); load(); }} />}
      {payFee && <RecordPaymentModal fee={payFee} onClose={() => setPayFee(null)} onSaved={() => { setPayFee(null); load(); }} />}
    </div>
  );
}

function CreateFeeModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<{ id: string; fullName: string; rollNumber: string; universityId: string }[]>([]);
  const [studentId, setStudentId] = useState("");
  const [studentLabel, setStudentLabel] = useState("");
  const [feeType, setFeeType] = useState("TUITION");
  const [amountDue, setAmountDue] = useState(0);
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (search.length < 2) return setResults([]);
    const t = setTimeout(() => {
      api.get("/students", { params: { search, pageSize: 8 } }).then(({ data }) => setResults(data.data));
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId) return setError("Select a student first");
    setError(null);
    setSaving(true);
    try {
      await api.post("/fees", {
        studentId,
        feeType,
        amountDue,
        dueDate: new Date(dueDate).toISOString(),
      });
      onCreated();
    } catch (err: any) {
      setError(extractErrorMessage(err, "Could not create fee record"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="fixed inset-0 -z-10" onClick={onClose} />
      <div className="w-full max-w-sm card p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-text-primary dark:text-text-dark-primary mb-4">Create fee record</h3>

        {error && <div className="mb-4 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">{error}</div>}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Student</label>
            {studentId ? (
              <div className="flex items-center justify-between input-field">
                <span>{studentLabel}</span>
                <button type="button" onClick={() => { setStudentId(""); setStudentLabel(""); }} className="text-xs text-danger">
                  Change
                </button>
              </div>
            ) : (
              <>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or roll number"
                  className="input-field"
                />
                {results.length > 0 && (
                  <div className="mt-1 border border-border dark:border-border-dark rounded-lg overflow-hidden">
                    {results.map((r) => (
                      <button
                        type="button"
                        key={r.id}
                        onClick={() => {
                          setStudentId(r.id);
                          setStudentLabel(`${r.fullName} (${r.rollNumber})`);
                          setResults([]);
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-surface dark:hover:bg-surface-dark"
                      >
                        {r.fullName} <span className="text-text-secondary text-xs">{r.rollNumber}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Fee type</label>
            <select value={feeType} onChange={(e) => setFeeType(e.target.value)} className="input-field">
              <option value="TUITION">Tuition</option>
              <option value="EXAMINATION">Examination</option>
              <option value="HOSTEL">Hostel</option>
              <option value="TRANSPORT">Transport</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Amount due</label>
            <input type="number" min={1} value={amountDue} onChange={(e) => setAmountDue(Number(e.target.value))} className="input-field" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Due date</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input-field" required />
          </div>

          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? "Creating..." : "Create"}
          </button>
        </form>
      </div>
    </div>
  );
}

function RecordPaymentModal({ fee, onClose, onSaved }: { fee: FeeRow; onClose: () => void; onSaved: () => void }) {
  const [amountPaid, setAmountPaid] = useState(fee.amountPending);
  const [method, setMethod] = useState("CASH");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.post(`/fees/${fee.id}/payments`, { amountPaid, method });
      onSaved();
    } catch (err: any) {
      setError(extractErrorMessage(err, "Could not record payment"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="fixed inset-0 -z-10" onClick={onClose} />
      <div className="w-full max-w-sm card p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-text-primary dark:text-text-dark-primary mb-1">Record payment</h3>
        <p className="text-sm text-text-secondary mb-4">{fee.studentName} · Pending ₹{fee.amountPending.toLocaleString()}</p>

        {error && <div className="mb-4 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">{error}</div>}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Amount paid</label>
            <input type="number" min={1} max={fee.amountPending} value={amountPaid} onChange={(e) => setAmountPaid(Number(e.target.value))} className="input-field" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Method</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="input-field">
              <option value="CASH">Cash</option>
              <option value="CARD">Card</option>
              <option value="UPI">UPI</option>
              <option value="BANK_TRANSFER">Bank transfer</option>
            </select>
          </div>
          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? "Saving..." : "Record payment"}
          </button>
        </form>
      </div>
    </div>
  );
}

function StudentFeesView() {
  const [fees, setFees] = useState<FeeRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/students/me").then(({ data }) =>
      api.get("/fees", { params: { studentId: data.student.id } }).then(({ data: f }) => {
        setFees(f.fees);
        setLoading(false);
      })
    );
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary dark:text-text-dark-primary">My Fees</h1>
        <p className="text-sm text-text-secondary mt-1">Tuition, examination, hostel, and other dues.</p>
      </div>
      {loading ? <p className="text-text-secondary text-sm">Loading...</p> : <FeesTable fees={fees} />}
    </div>
  );
}
