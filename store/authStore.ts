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
  setTokens: (access: string, refresh: string) => void;
  setUser: (name: string, email: string, role: string, profilePicture?: string) => void;
  setViewMode: (mode: 'admin' | 'user') => void;
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
          };
        }),
      setViewMode: (mode) => set({ viewMode: mode }),
      clearTokens: () => set({ accessToken: null, refreshToken: null }),
      reset: () => set(() => {
        return {
          name: null,
          email: null,
          role: null,
          admin: null,
          viewMode: null,
          accessToken: null,
          refreshToken: null,
          profilePicture: null,
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
    }
  )
);
