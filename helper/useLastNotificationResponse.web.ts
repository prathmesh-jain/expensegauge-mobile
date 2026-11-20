import type { NotificationResponse } from 'expo-notifications';

// expo-notifications can't report tapped notifications in the browser.
export const useLastNotificationResponse = (): NotificationResponse | null | undefined => null;
