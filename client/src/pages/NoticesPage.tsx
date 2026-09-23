import { useEffect, useState } from "react";
import { api } from "../services/api";
import { useAuthStore } from "../store/authStore";
import { extractErrorMessage } from "../utils/errorMessage";

interface Notice {
  id: string;
  title: string;
  content: string;
  category: string;
  priority: "LOW" | "NORMAL" | "HIGH";
  postedBy: string;
  createdAt: string;
  expiresAt: string | null;
}

const PRIORITY_STYLE: Record<string, string> = {
  HIGH: "bg-danger-soft text-danger",
  NORMAL: "bg-info-soft text-info",
  LOW: "bg-surface dark:bg-surface-dark text-text-secondary",
};

export function NoticesPage() {
  const canPost = useAuthStore((s) => ["SUPER_ADMIN", "UNIV_ADMIN", "HOD", "PRINCIPAL"].includes(s.user?.role ?? ""));
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/notices");
      setNotices(data.notices);
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
          <h1 className="text-2xl font-semibold text-text-primary dark:text-text-dark-primary">Notices</h1>
          <p className="text-sm text-text-secondary mt-1">Announcements relevant to you.</p>
        </div>
        {canPost && (
          <button onClick={() => setCreateOpen(true)} className="btn-primary self-start sm:self-auto">
            Post notice
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-text-secondary text-sm">Loading...</p>
      ) : notices.length === 0 ? (
        <div className="card p-6 text-center text-sm text-text-secondary">No notices right now.</div>
      ) : (
        <div className="space-y-3">
          {notices.map((n) => (
            <div key={n.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold text-text-primary dark:text-text-dark-primary">{n.title}</h3>
                <span className={`shrink-0 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLE[n.priority]}`}>
                  {n.priority}
                </span>
              </div>
              <p className="text-sm text-text-secondary mt-1.5 whitespace-pre-wrap">{n.content}</p>
              <p className="text-xs text-text-secondary mt-3">
                {n.category} · {n.postedBy} · {new Date(n.createdAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}

      {createOpen && <CreateNoticeModal onClose={() => setCreateOpen(false)} onCreated={() => { setCreateOpen(false); load(); }} />}
    </div>
  );
}

function CreateNoticeModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("GENERAL");
  const [priority, setPriority] = useState("NORMAL");
  const [targetRole, setTargetRole] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.post("/notices", { title, content, category, priority, targetRole: targetRole || undefined });
      onCreated();
    } catch (err: any) {
      setError(extractErrorMessage(err, "Could not post notice"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="fixed inset-0 -z-10" onClick={onClose} />
      <div className="w-full max-w-md card p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-text-primary dark:text-text-dark-primary mb-4">Post notice</h3>
        {error && <div className="mb-4 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">{error}</div>}
        <form onSubmit={submit} className="space-y-4">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="input-field" required />
          <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Content" className="input-field" rows={4} required />
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-field">
            <option value="GENERAL">General</option>
            <option value="ACADEMIC">Academic</option>
            <option value="EXAMINATION">Examination</option>
            <option value="PLACEMENT">Placement</option>
            <option value="EMERGENCY">Emergency</option>
            <option value="DEPARTMENT">Department</option>
          </select>
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className="input-field">
            <option value="LOW">Low priority</option>
            <option value="NORMAL">Normal priority</option>
            <option value="HIGH">High priority</option>
          </select>
          <select value={targetRole} onChange={(e) => setTargetRole(e.target.value)} className="input-field">
            <option value="">Everyone</option>
            <option value="STUDENT">Students only</option>
            <option value="FACULTY">Faculty only</option>
            <option value="HOD">HODs only</option>
          </select>
          <button type="submit" disabled={saving} className="btn-primary w-full">{saving ? "Posting..." : "Post notice"}</button>
        </form>
      </div>
    </div>
  );
}
