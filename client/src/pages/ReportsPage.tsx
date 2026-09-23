import { Download } from "lucide-react";
import { useState } from "react";
import { api } from "../services/api";

export function ReportsPage() {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const download = async (path: string, filename: string) => {
    setDownloading(path);
    setError(null);
    try {
      const response = await api.get(path, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError("Could not generate that report. You may not have permission, or there's no data yet.");
    } finally {
      setDownloading(null);
    }
  };

  const reports = [
    { path: "/reports/students.xlsx", filename: "students-report.xlsx", title: "Student Master List", desc: "All students with department, batch, semester, CGPA, and status.", format: "Excel" },
    { path: "/reports/fees.xlsx", filename: "fee-collection-report.xlsx", title: "Fee Collection", desc: "Every fee record with amounts due, paid, pending, and status.", format: "Excel" },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary dark:text-text-dark-primary">Reports</h1>
        <p className="text-sm text-text-secondary mt-1">Download reports generated from live data.</p>
      </div>

      {error && <div className="mb-4 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {reports.map((r) => (
          <div key={r.path} className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-text-primary dark:text-text-dark-primary">{r.title}</h3>
                <p className="text-sm text-text-secondary mt-1">{r.desc}</p>
              </div>
              <span className="shrink-0 rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success">{r.format}</span>
            </div>
            <button
              onClick={() => download(r.path, r.filename)}
              disabled={downloading === r.path}
              className="btn-primary w-full mt-4 flex items-center justify-center gap-2"
            >
              <Download className="h-4 w-4" />
              {downloading === r.path ? "Generating..." : "Download"}
            </button>
          </div>
        ))}
      </div>

      <p className="text-xs text-text-secondary mt-6">
        An attendance PDF report is also available per subject/section via
        <code className="mx-1">/api/reports/attendance.pdf?subjectId=...&amp;sectionId=...</code>
        — a picker for it is coming next.
      </p>
    </div>
  );
}
