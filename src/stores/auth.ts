import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../interface/User';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // ✅ hydration
  hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;

  // Actions
  setAuth: (user: User, token: string) => void;
  setUser: (user: User | null) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // ✅ hydration state
      hasHydrated: false,
      setHasHydrated: (state: boolean) => set({ hasHydrated: state }),

      setAuth: (user, token) =>
        set({
          user,
          token,
          isAuthenticated: true,
          error: null
        }),

      setUser: (user) =>
        set((state) => ({
          user,
          isAuthenticated: !!user && !!state.token
        })),

      setLoading: (isLoading) => set({ isLoading }),

      setError: (error) => set({ error }),

      clearError: () => set({ error: null }),

      reset: () =>
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
          error: null
        })
    }),
    {
      name: 'auth-storage',

      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated
      }),

      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      }
    }
  )
);
