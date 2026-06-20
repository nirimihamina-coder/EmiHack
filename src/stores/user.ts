import { create } from 'zustand';
import type { UserProfileResponse } from '../services/userService';

interface UserState {
  profile: UserProfileResponse | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setProfile: (profile: UserProfileResponse | null) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  reset: () => void;
}

export const useUserStore = create<UserState>()((set) => ({
  profile: null,
  isLoading: false,
  error: null,

  setProfile: (profile) => set({ profile }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  clearError: () => set({ error: null }),

  reset: () =>
    set({
      profile: null,
      isLoading: false,
      error: null
    })
}));