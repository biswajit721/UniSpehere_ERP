import { create } from "zustand";
import { api } from "../services/api";
import { AuthUser } from "../types/auth";

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isInitialized: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchCurrentUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  isInitialized: false,

  login: async (identifier, password) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post("/auth/login", { identifier, password });
      set({ user: data.user, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    await api.post("/auth/logout").catch(() => undefined);
    set({ user: null });
  },

  fetchCurrentUser: async () => {
    try {
      const { data } = await api.get("/auth/me");
      set({ user: data.user, isInitialized: true });
    } catch {
      set({ user: null, isInitialized: true });
    }
  },
}));
