import { KeyRound, Pencil, Plus, Search, Trash2, UserCheck, UserX } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CreateUserModal } from "../features/users/CreateUserModal";
import { UserRow } from "../features/users/users.types";
import { api } from "../services/api";
import { extractErrorMessage } from "../utils/errorMessage";

interface UserDetail extends UserRow {
  phone?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  address?: string | null;
  bio?: string | null;
  profilePhoto?: string | null;
}

const ROLE_COLOR: Record<string, string> = {
  SUPER_ADMIN: "bg-slate-600/10 text-slate-600 dark:text-slate-300",
  UNIV_ADMIN: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  PRINCIPAL: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  HOD: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  FACULTY: "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400",
  STUDENT: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  EXAM_CONTROLLER: "bg-red-500/10 text-red-600 dark:text-red-400",
  ACCOUNTANT: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  LIBRARIAN: "bg-orange-600/10 text-orange-700 dark:text-orange-400",
  HOSTEL_WARDEN: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  PLACEMENT_OFFICER: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

export function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<UserDetail | null>(null);
  const [resetResult, setResetResult] = useState<{ email: string; tempPassword: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/users", { params: { pageSize: 100 } });
      setUsers(data.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      const matchesRole = !roleFilter || u.role === roleFilter;
      const matchesSearch =
        !q ||
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.universityId.toLowerCase().includes(q);
      return matchesRole && matchesSearch;
    });
  }, [users, search, roleFilter]);

  const act = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      load();
    } catch (err: any) {
      setError(extractErrorMessage(err, "Action failed"));
    }
  };

  const openEdit = async (u: UserRow) => {
    const { data } = await api.get(`/users/${u.id}`);
    setEditing(data.user);
  };

  const toggleActive = (u: UserRow) =>
    act(() => api.patch(`/users/${u.id}/${u.isActive ? "suspend" : "activate"}`));

  const remove = (u: UserRow) => {
    if (!confirm(`Delete ${u.firstName} ${u.lastName}? Their historical records stay intact, but the account is removed.`)) return;
    act(() => api.delete(`/users/${u.id}`));
  };

  const resetPassword = async (u: UserRow) => {
    if (!confirm(`Reset password for ${u.firstName} ${u.lastName}? Their current password stops working immediately.`)) return;
    setError(null);
    try {
      const { data } = await api.post(`/users/${u.id}/reset-password`);
      setResetResult(data);
    } catch (err: any) {
      setError(extractErrorMessage(err, "Could not reset password"));
    }
  };

  const roles = [...new Set(users.map((u) => u.role))].sort();

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary dark:text-text-dark-primary">Users</h1>
          <p className="text-sm text-text-secondary mt-1">Create, edit, suspend, and remove accounts across every role.</p>
        </div>
        <button onClick={() => setCreateOpen(true)} className="btn-primary flex items-center justify-center gap-2 self-stretch sm:self-auto">
          <Plus className="h-4 w-4" />
          Create user
        </button>
      </div>

      {error && <div className="mb-4 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">{error}</div>}

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, or university ID"
            className="input-field pl-9"
          />
        </div>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="input-field sm:w-52">
          <option value="">All roles</option>
          {roles.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
        </select>
      </div>

      {loading && <p className="text-text-secondary text-sm">Loading...</p>}
      {!loading && filtered.length === 0 && (
        <div className="card p-6 text-center text-sm text-text-secondary">No users match those filters.</div>
      )}

      {/* Mobile: stacked cards */}
      <div className="grid gap-3 sm:hidden">
        {filtered.map((u) => (
          <div key={u.id} className="card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-text-primary dark:text-text-dark-primary truncate">{u.firstName} {u.lastName}</p>
                <p className="text-xs text-text-secondary font-mono">{u.universityId}</p>
                <p className="text-xs text-text-secondary truncate">{u.email}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${ROLE_COLOR[u.role] ?? "bg-surface text-text-secondary"}`}>
                {u.role.replace(/_/g, " ")}
              </span>
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border dark:border-border-dark">
              <span className={`text-xs font-medium ${u.isActive ? "text-success" : "text-danger"}`}>
                {u.isActive ? "Active" : "Suspended"}
              </span>
              <div className="flex gap-1">
                <IconBtn onClick={() => openEdit(u)} label="Edit"><Pencil className="h-4 w-4" /></IconBtn>
                <IconBtn onClick={() => resetPassword(u)} label="Reset password"><KeyRound className="h-4 w-4" /></IconBtn>
                <IconBtn onClick={() => toggleActive(u)} label={u.isActive ? "Suspend" : "Activate"}>
                  {u.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                </IconBtn>
                <IconBtn onClick={() => remove(u)} label="Delete" danger><Trash2 className="h-4 w-4" /></IconBtn>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden sm:block card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-surface dark:bg-surface-dark text-left text-text-secondary">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">University ID</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border dark:divide-border-dark">
            {filtered.map((u) => (
              <tr key={u.id} className="hover:bg-surface/60 dark:hover:bg-surface-dark/60">
                <td className="px-4 py-3 text-text-primary dark:text-text-dark-primary whitespace-nowrap">{u.firstName} {u.lastName}</td>
                <td className="px-4 py-3 font-mono text-xs text-text-secondary">{u.universityId}</td>
                <td className="px-4 py-3 text-text-secondary">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${ROLE_COLOR[u.role] ?? "bg-surface text-text-secondary"}`}>
                    {u.role.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${u.isActive ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>
                    {u.isActive ? "Active" : "Suspended"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <IconBtn onClick={() => openEdit(u)} label="Edit"><Pencil className="h-4 w-4" /></IconBtn>
                    <IconBtn onClick={() => resetPassword(u)} label="Reset password"><KeyRound className="h-4 w-4" /></IconBtn>
                    <IconBtn onClick={() => toggleActive(u)} label={u.isActive ? "Suspend" : "Activate"}>
                      {u.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                    </IconBtn>
                    <IconBtn onClick={() => remove(u)} label="Delete" danger><Trash2 className="h-4 w-4" /></IconBtn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {createOpen && (
        <CreateUserModal onClose={() => setCreateOpen(false)} onCreated={() => { setCreateOpen(false); load(); }} />
      )}

      {editing && (
        <EditUserModal user={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      )}

      {resetResult && (
        <Overlay onClose={() => setResetResult(null)}>
          <h3 className="text-lg font-semibold text-text-primary dark:text-text-dark-primary mb-1">Password reset</h3>
          <p className="text-sm text-text-secondary mb-4">Share this securely — it won't be shown again.</p>
          <div className="rounded-lg border border-border dark:border-border-dark px-3 py-2.5 mb-2">
            <p className="text-xs text-text-secondary">Email</p>
            <p className="text-sm font-mono text-text-primary dark:text-text-dark-primary break-all">{resetResult.email}</p>
          </div>
          <div className="rounded-lg border border-border dark:border-border-dark px-3 py-2.5">
            <p className="text-xs text-text-secondary">Temporary password</p>
            <p className="text-sm font-mono text-text-primary dark:text-text-dark-primary">{resetResult.tempPassword}</p>
          </div>
          <button onClick={() => setResetResult(null)} className="btn-primary w-full mt-5">Done</button>
        </Overlay>
      )}
    </div>
  );
}

function IconBtn({ children, onClick, label, danger }: { children: React.ReactNode; onClick: () => void; label: string; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`rounded-md p-1.5 transition-colors hover:bg-surface dark:hover:bg-surface-dark ${danger ? "text-danger" : "text-text-secondary hover:text-primary"}`}
    >
      {children}
    </button>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="fixed inset-0 -z-10" onClick={onClose} />
      <div className="w-full max-w-sm max-h-[90vh] overflow-y-auto card p-6" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function EditUserModal({ user, onClose, onSaved }: { user: UserDetail; onClose: () => void; onSaved: () => void }) {
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(user.dateOfBirth?.slice(0, 10) ?? "");
  const [gender, setGender] = useState(user.gender ?? "");
  const [address, setAddress] = useState(user.address ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.put(`/users/${user.id}`, {
        firstName,
        lastName,
        phone: phone || undefined,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth).toISOString() : undefined,
        gender: gender || undefined,
        address: address || undefined,
      });
      onSaved();
    } catch (err: any) {
      setError(extractErrorMessage(err, "Could not save changes"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Overlay onClose={onClose}>
      <h3 className="text-lg font-semibold text-text-primary dark:text-text-dark-primary mb-1">Edit user</h3>
      <p className="text-sm text-text-secondary mb-4 font-mono">{user.universityId} · {user.role.replace(/_/g, " ")}</p>

      {error && <div className="mb-4 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">{error}</div>}

      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">First name</label>
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="input-field" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Last name</label>
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="input-field" required />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">Phone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input-field" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Date of birth</label>
            <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Gender</label>
            <select value={gender} onChange={(e) => setGender(e.target.value)} className="input-field">
              <option value="">Not specified</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">Address</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} className="input-field" />
        </div>
        <button type="submit" disabled={saving} className="btn-primary w-full">{saving ? "Saving..." : "Save changes"}</button>
      </form>
    </Overlay>
  );
}
