import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { FacultyRow } from "../features/faculty/faculty.types";
import { api } from "../services/api";

export function FacultyPage() {
  const [faculty, setFaculty] = useState<FacultyRow[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<FacultyRow | null>(null);
  const [designation, setDesignation] = useState("");
  const [qualification, setQualification] = useState("");
  const [experienceYrs, setExperienceYrs] = useState(0);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/faculty", {
        params: { search: search || undefined, departmentId: departmentId || undefined, pageSize: 50 },
      });
      setFaculty(data.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    api.get("/departments").then(({ data }) => setDepartments(data.departments));
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [search, departmentId]);

  const toggleActive = async (f: FacultyRow) => {
    await api.patch(`/faculty/${f.id}/${f.isActive ? "suspend" : "activate"}`);
    load();
  };

  const openEdit = (f: FacultyRow) => {
    setEditing(f);
    setDesignation(f.designation);
    setQualification(f.qualification ?? "");
    setExperienceYrs(f.experienceYrs ?? 0);
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await api.put(`/faculty/${editing.id}`, { designation, qualification, experienceYrs });
      setEditing(null);
      load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary dark:text-text-dark-primary">Faculty</h1>
        <p className="text-sm text-text-secondary mt-1">
          Browse faculty members, update designation and qualifications, manage account status.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, employee ID, or email"
            className="input-field pl-9"
          />
        </div>
        <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="input-field sm:w-56">
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-surface dark:bg-surface-dark text-left text-text-secondary">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Employee ID</th>
              <th className="px-4 py-3 font-medium">Department</th>
              <th className="px-4 py-3 font-medium">Designation</th>
              <th className="px-4 py-3 font-medium">Experience</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border dark:divide-border-dark">
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-text-secondary">
                  Loading...
                </td>
              </tr>
            )}
            {!loading && faculty.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-text-secondary">
                  No faculty found. Create one from the Users page.
                </td>
              </tr>
            )}
            {faculty.map((f) => (
              <tr key={f.id}>
                <td className="px-4 py-3 text-text-primary dark:text-text-dark-primary whitespace-nowrap">
                  {f.fullName}
                  <div className="text-xs text-text-secondary">{f.universityId}</div>
                </td>
                <td className="px-4 py-3 font-mono text-text-secondary whitespace-nowrap">{f.employeeId}</td>
                <td className="px-4 py-3 text-text-secondary whitespace-nowrap">{f.department}</td>
                <td className="px-4 py-3 text-text-secondary whitespace-nowrap">{f.designation}</td>
                <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
                  {f.experienceYrs !== null ? `${f.experienceYrs} yrs` : "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${
                      f.isActive ? "bg-success-soft text-success" : "bg-danger-soft text-danger"
                    }`}
                  >
                    {f.isActive ? "Active" : "Suspended"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button onClick={() => openEdit(f)} className="text-primary text-xs font-medium mr-3">
                    Edit
                  </button>
                  <button
                    onClick={() => toggleActive(f)}
                    className={`text-xs font-medium ${f.isActive ? "text-danger" : "text-success"}`}
                  >
                    {f.isActive ? "Suspend" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="fixed inset-0 -z-10" onClick={() => setEditing(null)} />
          <div className="w-full max-w-sm card p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-text-primary dark:text-text-dark-primary mb-1">
              Edit {editing.fullName}
            </h3>
            <p className="text-sm text-text-secondary mb-4">{editing.employeeId} · {editing.department}</p>

            <label className="block text-sm font-medium text-text-primary mb-1.5">Designation</label>
            <input
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              className="input-field mb-3"
            />
            <label className="block text-sm font-medium text-text-primary mb-1.5">Qualification</label>
            <input
              value={qualification}
              onChange={(e) => setQualification(e.target.value)}
              className="input-field mb-3"
            />
            <label className="block text-sm font-medium text-text-primary mb-1.5">Experience (years)</label>
            <input
              type="number"
              min={0}
              max={60}
              value={experienceYrs}
              onChange={(e) => setExperienceYrs(Number(e.target.value))}
              className="input-field mb-4"
            />
            <button onClick={saveEdit} disabled={saving} className="btn-primary w-full">
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
