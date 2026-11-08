import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ReminderStore = {
  enabled: boolean;
  hour: number;
  minute: number;
  // True once the user has answered the one-time "turn on reminders?" prompt
  promptHandled: boolean;
  // Not persisted: whether the in-app "turn on reminders?" modal is showing
  promptVisible: boolean;
  setEnabled: (enabled: boolean) => void;
  setTime: (hour: number, minute: number) => void;
  setPromptHandled: () => void;
  setPromptVisible: (visible: boolean) => void;
};

export const useReminderStore = create<ReminderStore>()(
  persist(
    (set) => ({
      enabled: false,
      hour: 21,
      minute: 0,
      promptHandled: false,
      promptVisible: false,
      setEnabled: (enabled) => set({ enabled }),
      setTime: (hour, minute) => set({ hour, minute }),
      setPromptHandled: () => set({ promptHandled: true }),
      setPromptVisible: (visible) => set({ promptVisible: visible }),
    }),
    {
      name: 'reminder-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ promptVisible, ...rest }) => rest,
    }
  )
);

export const formatReminderTime = (hour: number, minute: number) =>
  new Date(2000, 0, 1, hour, minute).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
