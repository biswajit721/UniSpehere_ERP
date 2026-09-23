import { GraduationCap, LogOut, Menu, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { ThemeToggle } from "../components/ui/ThemeToggle";
import { Toaster } from "../components/ui/Toaster";
import { ChatbotWidget } from "../features/chatbot/ChatbotWidget";
import { NotificationBell } from "../features/notices/NotificationBell";
import { useAuthStore } from "../store/authStore";
import { NAV_BY_ROLE } from "../utils/navConfig";

/** Module accents come from CSS variables, so the icon colours flip with the theme (see index.css). */
const moduleColor = (key: string) => `rgb(var(--m-${key}, var(--ink-2)))`;

export function DashboardLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = useMemo(() => (user ? NAV_BY_ROLE[user.role] ?? [] : []), [user]);
  const current = navItems.find((i) => location.pathname === i.path || location.pathname.startsWith(`${i.path}/`));

  // close the drawer after navigating, and on Escape
  useEffect(() => setSidebarOpen(false), [location.pathname]);
  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSidebarOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sidebarOpen]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    // 100dvh (not 100vh): on phones 100vh includes the browser toolbar and pushes the bottom of the page off-screen
    <div className="flex h-[100dvh] overflow-hidden bg-surface">
      {/* ------------------------------------------------------------------ sidebar */}
      <aside
        aria-label="Main navigation"
        className={`pt-safe fixed inset-y-0 left-0 z-40 flex w-[17rem] max-w-[85vw] transform flex-col border-r border-border bg-surface-card transition-transform duration-200 lg:static lg:w-64 lg:max-w-none lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0 shadow-pop" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white">
              <GraduationCap className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-semibold text-text-primary">UniSphere</span>
              <span className="block text-[11px] font-medium text-text-muted">University ERP</span>
            </span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-text-secondary hover:bg-surface lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="pb-safe flex-1 space-y-0.5 overflow-y-auto p-3">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `group relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors lg:min-h-10 ${
                  isActive ? "bg-primary/10 text-primary" : "text-text-secondary hover:bg-surface hover:text-text-primary"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-primary" aria-hidden="true" />}
                  <item.icon className="h-[18px] w-[18px] shrink-0" style={{ color: moduleColor(item.colorVar) }} aria-hidden="true" />
                  <span className="truncate">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 z-30 animate-fade-in bg-slate-950/50 lg:hidden" onClick={() => setSidebarOpen(false)} aria-hidden="true" />}

      {/* ------------------------------------------------------------------ main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="pt-safe flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface-card px-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-1">
            <button
              onClick={() => setSidebarOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-text-secondary hover:bg-surface lg:hidden"
              aria-label="Open menu"
              aria-expanded={sidebarOpen}
            >
              <Menu className="h-5 w-5" />
            </button>
            <p className="truncate pl-1 text-sm font-semibold text-text-primary lg:hidden">{current?.label ?? "UniSphere ERP"}</p>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <NotificationBell />
            <ThemeToggle />

            <div className="ml-1 flex items-center gap-2.5 border-l border-border pl-3">
              {user?.profilePhoto ? (
                <img src={user.profilePhoto} alt="" className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary" aria-hidden="true">
                  {user?.firstName?.[0]}
                  {user?.lastName?.[0]}
                </div>
              )}
              <div className="hidden text-sm sm:block">
                <p className="font-medium leading-tight text-text-primary">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-text-secondary">{user?.role.replace(/_/g, " ")}</p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-text-secondary hover:bg-danger-soft hover:text-danger"
              aria-label="Log out"
              title="Log out"
            >
              <LogOut className="h-[18px] w-[18px]" />
            </button>
          </div>
        </header>

        {/* scroll-padding keeps a focused / scrolled-to control clear of a sticky action bar (--sticky-bar is set by pages that show one) */}
        <main className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 [scroll-padding-bottom:calc(var(--sticky-bar,0px)+1.5rem)] sm:px-6 sm:py-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1400px]">
            <Outlet />
          </div>
        </main>
        <ChatbotWidget />
        <Toaster />
      </div>
    </div>
  );
}
