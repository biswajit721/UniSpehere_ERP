import { useEffect, useRef, useState } from "react";
import { api } from "../services/api";
import { useAuthStore } from "../store/authStore";
import { extractErrorMessage } from "../utils/errorMessage";

interface DocRow {
  id: string;
  title: string;
  category: string;
  fileUrl: string;
  status: "PENDING" | "VERIFIED" | "REJECTED";
  reviewNote: string | null;
  uploadedAt: string;
  ownerName?: string;
  ownerUniversityId?: string;
}

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-warning-soft text-warning",
  VERIFIED: "bg-success-soft text-success",
  REJECTED: "bg-danger-soft text-danger",
};

export function DocumentsPage() {
  const isAdmin = useAuthStore((s) => s.user?.role === "UNIV_ADMIN" || s.user?.role === "SUPER_ADMIN");
  const [myDocs, setMyDocs] = useState<DocRow[]>([]);
  const [allDocs, setAllDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("OTHER");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/documents/me");
      setMyDocs(data.documents);
      if (isAdmin) {
        const { data: all } = await api.get("/documents");
        setAllDocs(all.documents);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const upload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file || !title) {
      setError("Add a title and choose a file");
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title);
      formData.append("category", category);
      await api.post("/documents", formData, { headers: { "Content-Type": "multipart/form-data" } });
      setTitle("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      load();
    } catch (err: any) {
      setError(extractErrorMessage(err, "Upload failed"));
    } finally {
      setUploading(false);
    }
  };

  const review = async (id: string, status: "VERIFIED" | "REJECTED") => {
    await api.patch(`/documents/${id}/review`, { status });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this document?")) return;
    await api.delete(`/documents/${id}`);
    load();
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary dark:text-text-dark-primary">Document Vault</h1>
        <p className="text-sm text-text-secondary mt-1">Upload and manage your certificates, marksheets, and ID proofs.</p>
      </div>

      <div className="card p-4 mb-6">
        {error && <div className="mb-3 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">{error}</div>}
        <div className="flex flex-col sm:flex-row gap-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Document title" className="input-field flex-1" />
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-field sm:w-44">
            <option value="CERTIFICATE">Certificate</option>
            <option value="MARKSHEET">Marksheet</option>
            <option value="ID_PROOF">ID Proof</option>
            <option value="RESUME">Resume</option>
            <option value="OTHER">Other</option>
          </select>
          <input ref={fileInputRef} type="file" className="input-field sm:w-56" />
          <button onClick={upload} disabled={uploading} className="btn-primary sm:w-auto">{uploading ? "Uploading..." : "Upload"}</button>
        </div>
      </div>

      <h2 className="text-lg font-semibold text-text-primary dark:text-text-dark-primary mb-3">My documents</h2>
      <div className="card overflow-x-auto mb-8">
        <table className="w-full min-w-[600px] text-sm">
          <thead className="bg-surface dark:bg-surface-dark text-left text-text-secondary">
            <tr>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Uploaded</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border dark:divide-border-dark">
            {loading && <tr><td colSpan={5} className="px-4 py-6 text-center text-text-secondary">Loading...</td></tr>}
            {!loading && myDocs.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-text-secondary">No documents yet.</td></tr>
            )}
            {myDocs.map((d) => (
              <tr key={d.id}>
                <td className="px-4 py-3 text-text-primary dark:text-text-dark-primary whitespace-nowrap">
                  <a href={d.fileUrl} target="_blank" rel="noreferrer" className="hover:underline">{d.title}</a>
                </td>
                <td className="px-4 py-3 text-text-secondary">{d.category}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[d.status]}`}>{d.status}</span>
                </td>
                <td className="px-4 py-3 text-text-secondary whitespace-nowrap">{new Date(d.uploadedAt).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => remove(d.id)} className="text-danger text-xs font-medium">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isAdmin && (
        <>
          <h2 className="text-lg font-semibold text-text-primary dark:text-text-dark-primary mb-3">All documents (review)</h2>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead className="bg-surface dark:bg-surface-dark text-left text-text-secondary">
                <tr>
                  <th className="px-4 py-3 font-medium">Owner</th>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border dark:divide-border-dark">
                {allDocs.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-text-secondary">No documents uploaded yet.</td></tr>
                )}
                {allDocs.map((d) => (
                  <tr key={d.id}>
                    <td className="px-4 py-3 text-text-primary dark:text-text-dark-primary whitespace-nowrap">{d.ownerName} <span className="text-xs text-text-secondary">{d.ownerUniversityId}</span></td>
                    <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
                      <a href={d.fileUrl} target="_blank" rel="noreferrer" className="hover:underline">{d.title}</a>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{d.category}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[d.status]}`}>{d.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {d.status === "PENDING" && (
                        <>
                          <button onClick={() => review(d.id, "VERIFIED")} className="text-success text-xs font-medium mr-3">Verify</button>
                          <button onClick={() => review(d.id, "REJECTED")} className="text-danger text-xs font-medium">Reject</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
