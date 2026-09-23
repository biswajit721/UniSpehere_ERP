import { useEffect, useState } from "react";
import { api } from "../services/api";
import { useAuthStore } from "../store/authStore";

interface Stat {
  label: string;
  value: string | number;
}

export function DashboardHome() {
  const user = useAuthStore((s) => s.user);
  const [stats, setStats] = useState<Stat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/dashboard/summary")
      .then(({ data }) => setStats(data.stats))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-text-primary dark:text-text-dark-primary">
        Welcome back, {user?.firstName}
      </h1>
      <p className="text-sm text-text-secondary mt-1">
        Signed in as {user?.role.replace("_", " ")} · {user?.universityId}
      </p>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading &&
          [1, 2, 3, 4].map((i) => (
            <div key={i} className="card p-5 animate-pulse">
              <div className="h-3 w-20 bg-surface dark:bg-surface-dark rounded" />
              <div className="h-6 w-12 bg-surface dark:bg-surface-dark rounded mt-3" />
            </div>
          ))}
        {!loading && stats.length === 0 && (
          <div className="card p-5 col-span-full text-sm text-text-secondary">
            No stats available for your role yet.
          </div>
        )}
        {!loading &&
          stats.map((s) => (
            <div key={s.label} className="card p-5">
              <p className="text-sm text-text-secondary">{s.label}</p>
              <p className="mt-2 text-2xl font-semibold text-text-primary dark:text-text-dark-primary">
                {s.value}
              </p>
            </div>
          ))}
      </div>
    </div>
  );
}
