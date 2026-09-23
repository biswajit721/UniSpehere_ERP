import { Camera } from "lucide-react";
import { useRef, useState } from "react";
import { api } from "../services/api";
import { useAuthStore } from "../store/authStore";
import { extractErrorMessage } from "../utils/errorMessage";

export function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const fetchCurrentUser = useAuthStore((s) => s.fetchCurrentUser);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const [phone, setPhone] = useState(user?.phone ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(user?.dateOfBirth?.slice(0, 10) ?? "");
  const [gender, setGender] = useState(user?.gender ?? "");
  const [address, setAddress] = useState(user?.address ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [detailsSaving, setDetailsSaving] = useState(false);
  const [detailsSuccess, setDetailsSuccess] = useState<string | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);
  const [pwSaving, setPwSaving] = useState(false);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("photo", file);
      await api.post("/auth/me/photo", formData, { headers: { "Content-Type": "multipart/form-data" } });
      await fetchCurrentUser();
    } catch (err: any) {
      setPhotoError(extractErrorMessage(err, "Could not upload photo"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const saveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setDetailsError(null);
    setDetailsSuccess(null);
    setDetailsSaving(true);
    try {
      await api.put("/auth/me", {
        phone: phone || undefined,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth).toISOString() : undefined,
        gender: gender || undefined,
        address: address || undefined,
        bio: bio || undefined,
      });
      await fetchCurrentUser();
      setDetailsSuccess("Details updated.");
    } catch (err: any) {
      setDetailsError(extractErrorMessage(err, "Could not update details"));
    } finally {
      setDetailsSaving(false);
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(null);
    if (newPassword !== confirmPassword) {
      setPwError("New password and confirmation don't match");
      return;
    }
    setPwSaving(true);
    try {
      await api.post("/auth/change-password", { currentPassword, newPassword });
      setPwSuccess("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPwError(extractErrorMessage(err, "Could not update password"));
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary dark:text-text-dark-primary">Settings</h1>
        <p className="text-sm text-text-secondary mt-1">Your profile, personal details, and account security.</p>
      </div>

      <div className="card p-5 mb-6">
        <h2 className="text-sm font-semibold text-text-primary dark:text-text-dark-primary mb-3">Profile photo</h2>
        {photoError && <div className="mb-3 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">{photoError}</div>}
        <div className="flex items-center gap-4">
          <div className="relative">
            {user?.profilePhoto ? (
              <img src={user.profilePhoto} alt="" className="h-16 w-16 rounded-full object-cover" />
            ) : (
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-lg font-semibold text-primary">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 rounded-full bg-primary p-1.5 text-white"
              aria-label="Change photo"
            >
              <Camera className="h-3.5 w-3.5" />
            </button>
          </div>
          <div>
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="text-sm font-medium text-primary">
              {uploading ? "Uploading..." : "Change photo"}
            </button>
            <p className="text-xs text-text-secondary mt-0.5">JPG or PNG, up to 10MB.</p>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
        </div>
      </div>

      <div className="card p-5 mb-6">
        <h2 className="text-sm font-semibold text-text-primary dark:text-text-dark-primary mb-3">Personal details</h2>
        <p className="text-xs text-text-secondary mb-3">
          {user?.firstName} {user?.lastName} · {user?.email} · {user?.universityId} · {user?.role.replace("_", " ")}
        </p>

        {detailsError && <div className="mb-4 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">{detailsError}</div>}
        {detailsSuccess && <div className="mb-4 rounded-lg border border-success/30 bg-success-soft px-4 py-3 text-sm text-success">{detailsSuccess}</div>}

        <form onSubmit={saveDetails} className="space-y-4">
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
                <option value="">Prefer not to say</option>
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
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Bio (optional)</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} className="input-field" rows={2} />
          </div>
          <button type="submit" disabled={detailsSaving} className="btn-primary w-full">{detailsSaving ? "Saving..." : "Save details"}</button>
        </form>
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-text-primary dark:text-text-dark-primary mb-3">Change password</h2>

        {pwError && <div className="mb-4 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">{pwError}</div>}
        {pwSuccess && <div className="mb-4 rounded-lg border border-success/30 bg-success-soft px-4 py-3 text-sm text-success">{pwSuccess}</div>}

        <form onSubmit={savePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Current password</label>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="input-field" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">New password</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="input-field" required />
            <p className="mt-1 text-xs text-text-secondary">At least 8 characters, one uppercase letter, one number.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Confirm new password</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="input-field" required />
          </div>
          <button type="submit" disabled={pwSaving} className="btn-primary w-full">{pwSaving ? "Updating..." : "Update password"}</button>
        </form>
      </div>
    </div>
  );
}
