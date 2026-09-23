import { useEffect, useState } from "react";
import { api } from "../services/api";

interface AuditLogRow {
  id: string;
  user: string;
  action: string;
  module: string;
  ipAddress: string | null;
  createdAt: string;
}

const MODULES = [
  "auth", "users", "departments", "students", "faculty", "academics", "attendance",
  "examination", "fees", "timetable", "library", "placement", "notices", "leave", "grievance",
];

export function AdministrationPage() {
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [moduleFilter, setModuleFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/administration/audit-logs", { params: { module: moduleFilter || undefined, pageSize: 50 } });
      setLogs(data.logs);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [moduleFilter]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary dark:text-text-dark-primary">Administration</h1>
        <p className="text-sm text-text-secondary mt-1">System-wide audit log of key actions.</p>
      </div>

      <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} className="input-field sm:w-56 mb-4">
        <option value="">All modules</option>
        {MODULES.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="bg-surface dark:bg-surface-dark text-left text-text-secondary">
            <tr>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Module</th>
              <th className="px-4 py-3 font-medium">IP</th>
              <th className="px-4 py-3 font-medium">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border dark:divide-border-dark">
            {loading && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-text-secondary">Loading...</td></tr>
            )}
            {!loading && logs.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-text-secondary">No audit entries yet.</td></tr>
            )}
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-3 text-text-primary dark:text-text-dark-primary whitespace-nowrap">{l.user}</td>
                <td className="px-4 py-3 text-text-secondary whitespace-nowrap">{l.action}</td>
                <td className="px-4 py-3 text-text-secondary">{l.module}</td>
                <td className="px-4 py-3 text-text-secondary font-mono text-xs">{l.ipAddress ?? "—"}</td>
                <td className="px-4 py-3 text-text-secondary whitespace-nowrap">{new Date(l.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
