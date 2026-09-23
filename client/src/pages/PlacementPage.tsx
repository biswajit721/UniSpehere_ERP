import { useEffect, useState } from "react";
import { api } from "../services/api";
import { useAuthStore } from "../store/authStore";
import { extractErrorMessage } from "../utils/errorMessage";

interface Drive {
  id: string;
  company: string;
  jobRole: string;
  description: string | null;
  eligibleDepartment: string | null;
  minCgpa: number | null;
  salaryPackage: string | null;
  driveDate: string;
  status: "OPEN" | "CLOSED";
  applicantCount: number;
}

export function PlacementPage() {
  const role = useAuthStore((s) => s.user?.role);
  return role === "PLACEMENT_OFFICER" || role === "SUPER_ADMIN" ? <OfficerView /> : <StudentView />;
}

function OfficerView() {
  const [drives, setDrives] = useState<Drive[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [companyModalOpen, setCompanyModalOpen] = useState(false);
  const [applicantsFor, setApplicantsFor] = useState<Drive | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/placement/drives");
      setDrives(data.drives);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    api.get("/placement/companies").then(({ data }) => setCompanies(data.companies));
    api.get("/departments").then(({ data }) => setDepartments(data.departments));
  }, []);

  const toggleStatus = async (d: Drive) => {
    await api.patch(`/placement/drives/${d.id}/status`, { status: d.status === "OPEN" ? "CLOSED" : "OPEN" });
    load();
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary dark:text-text-dark-primary">Placement</h1>
          <p className="text-sm text-text-secondary mt-1">Manage companies, drives, and applicant pipelines.</p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <button onClick={() => setCompanyModalOpen(true)} className="rounded-lg border border-border dark:border-border-dark px-4 py-2.5 text-sm font-medium text-text-primary dark:text-text-dark-primary">
            Add company
          </button>
          <button onClick={() => setCreateOpen(true)} className="btn-primary">Create drive</button>
        </div>
      </div>

      {loading ? (
        <p className="text-text-secondary text-sm">Loading...</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="bg-surface dark:bg-surface-dark text-left text-text-secondary">
              <tr>
                <th className="px-4 py-3 font-medium">Company</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Package</th>
                <th className="px-4 py-3 font-medium">Min CGPA</th>
                <th className="px-4 py-3 font-medium">Applicants</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border dark:divide-border-dark">
              {drives.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-text-secondary">No drives yet.</td></tr>
              )}
              {drives.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-3 text-text-primary dark:text-text-dark-primary whitespace-nowrap">{d.company}</td>
                  <td className="px-4 py-3 text-text-secondary whitespace-nowrap">{d.jobRole}</td>
                  <td className="px-4 py-3 text-text-secondary whitespace-nowrap">{d.salaryPackage ?? "—"}</td>
                  <td className="px-4 py-3 text-text-secondary">{d.minCgpa ?? "—"}</td>
                  <td className="px-4 py-3 text-text-secondary">
                    <button onClick={() => setApplicantsFor(d)} className="text-primary">{d.applicantCount}</button>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${d.status === "OPEN" ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>
                      {d.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => toggleStatus(d)} className="text-primary text-xs font-medium">
                      {d.status === "OPEN" ? "Close" : "Reopen"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {companyModalOpen && (
        <SimpleCompanyModal onClose={() => setCompanyModalOpen(false)} onCreated={() => { setCompanyModalOpen(false); api.get("/placement/companies").then(({ data }) => setCompanies(data.companies)); }} />
      )}
      {createOpen && (
        <CreateDriveModal companies={companies} departments={departments} onClose={() => setCreateOpen(false)} onCreated={() => { setCreateOpen(false); load(); }} />
      )}
      {applicantsFor && (
        <ApplicantsModal drive={applicantsFor} onClose={() => setApplicantsFor(null)} />
      )}
    </div>
  );
}

function SimpleCompanyModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/placement/companies", { name, website: website || undefined, location: location || undefined });
      onCreated();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="fixed inset-0 -z-10" onClick={onClose} />
      <div className="w-full max-w-sm card p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-text-primary dark:text-text-dark-primary mb-4">Add company</h3>
        <form onSubmit={submit} className="space-y-4">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Company name" className="input-field" required />
          <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="Website (optional)" className="input-field" />
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location (optional)" className="input-field" />
          <button type="submit" disabled={saving} className="btn-primary w-full">{saving ? "Adding..." : "Add"}</button>
        </form>
      </div>
    </div>
  );
}

function CreateDriveModal({
  companies, departments, onClose, onCreated,
}: { companies: { id: string; name: string }[]; departments: { id: string; name: string }[]; onClose: () => void; onCreated: () => void }) {
  const [companyId, setCompanyId] = useState("");
  const [jobRole, setJobRole] = useState("");
  const [description, setDescription] = useState("");
  const [eligibleDepartmentId, setEligibleDepartmentId] = useState("");
  const [minCgpa, setMinCgpa] = useState("");
  const [salaryPackage, setSalaryPackage] = useState("");
  const [driveDate, setDriveDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.post("/placement/drives", {
        companyId,
        jobRole,
        description: description || undefined,
        eligibleDepartmentId: eligibleDepartmentId || undefined,
        minCgpa: minCgpa ? Number(minCgpa) : undefined,
        salaryPackage: salaryPackage || undefined,
        driveDate: new Date(driveDate).toISOString(),
      });
      onCreated();
    } catch (err: any) {
      setError(extractErrorMessage(err, "Could not create drive"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="fixed inset-0 -z-10" onClick={onClose} />
      <div className="w-full max-w-sm max-h-[85vh] overflow-y-auto card p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-text-primary dark:text-text-dark-primary mb-4">Create placement drive</h3>
        {error && <div className="mb-4 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">{error}</div>}
        <form onSubmit={submit} className="space-y-4">
          <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="input-field" required>
            <option value="">Select company</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input value={jobRole} onChange={(e) => setJobRole(e.target.value)} placeholder="Job role" className="input-field" required />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" className="input-field" rows={3} />
          <select value={eligibleDepartmentId} onChange={(e) => setEligibleDepartmentId(e.target.value)} className="input-field">
            <option value="">Open to all departments</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <input value={minCgpa} onChange={(e) => setMinCgpa(e.target.value)} type="number" step="0.1" placeholder="Min CGPA (optional)" className="input-field" />
          <input value={salaryPackage} onChange={(e) => setSalaryPackage(e.target.value)} placeholder="Package, e.g. ₹6 LPA" className="input-field" />
          <input value={driveDate} onChange={(e) => setDriveDate(e.target.value)} type="date" className="input-field" required />
          <button type="submit" disabled={saving} className="btn-primary w-full">{saving ? "Creating..." : "Create drive"}</button>
        </form>
      </div>
    </div>
  );
}

function ApplicantsModal({ drive, onClose }: { drive: Drive; onClose: () => void }) {
  const [applicants, setApplicants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await api.get(`/placement/drives/${drive.id}/applications`);
    setApplicants(data.applications);
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);

  const updateStatus = async (id: string, status: string) => {
    await api.patch(`/placement/applications/${id}/status`, { status });
    load();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="fixed inset-0 -z-10" onClick={onClose} />
      <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto card p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-text-primary dark:text-text-dark-primary mb-4">
          Applicants — {drive.company} ({drive.jobRole})
        </h3>
        {loading ? (
          <p className="text-text-secondary text-sm">Loading...</p>
        ) : applicants.length === 0 ? (
          <p className="text-text-secondary text-sm">No applicants yet.</p>
        ) : (
          <div className="space-y-2">
            {applicants.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg border border-border dark:border-border-dark p-3">
                <div className="text-sm">
                  <p className="text-text-primary dark:text-text-dark-primary">{a.studentName}</p>
                  <p className="text-xs text-text-secondary">{a.rollNumber}</p>
                </div>
                <select value={a.status} onChange={(e) => updateStatus(a.id, e.target.value)} className="input-field w-36 text-xs">
                  <option value="APPLIED">Applied</option>
                  <option value="SHORTLISTED">Shortlisted</option>
                  <option value="SELECTED">Selected</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StudentView() {
  const [drives, setDrives] = useState<Drive[]>([]);
  const [myApplications, setMyApplications] = useState<any[]>([]);
  const [studentId, setStudentId] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data: sd } = await api.get("/students/me");
    setStudentId(sd.student.id);
    const [{ data: drivesData }, { data: appsData }] = await Promise.all([
      api.get("/placement/drives"),
      api.get(`/placement/applications/student/${sd.student.id}`),
    ]);
    setDrives(drivesData.drives.filter((d: Drive) => d.status === "OPEN"));
    setMyApplications(appsData.applications);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const apply = async (driveId: string) => {
    try {
      await api.post(`/placement/drives/${driveId}/apply`, { studentId });
      load();
    } catch (err: any) {
      alert(extractErrorMessage(err, "Could not apply"));
    }
  };

  const appliedDriveIds = new Set(myApplications.map((a) => a.company + a.jobRole));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary dark:text-text-dark-primary">Placement</h1>
        <p className="text-sm text-text-secondary mt-1">Open drives you're eligible to apply for.</p>
      </div>

      {loading ? (
        <p className="text-text-secondary text-sm">Loading...</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {drives.length === 0 && <p className="text-text-secondary text-sm col-span-full">No open drives right now.</p>}
          {drives.map((d) => {
            const alreadyApplied = appliedDriveIds.has(d.company + d.jobRole);
            return (
              <div key={d.id} className="card p-4">
                <h3 className="font-semibold text-text-primary dark:text-text-dark-primary">{d.company}</h3>
                <p className="text-sm text-text-secondary">{d.jobRole}</p>
                <p className="text-xs text-text-secondary mt-2">{d.salaryPackage ?? "Package not disclosed"}</p>
                {d.minCgpa && <p className="text-xs text-text-secondary">Min CGPA: {d.minCgpa}</p>}
                {d.eligibleDepartment && <p className="text-xs text-text-secondary">{d.eligibleDepartment} only</p>}
                <button
                  onClick={() => apply(d.id)}
                  disabled={alreadyApplied}
                  className="btn-primary w-full mt-3 disabled:opacity-50"
                >
                  {alreadyApplied ? "Applied" : "Apply"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <h2 className="text-lg font-semibold text-text-primary dark:text-text-dark-primary mb-3">My applications</h2>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-surface dark:bg-surface-dark text-left text-text-secondary">
            <tr>
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border dark:divide-border-dark">
            {myApplications.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-text-secondary">No applications yet.</td></tr>
            )}
            {myApplications.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-3 text-text-primary dark:text-text-dark-primary whitespace-nowrap">{a.company}</td>
                <td className="px-4 py-3 text-text-secondary whitespace-nowrap">{a.jobRole}</td>
                <td className="px-4 py-3 text-text-secondary">{a.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
