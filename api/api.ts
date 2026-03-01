import { useAuthStore } from '@/store/authStore';
import { useExpenseStore } from '@/store/expenseStore';
import { useAdminStore } from '@/store/adminStore';
import axios from 'axios';
import * as Updates from 'expo-updates';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { checkConnection } from './network';
import { addToQueue } from '@/store/offlineQueue';
import { clearQueue } from '@/store/offlineQueue';

const API_URL = process.env.EXPO_PUBLIC_API_URL

const api = axios.create({
  baseURL: API_URL,
  timeout: 90000, // for cold-start backend
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState()

  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }

  config.headers['x-app-version'] = Constants.expoConfig?.version || '1.0.0';
  config.headers['x-ota-version'] = Updates.updateId || 'none';
  config.headers['x-platform'] = Platform.OS;

  return config
})

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

const subscribeTokenRefresh = (cb: (token: string) => void) => {
  refreshSubscribers.push(cb);
};

const onRefreshed = (token: string) => {
  refreshSubscribers.map((cb) => cb(token));
  refreshSubscribers = [];
};

let onQueueAdded: (() => void) | null = null;
export const setOnQueueAdded = (cb: () => void) => {
  onQueueAdded = cb;
};

api.interceptors.response.use(
  (response) => response,
  async (error: any) => {
    const { refreshToken, setTokens, reset } = useAuthStore.getState();
    const originalRequest = error.config;

    // Skip if no request config or if specifically told to skip queue (internal sync requests)
    if (!originalRequest || originalRequest.headers?.['x-skip-queue']) {
      return Promise.reject(error);
    }

    const isConnected = await checkConnection();
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(originalRequest.method?.toUpperCase() || '');

    // 1. Detect network/offline errors (no error.response)
    // Also treat 5xx, 408, 429 as retryable candidates for mutation queuing
    const status = error.response?.status;
    const isNoResponse = !error.response;
    const isRetryableError = isNoResponse || (status && (status >= 500 || status === 408 || status === 429));

    const isAuthRequest = originalRequest.url?.includes('/user/login') ||
      originalRequest.url?.includes('/user/signup') ||
      originalRequest.url?.includes('/user/google-login') ||
      originalRequest.url?.includes('/user/refresh');

    // Handle offline/network failure for mutations: Queue and return a successful offline response
    if (isMutation && isRetryableError && !isAuthRequest) {
      console.log(`[Offline-First] Queueing ${originalRequest.method} request due to ${isNoResponse ? 'network failure' : 'server error ' + status}`);

      let metadata = {};
      try {
        const rawMeta = originalRequest.headers?.['x-meta'];
        if (rawMeta) {
          metadata = typeof rawMeta === 'string' ? JSON.parse(rawMeta) : rawMeta;
        }
      } catch (e) {
        console.warn('Failed to parse x-meta header', e);
      }

      await addToQueue({
        method: originalRequest.method?.toUpperCase() as any,
        url: originalRequest.url!,
        data: originalRequest.data ? (typeof originalRequest.data === 'string' ? JSON.parse(originalRequest.data) : originalRequest.data) : undefined,
        ...metadata,
      });

      // Trigger the sync processor to check if it can run
      onQueueAdded?.();

      // Return a standard response object that the UI can recognize as "offline success"
      return Promise.resolve({
        data: { offline: true, pendingSync: true },
        status: 202, // Accepted
        statusText: 'Accepted (Offline)',
        headers: {},
        config: originalRequest
      });
    }

    // 2. Handle Authentication only when the server actually responds with 401
    if (status === 401 && !isAuthRequest && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          subscribeTokenRefresh((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const res = await axios.post(`${API_URL}/user/refresh`, { refreshToken }, { timeout: 30000 });
        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = res.data;

        setTokens(newAccessToken, newRefreshToken);
        isRefreshing = false;
        onRefreshed(newAccessToken);

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        refreshSubscribers = [];

        // ONLY log out if the refresh call itself failed with a clear 4xx response
        // If it's a network error/timeout during refresh, DO NOT log out.
        if (axios.isAxiosError(refreshError) && refreshError.response && refreshError.response.status === 401) {
          console.error('[Auth] Refresh token failed with 401, logging out');
          const { reset: resetExpenseStore } = useExpenseStore.getState();
          const { reset: resetAdminStore } = useAdminStore.getState();
          resetExpenseStore();
          resetAdminStore();
          // Keep the offline queue persisted
          reset();
          router.replace('/');
        } else {
          console.warn('[Auth] Refresh failed (likely network/timeout), maintaining session');
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
)


export default api;
