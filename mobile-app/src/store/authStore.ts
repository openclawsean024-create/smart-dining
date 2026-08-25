import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Member } from '@smart-dining/contracts';

export interface AuthState {
  token: string | null;
  member: Member | null;
  setSession: (token: string, member: Member) => void;
  clear: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      member: null,
      setSession: (token, member) => set({ token, member }),
      clear: () => set({ token: null, member: null }),
      isAuthenticated: () => Boolean(get().token && get().member),
    }),
    {
      name: 'sd-mobile-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ token: s.token, member: s.member }),
    },
  ),
);

export function getStoredToken(): string | null {
  return useAuthStore.getState().token;
}

export function getStoredMember(): Member | null {
  return useAuthStore.getState().member;
}
