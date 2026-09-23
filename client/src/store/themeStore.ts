import { create } from "zustand";

export type Theme = "light" | "dark";

const STORAGE_KEY = "unisphere-theme";
const THEME_COLOR: Record<Theme, string> = { light: "#F3F5F9", dark: "#0A101E" };

const prefersDark = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-color-scheme: dark)").matches;

function readStored(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "dark" || v === "light" ? v : null;
  } catch {
    return null; // storage can be blocked (private mode) - fall back to the OS preference
  }
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme]);
}

interface ThemeState {
  theme: Theme;
  /** true once the person has chosen a theme; until then we follow the operating system. */
  isExplicit: boolean;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
}

const stored = readStored();
const initial: Theme = stored ?? (prefersDark() ? "dark" : "light");
applyTheme(initial);

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: initial,
  isExplicit: stored !== null,
  setTheme: (theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore - the theme still applies for this session */
    }
    applyTheme(theme);
    set({ theme, isExplicit: true });
  },
  toggle: () => get().setTheme(get().theme === "dark" ? "light" : "dark"),
}));

// Follow the OS light/dark switch live, but only until the person has picked a theme themselves.
if (typeof window !== "undefined" && window.matchMedia) {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", (e) => {
    if (useThemeStore.getState().isExplicit) return;
    const theme: Theme = e.matches ? "dark" : "light";
    applyTheme(theme);
    useThemeStore.setState({ theme });
  });
}
