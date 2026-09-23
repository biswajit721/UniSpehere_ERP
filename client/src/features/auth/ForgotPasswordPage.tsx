import { GraduationCap } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../services/api";
import { extractErrorMessage } from "../../utils/errorMessage";

type Step = "email" | "otp" | "reset" | "done";

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setStep("otp");
    } catch (err: any) {
      setError(extractErrorMessage(err, "Something went wrong"));
    } finally {
      setLoading(false);
    }
  };

  const submitOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.post("/auth/verify-otp", { email, otp });
      setResetToken(data.resetToken);
      setStep("reset");
    } catch (err: any) {
      setError(extractErrorMessage(err, "Invalid or expired code"));
    } finally {
      setLoading(false);
    }
  };

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { resetToken, newPassword });
      setStep("done");
    } catch (err: any) {
      setError(extractErrorMessage(err, "Could not reset password"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-surface dark:bg-surface-dark px-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <GraduationCap className="h-6 w-6 text-primary" />
          <span className="text-lg font-semibold text-text-primary dark:text-text-dark-primary">UniSphere ERP</span>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">{error}</div>
        )}

        {step === "email" && (
          <form onSubmit={submitEmail} className="space-y-4">
            <h2 className="text-xl font-semibold text-text-primary dark:text-text-dark-primary">Forgot password</h2>
            <p className="text-sm text-text-secondary">Enter your account email — we'll send a 6-digit code.</p>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@university.edu" className="input-field" required />
            <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? "Sending..." : "Send code"}</button>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={submitOtp} className="space-y-4">
            <h2 className="text-xl font-semibold text-text-primary dark:text-text-dark-primary">Enter the code</h2>
            <p className="text-sm text-text-secondary">
              We sent a 6-digit code to {email}. It expires in 10 minutes. (If SMTP isn't configured on the server, check the server console instead.)
            </p>
            <input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="123456" maxLength={6} className="input-field tracking-widest text-center text-lg" required />
            <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? "Verifying..." : "Verify code"}</button>
          </form>
        )}

        {step === "reset" && (
          <form onSubmit={submitReset} className="space-y-4">
            <h2 className="text-xl font-semibold text-text-primary dark:text-text-dark-primary">Set a new password</h2>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password" className="input-field" required />
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm new password" className="input-field" required />
            <p className="text-xs text-text-secondary">At least 8 characters, one uppercase letter, one number.</p>
            <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? "Resetting..." : "Reset password"}</button>
          </form>
        )}

        {step === "done" && (
          <div className="text-center space-y-4">
            <h2 className="text-xl font-semibold text-text-primary dark:text-text-dark-primary">Password reset</h2>
            <p className="text-sm text-text-secondary">You can now log in with your new password.</p>
            <button onClick={() => navigate("/login")} className="btn-primary w-full">Go to login</button>
          </div>
        )}

        {step !== "done" && (
          <p className="mt-6 text-center text-sm text-text-secondary">
            <Link to="/login" className="text-primary hover:underline">Back to login</Link>
          </p>
        )}
      </div>
    </div>
  );
}
