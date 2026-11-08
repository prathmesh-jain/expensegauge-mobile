import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';
import { useAuthStore } from '@/store/authStore';
import { useExpenseStore } from '@/store/expenseStore';
import { useReminderStore } from '@/store/reminderStore';

const CHANNEL_ID = 'daily-reminder';
export const REMINDER_NOTIFICATION_TYPE = 'daily-reminder';

// Reminders are scheduled one day at a time (instead of a repeating trigger) so that
// today's can be skipped once an expense is added. The window rolls forward every
// time the app opens, so it only runs out if the app is untouched for this long.
const DAYS_AHEAD = 14;

const MESSAGES = [
  'Spent anything today? Add it in a few seconds.',
  'Quick check-in: log today’s expenses before you forget.',
  'Keep your streak going. Add today’s spending.',
];

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const ensureChannel = async () => {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Daily reminder',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
};

export const hasNotificationPermission = async () => {
  const { granted } = await Notifications.getPermissionsAsync();
  return granted;
};

/**
 * Asks for notification permission if it can still be asked.
 * Returns false when it is denied, including when Android will no longer show the prompt.
 */
export const requestNotificationPermission = async () => {
  // Android 13+ only shows the permission prompt once a channel exists
  await ensureChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const { granted } = await Notifications.requestPermissionsAsync();
  return granted;
};

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const hasAddedExpenseToday = () => {
  const now = new Date();
  return useExpenseStore.getState().cachedExpenses.some((expense) => {
    if (!expense.createdAt) return false;
    const created = new Date(expense.createdAt);
    return !Number.isNaN(created.getTime()) && isSameDay(created, now);
  });
};

const cancelScheduledReminders = async () => {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((request) => request.content.data?.type === REMINDER_NOTIFICATION_TYPE)
      .map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier))
  );
};

const scheduleReminders = async () => {
  await cancelScheduledReminders();

  const { enabled, hour, minute } = useReminderStore.getState();
  if (!enabled || !useAuthStore.getState().accessToken) return;
  if (!(await hasNotificationPermission())) return;

  await ensureChannel();
  const now = new Date();
  const skipToday = hasAddedExpenseToday();

  for (let dayOffset = 0; dayOffset < DAYS_AHEAD; dayOffset++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, hour, minute);
    if (date <= now || (dayOffset === 0 && skipToday)) continue;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'ExpenseGauge',
        body: MESSAGES[date.getDate() % MESSAGES.length],
        data: { type: REMINDER_NOTIFICATION_TYPE },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
        channelId: CHANNEL_ID,
      },
    });
  }
};

// Serialize syncs so overlapping cancel/schedule runs can't leave duplicates behind
let syncChain: Promise<void> = Promise.resolve();
export const syncDailyReminder = () => {
  syncChain = syncChain
    .then(scheduleReminders)
    .catch((error) => console.error('[Reminder] Failed to sync reminders:', error));
  return syncChain;
};

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
const syncSoon = () => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(syncDailyReminder, 1000);
};

const waitForHydration = (store: { persist: { hasHydrated: () => boolean; onFinishHydration: (fn: () => void) => () => void } }) =>
  new Promise<void>((resolve) => {
    if (store.persist.hasHydrated()) return resolve();
    const unsubscribe = store.persist.onFinishHydration(() => {
      unsubscribe();
      resolve();
    });
  });

/**
 * Keeps scheduled reminders in step with the app: login/logout, expenses added,
 * settings changed, and the app coming back to the foreground.
 */
export const startDailyReminderSync = () => {
  const unsubscribers = [
    useAuthStore.subscribe((state, prev) => {
      if (state.accessToken !== prev.accessToken) syncSoon();
    }),
    useExpenseStore.subscribe((state, prev) => {
      if (state.cachedExpenses !== prev.cachedExpenses) syncSoon();
    }),
    useReminderStore.subscribe((state, prev) => {
      if (state.enabled !== prev.enabled || state.hour !== prev.hour || state.minute !== prev.minute) {
        syncDailyReminder();
      }
    }),
  ];
  const appStateSub = AppState.addEventListener('change', (status) => {
    if (status === 'active') syncSoon();
  });

  Promise.all([
    waitForHydration(useAuthStore),
    waitForHydration(useExpenseStore),
    waitForHydration(useReminderStore),
  ]).then(syncDailyReminder);

  return () => {
    unsubscribers.forEach((unsubscribe) => unsubscribe());
    appStateSub.remove();
    if (debounceTimer) clearTimeout(debounceTimer);
  };
};

/**
 * Asks once, after the user saves an expense, whether they want the daily reminder.
 * The question itself is ReminderPromptModal, mounted in the root layout.
 */
export const offerDailyReminder = () => {
  const { enabled, promptHandled, setPromptHandled, setPromptVisible } = useReminderStore.getState();
  if (enabled || promptHandled) return;
  setPromptHandled();
  // Let the expense form finish closing first
  setTimeout(() => setPromptVisible(true), 400);
};
