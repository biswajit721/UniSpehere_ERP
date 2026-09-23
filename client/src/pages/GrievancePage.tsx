import { useEffect, useState } from "react";
import { api } from "../services/api";
import { useAuthStore } from "../store/authStore";

interface Complaint {
  id: string;
  raisedByName?: string;
  category: string;
  subject: string;
  description: string;
  priority: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  resolutionNote: string | null;
  createdAt: string;
}

const STATUS_STYLE: Record<string, string> = {
  OPEN: "bg-warning-soft text-warning",
  IN_PROGRESS: "bg-info-soft text-info",
  RESOLVED: "bg-success-soft text-success",
  CLOSED: "bg-surface dark:bg-surface-dark text-text-secondary",
};

export function GrievancePage() {
  const isManager = useAuthStore((s) => s.user?.role === "HOD" || s.user?.role === "UNIV_ADMIN" || s.user?.role === "SUPER_ADMIN");
  return isManager ? <ManagerView /> : <RaiserView />;
}

function RaiserView() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [category, setCategory] = useState("ACADEMIC");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/grievance/me");
      setComplaints(data.complaints);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/grievance", { category, subject, description, priority });
      setFormOpen(false);
      setSubject("");
      setDescription("");
      load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary dark:text-text-dark-primary">Grievance</h1>
          <p className="text-sm text-text-secondary mt-1">Raise a ticket and track its resolution.</p>
        </div>
        <button onClick={() => setFormOpen(true)} className="btn-primary self-start sm:self-auto">Raise ticket</button>
      </div>

      {loading ? (
        <p className="text-text-secondary text-sm">Loading...</p>
      ) : complaints.length === 0 ? (
        <div className="card p-6 text-center text-sm text-text-secondary">No tickets yet.</div>
      ) : (
        <div className="space-y-3">
          {complaints.map((c) => (
            <div key={c.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold text-text-primary dark:text-text-dark-primary">{c.subject}</h3>
                <span className={`shrink-0 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[c.status]}`}>
                  {c.status.replace("_", " ")}
                </span>
              </div>
              <p className="text-sm text-text-secondary mt-1.5">{c.description}</p>
              {c.resolutionNote && (
                <p className="text-sm text-success mt-2 border-t border-border dark:border-border-dark pt-2">
                  Resolution: {c.resolutionNote}
                </p>
              )}
              <p className="text-xs text-text-secondary mt-3">{c.category} · {c.priority} priority · {new Date(c.createdAt).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="fixed inset-0 -z-10" onClick={() => setFormOpen(false)} />
          <div className="w-full max-w-sm card p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-text-primary dark:text-text-dark-primary mb-4">Raise a ticket</h3>
            <form onSubmit={submit} className="space-y-4">
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-field">
                <option value="ACADEMIC">Academic</option>
                <option value="HOSTEL">Hostel</option>
                <option value="TECHNICAL">Technical</option>
                <option value="INFRASTRUCTURE">Infrastructure</option>
                <option value="OTHER">Other</option>
              </select>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="input-field" required />
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the issue" className="input-field" rows={4} required />
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className="input-field">
                <option value="LOW">Low priority</option>
                <option value="MEDIUM">Medium priority</option>
                <option value="HIGH">High priority</option>
              </select>
              <button type="submit" disabled={saving} className="btn-primary w-full">{saving ? "Submitting..." : "Submit ticket"}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ManagerView() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<Complaint | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/grievance");
      setComplaints(data.complaints);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary dark:text-text-dark-primary">Grievance</h1>
        <p className="text-sm text-text-secondary mt-1">Manage and resolve open tickets.</p>
      </div>

      {loading ? (
        <p className="text-text-secondary text-sm">Loading...</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="bg-surface dark:bg-surface-dark text-left text-text-secondary">
              <tr>
                <th className="px-4 py-3 font-medium">Raised by</th>
                <th className="px-4 py-3 font-medium">Subject</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border dark:divide-border-dark">
              {complaints.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-text-secondary">No tickets.</td></tr>
              )}
              {complaints.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 text-text-primary dark:text-text-dark-primary whitespace-nowrap">{c.raisedByName}</td>
                  <td className="px-4 py-3 text-text-secondary max-w-[200px] truncate">{c.subject}</td>
                  <td className="px-4 py-3 text-text-secondary">{c.category}</td>
                  <td className="px-4 py-3 text-text-secondary">{c.priority}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[c.status]}`}>{c.status.replace("_", " ")}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setUpdating(c)} className="text-primary text-xs font-medium">Update</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {updating && (
        <UpdateModal complaint={updating} onClose={() => setUpdating(null)} onUpdated={() => { setUpdating(null); load(); }} />
      )}
    </div>
  );
}

function UpdateModal({ complaint, onClose, onUpdated }: { complaint: Complaint; onClose: () => void; onUpdated: () => void }) {
  const [status, setStatus] = useState(complaint.status);
  const [resolutionNote, setResolutionNote] = useState(complaint.resolutionNote ?? "");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await api.patch(`/grievance/${complaint.id}`, { status, resolutionNote: resolutionNote || undefined });
      onUpdated();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="fixed inset-0 -z-10" onClick={onClose} />
      <div className="w-full max-w-sm card p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-text-primary dark:text-text-dark-primary mb-1">{complaint.subject}</h3>
        <p className="text-sm text-text-secondary mb-4">{complaint.description}</p>
        <label className="block text-sm font-medium text-text-primary mb-1.5">Status</label>
        <select value={status} onChange={(e) => setStatus(e.target.value as Complaint["status"])} className="input-field mb-3">
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
        </select>
        <label className="block text-sm font-medium text-text-primary mb-1.5">Resolution note</label>
        <textarea value={resolutionNote} onChange={(e) => setResolutionNote(e.target.value)} className="input-field mb-4" rows={3} />
        <button onClick={submit} disabled={saving} className="btn-primary w-full">{saving ? "Saving..." : "Save"}</button>
      </div>
    </div>
  );
}
