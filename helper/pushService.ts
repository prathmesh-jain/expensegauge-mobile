import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import api from '@/api/api';
import { setGroupNotificationsApi } from '@/api/groupApi';
import { useAuthStore } from '@/store/authStore';
import { useGroupStore } from '@/store/groupStore';
import { hasNotificationPermission, requestNotificationPermission } from '@/helper/reminderService';
import type { Group } from '@/types/group';

// Group push notifications are opt-in per group. The phone is only registered
// with the server once the person has turned at least one group on; allowing
// notifications for the daily reminder doesn't sign them up for group pushes.
// Keep in sync with backend/utils/pushService.js and groupNotifications.js.
const GROUP_CHANNEL_ID = 'group-activity';
export const GROUP_ACTIVITY_TYPE = 'group_activity';

const REGISTRATION_KEY = 'push-registration';
// Re-send the token now and then so the server copy stays fresh
const REFRESH_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

type Registration = { token: string; email: string; at: number };

const ensureGroupChannel = async () => {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(GROUP_CHANNEL_ID, {
    name: 'Group activity',
    description: 'Expenses and payments in groups you turned notifications on for',
    importance: Notifications.AndroidImportance.HIGH,
  });
};

const readRegistration = async (): Promise<Registration | null> => {
  try {
    const raw = await AsyncStorage.getItem(REGISTRATION_KEY);
    return raw ? (JSON.parse(raw) as Registration) : null;
  } catch {
    return null;
  }
};

const wantsGroupPushes = () => useGroupStore.getState().groups.some((g) => g.myNotify === true);

let syncing: Promise<void> | null = null;

/**
 * Sends this phone's push token to the server, only when signed in, allowed to
 * notify, and at least one group is turned on. Cheap to call often: it only
 * talks to the server when something changed.
 */
export const syncPushRegistration = (): Promise<void> => {
  if (syncing) return syncing;
  syncing = (async () => {
    try {
      const { accessToken, email } = useAuthStore.getState();
      if (!accessToken || !email || !wantsGroupPushes()) return;
      if (!(await hasNotificationPermission())) return;
      await ensureGroupChannel();

      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
      const saved = await readRegistration();
      if (saved && saved.token === token && saved.email === email && Date.now() - saved.at < REFRESH_AFTER_MS) return;

      await api.post('/notifications/register', { token }, { headers: { 'x-online-only': '1' } });
      await AsyncStorage.setItem(REGISTRATION_KEY, JSON.stringify({ token, email, at: Date.now() }));
    } catch (error) {
      // No Play services, offline, or no push config in this build: try again next time
      console.warn('[Push] Registration skipped:', (error as Error)?.message);
    } finally {
      syncing = null;
    }
  })();
  return syncing;
};

/** Called on logout, while still signed in, so this phone stops getting that account's pushes. */
export const unregisterPush = async () => {
  try {
    const saved = await readRegistration();
    await AsyncStorage.removeItem(REGISTRATION_KEY);
    if (saved?.token) {
      await api.post('/notifications/unregister', { token: saved.token }, {
        headers: { 'x-online-only': '1' },
        timeout: 8000,
      });
    }
  } catch {
    // The server drops it anyway once another account signs in on this phone
  }
};

export type GroupNotifyResult = { ok: true; group: Group } | { ok: false; message: string };

/**
 * Turns notifications for one group on or off. Turning on asks for the phone's
 * permission if needed and registers the phone.
 */
export const setGroupNotifications = async (groupId: string, on: boolean): Promise<GroupNotifyResult> => {
  if (on) {
    await ensureGroupChannel();
    if (!(await requestNotificationPermission())) {
      return { ok: false, message: 'Allow notifications for ExpenseGauge in your phone settings first' };
    }
  }
  const result = await setGroupNotificationsApi(groupId, on);
  if (!result.ok) return { ok: false, message: result.message };
  useGroupStore.getState().upsertGroup(result.data);
  if (on) await syncPushRegistration();
  return { ok: true, group: result.data };
};

// ---- "Get notified about <group>?" asked once per group ----

type GroupNotifyPromptStore = {
  group: { id: string; name: string } | null;
  show: (group: { id: string; name: string }) => void;
  hide: () => void;
};

export const useGroupNotifyPrompt = create<GroupNotifyPromptStore>()((set) => ({
  group: null,
  show: (group) => set({ group }),
  hide: () => set({ group: null }),
}));

/**
 * After creating or joining a group: ask about notifications for that group,
 * unless the person already chose for it or muted all groups in Preferences.
 */
export const askAboutGroupNotifications = (group: Group) => {
  if (group.myNotify !== null && group.myNotify !== undefined) return;
  if (!useGroupStore.getState().notificationsOn) return;
  // Let the screen transition finish first
  setTimeout(() => useGroupNotifyPrompt.getState().show({ id: group._id, name: group.name }), 500);
};
