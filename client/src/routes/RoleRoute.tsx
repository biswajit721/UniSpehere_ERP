import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { Role } from "../types/auth";

export function RoleRoute({ allow }: { allow: Role[] }) {
  const { user } = useAuthStore();

  if (!user) return <Navigate to="/login" replace />;
  if (!allow.includes(user.role) && user.role !== "SUPER_ADMIN") {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
