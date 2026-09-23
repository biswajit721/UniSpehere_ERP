import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, GraduationCap } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { ThemeToggle } from "../../components/ui/ThemeToggle";
import { useAuthStore } from "../../store/authStore";
import { extractErrorMessage } from "../../utils/errorMessage";

const loginSchema = z.object({
  identifier: z.string().min(3, "Enter your email or university ID"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginFormData) => {
    setServerError(null);
    try {
      await login(values.identifier, values.password);
      navigate("/dashboard");
    } catch (err: any) {
      setServerError(extractErrorMessage(err, "Login failed. Please try again."));
    }
  };

  return (
    <div className="relative flex min-h-[100dvh]">
      <ThemeToggle className="absolute right-3 top-3 z-10 bg-surface-card/70 backdrop-blur lg:right-5 lg:top-5" />
      {/* Left: brand panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-primary p-12 text-white">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-7 w-7" />
          <span className="text-xl font-semibold">UniSphere ERP</span>
        </div>
        <div>
          <h1 className="text-4xl font-bold leading-tight mb-4">
            One intelligent platform for complete university management
          </h1>
          <p className="text-white/95 max-w-md">
            Attendance, academics, examinations, fees, hostel, placements, and more —
            connected in a single system for every role on campus.
          </p>
        </div>
        <p className="text-sm text-white/95">© {new Date().getFullYear()} UniSphere ERP</p>
      </div>

      {/* Right: login form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <GraduationCap className="h-6 w-6 text-primary" />
            <span className="text-lg font-semibold text-text-primary">UniSphere ERP</span>
          </div>

          <h2 className="text-2xl font-semibold text-text-primary mb-1">Sign in</h2>
          <p className="text-sm text-text-secondary mb-6">
            Use your university email or ID to access your dashboard.
          </p>

          {serverError && (
            <div className="mb-4 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">
                Email or University ID
              </label>
              <input
                type="text"
                placeholder="you@university.edu or STU2025001"
                className="input-field"
                {...register("identifier")}
              />
              {errors.identifier && (
                <p className="mt-1 text-xs text-danger">{errors.identifier.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="input-field pr-10"
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-danger">{errors.password.message}</p>
              )}
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-text-secondary">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="rounded border-border"
                />
                Remember me
              </label>
              <a href="/forgot-password" className="text-primary hover:underline">
                Forgot password?
              </a>
            </div>

            <button type="submit" disabled={isLoading} className="btn-primary w-full">
              {isLoading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-xs text-text-secondary">
            Accounts are created by your university administrator. Contact your admin office
            if you don't have login details yet.
          </p>
        </div>
      </div>
    </div>
  );
}
