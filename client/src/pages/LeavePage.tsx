import { useEffect, useState } from "react";
import { api } from "../services/api";
import { useAuthStore } from "../store/authStore";
import { extractErrorMessage } from "../utils/errorMessage";

interface LeaveRow {
  id: string;
  applicantName?: string;
  applicantRole?: string;
  leaveType: string;
  reason: string;
  startDate: string;
  endDate: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  decisionNote: string | null;
  createdAt: string;
}

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-warning-soft text-warning",
  APPROVED: "bg-success-soft text-success",
  REJECTED: "bg-danger-soft text-danger",
};

export function LeavePage() {
  const isApprover = useAuthStore((s) => s.user?.role === "HOD" || s.user?.role === "UNIV_ADMIN" || s.user?.role === "SUPER_ADMIN");
  return isApprover ? <ApproverView /> : <ApplicantView />;
}

function ApplicantView() {
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [leaveType, setLeaveType] = useState("CASUAL");
  const [reason, setReason] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/leave/me");
      setLeaves(data.leaves);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.post("/leave", {
        leaveType,
        reason,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
      });
      setFormOpen(false);
      setReason("");
      setStartDate("");
      setEndDate("");
      load();
    } catch (err: any) {
      setError(extractErrorMessage(err, "Could not submit leave request"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary dark:text-text-dark-primary">Leave</h1>
          <p className="text-sm text-text-secondary mt-1">Apply for leave and track your requests.</p>
        </div>
        <button onClick={() => setFormOpen(true)} className="btn-primary self-start sm:self-auto">Apply for leave</button>
      </div>

      {loading ? (
        <p className="text-text-secondary text-sm">Loading...</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="bg-surface dark:bg-surface-dark text-left text-text-secondary">
              <tr>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Dates</th>
                <th className="px-4 py-3 font-medium">Reason</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border dark:divide-border-dark">
              {leaves.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-text-secondary">No leave requests yet.</td></tr>
              )}
              {leaves.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-3 text-text-primary dark:text-text-dark-primary">{l.leaveType}</td>
                  <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
                    {new Date(l.startDate).toLocaleDateString()} – {new Date(l.endDate).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-text-secondary max-w-[200px] truncate">{l.reason}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[l.status]}`}>{l.status}</span>
                  </td>
                  <td className="px-4 py-3 text-text-secondary max-w-[160px] truncate">{l.decisionNote ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="fixed inset-0 -z-10" onClick={() => setFormOpen(false)} />
          <div className="w-full max-w-sm card p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-text-primary dark:text-text-dark-primary mb-4">Apply for leave</h3>
            {error && <div className="mb-4 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">{error}</div>}
            <form onSubmit={submit} className="space-y-4">
              <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)} className="input-field">
                <option value="CASUAL">Casual</option>
                <option value="SICK">Sick</option>
                <option value="OTHER">Other</option>
              </select>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" className="input-field" rows={3} required />
              <div className="grid grid-cols-2 gap-3">
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input-field" required />
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input-field" required />
              </div>
              <button type="submit" disabled={saving} className="btn-primary w-full">{saving ? "Submitting..." : "Submit"}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ApproverView() {
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [decisionFor, setDecisionFor] = useState<LeaveRow | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(showAll ? "/leave" : "/leave/pending");
      setLeaves(data.leaves);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, [showAll]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary dark:text-text-dark-primary">Leave</h1>
          <p className="text-sm text-text-secondary mt-1">Review and decide on leave requests.</p>
        </div>
        <button onClick={() => setShowAll((s) => !s)} className="rounded-lg border border-border dark:border-border-dark px-4 py-2.5 text-sm font-medium text-text-primary dark:text-text-dark-primary self-start sm:self-auto">
          {showAll ? "Show pending only" : "Show all"}
        </button>
      </div>

      {loading ? (
        <p className="text-text-secondary text-sm">Loading...</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="bg-surface dark:bg-surface-dark text-left text-text-secondary">
              <tr>
                <th className="px-4 py-3 font-medium">Applicant</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Dates</th>
                <th className="px-4 py-3 font-medium">Reason</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border dark:divide-border-dark">
              {leaves.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-text-secondary">Nothing to review.</td></tr>
              )}
              {leaves.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-3 text-text-primary dark:text-text-dark-primary whitespace-nowrap">
                    {l.applicantName}
                    <div className="text-xs text-text-secondary">{l.applicantRole?.replace("_", " ")}</div>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{l.leaveType}</td>
                  <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
                    {new Date(l.startDate).toLocaleDateString()} – {new Date(l.endDate).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-text-secondary max-w-[200px] truncate">{l.reason}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[l.status]}`}>{l.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {l.status === "PENDING" && (
                      <button onClick={() => setDecisionFor(l)} className="text-primary text-xs font-medium">Decide</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {decisionFor && (
        <DecisionModal leave={decisionFor} onClose={() => setDecisionFor(null)} onDecided={() => { setDecisionFor(null); load(); }} />
      )}
    </div>
  );
}

function DecisionModal({ leave, onClose, onDecided }: { leave: LeaveRow; onClose: () => void; onDecided: () => void }) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const decide = async (status: "APPROVED" | "REJECTED") => {
    setSaving(true);
    try {
      await api.patch(`/leave/${leave.id}/decision`, { status, decisionNote: note || undefined });
      onDecided();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="fixed inset-0 -z-10" onClick={onClose} />
      <div className="w-full max-w-sm card p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-text-primary dark:text-text-dark-primary mb-1">{leave.applicantName}'s request</h3>
        <p className="text-sm text-text-secondary mb-4">{leave.reason}</p>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="input-field mb-4" rows={3} />
        <div className="flex gap-2">
          <button onClick={() => decide("REJECTED")} disabled={saving} className="flex-1 rounded-lg border border-danger text-danger py-2.5 text-sm font-medium">Reject</button>
          <button onClick={() => decide("APPROVED")} disabled={saving} className="btn-primary flex-1">Approve</button>
        </div>
      </div>
    </div>
  );
}
