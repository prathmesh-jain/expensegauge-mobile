import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';

type AuthStore = {
  name: string | null;
  email: string | null;
  role: string | null;
  admin: string | null;
  viewMode: 'admin' | 'user' | null;
  accessToken: string | null;
  refreshToken: string | null;
  profilePicture: string | null;
  isGuest: boolean;
  guestModeStartTime: string | null;
  hasHydrated: boolean;
  setHasHydrated: (hasHydrated: boolean) => void;
  setTokens: (access: string, refresh: string) => void;
  setUser: (name: string, email: string, role: string, profilePicture?: string) => void;
  setViewMode: (mode: 'admin' | 'user') => void;
  setGuestMode: () => void;
  exitGuestMode: () => void;
  clearTokens: () => void;
  reset: () => void;
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      name: null,
      email: null,
      role: null,
      admin: null,
      viewMode: null,
      accessToken: null,
      refreshToken: null,
      profilePicture: null,
      isGuest: false,
      guestModeStartTime: null,
      hasHydrated: false,
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
      setTokens: (access, refresh) => set({ accessToken: access, refreshToken: refresh }),
      setUser: (name, email, role, profilePicture) =>
        set((state) => {
          const nextViewMode: 'admin' | 'user' = role === 'admin'
            ? (state.viewMode ?? 'admin')
            : 'user';

          return {
            name,
            email,
            role,
            profilePicture: profilePicture || null,
            viewMode: nextViewMode,
            isGuest: false,
            guestModeStartTime: null,
          };
        }),
      setViewMode: (mode) => set({ viewMode: mode }),
      setGuestMode: () => set({
        isGuest: true,
        guestModeStartTime: new Date().toISOString(),
        role: 'user',
        viewMode: 'user',
        name: 'Guest User',
        email: null,
      }),
      exitGuestMode: () => set({
        isGuest: false,
        guestModeStartTime: null,
      }),
      clearTokens: () => set({ accessToken: null, refreshToken: null }),
      reset: () => set((state) => {
        return {
          name: null,
          email: null,
          role: null,
          admin: null,
          viewMode: null,
          accessToken: null,
          refreshToken: null,
          profilePicture: null,
          isGuest: false,
          guestModeStartTime: null,
          hasHydrated: state.hasHydrated,
        }
      }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => ({
        getItem: async (name: string) => await SecureStore.getItemAsync(name),
        setItem: async (name: string, value: string) => await SecureStore.setItemAsync(name, value),
        removeItem: async (name: string) => await SecureStore.deleteItemAsync(name),
      })),
      partialize: (state) => {
        const { hasHydrated, ...rest } = state;
        return rest;
      },
      onRehydrateStorage: () => () => {
        useAuthStore.setState({ hasHydrated: true });
      },
    }
  )
);
