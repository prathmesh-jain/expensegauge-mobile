import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeStore = {
  theme: 'light' | 'dark' | null;
  setTheme: (theme: 'light' | 'dark' | null) => void;
};

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      theme: null,
      setTheme: (theme) => set({ theme: theme }),
    }),
    {
      name: 'theme-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
