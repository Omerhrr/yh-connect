"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api, setToken, type UserOut } from "@/lib/api";

type AuthState = {
  user: UserOut | null;
  token: string | null;
  setSession: (user: UserOut, token: string) => void;
  logout: () => void;
  refreshMe: () => Promise<void>;
};

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      setSession: (user, token) => {
        setToken(token);
        set({ user, token });
      },
      logout: () => {
        setToken(null);
        set({ user: null, token: null });
      },
      refreshMe: async () => {
        if (!get().token) return;
        try {
          const user = await api.me();
          set({ user });
        } catch {
          setToken(null);
          set({ user: null, token: null });
        }
      },
    }),
    {
      name: "yhc-auth",
      onRehydrateStorage: () => (state) => {
        if (state?.token) setToken(state.token);
      },
    }
  )
);
