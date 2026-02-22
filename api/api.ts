// api.ts
import { useAuthStore } from '@/store/authStore';
import { useExpenseStore } from '@/store/expenseStore';
import { useAdminStore } from '@/store/adminStore';
import axios from 'axios';
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
  return config
})

let onQueueAdded: (() => void) | null = null;
export const setOnQueueAdded = (cb: () => void) => {
  onQueueAdded = cb;
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { refreshToken, setTokens, reset } = useAuthStore.getState()
    const originalRequest = error.config;

    // 1. Skip if specifically told to, or if it's already a retry (to avoid loops)
    if (originalRequest.headers?.['x-skip-queue']) {
      return Promise.reject(error);
    }

    const isConnected = await checkConnection();
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(originalRequest.method?.toUpperCase() || '');

    // 2. Queue mutations on ANY retryable error (offline, 5xx, timeout)
    const status = error.response?.status;
    const isRetryableError = !status || (status >= 500 && status <= 599) || status === 408;

    const isAuthRequest = originalRequest.url?.includes('/user/login') ||
      originalRequest.url?.includes('/user/signup') ||
      originalRequest.url?.includes('/user/google-login');

    if (isMutation && (!isConnected || isRetryableError) && !isAuthRequest) {
      console.error(`Queueing ${originalRequest.method} request due to ${isConnected ? 'retryable error' : 'offline status'}`);

      const metadata = originalRequest.headers?.['x-meta']
        ? JSON.parse(originalRequest.headers['x-meta'])
        : {};

      await addToQueue({
        method: originalRequest.method?.toUpperCase() as any,
        url: originalRequest.url!,
        data: originalRequest.data ? JSON.parse(originalRequest.data) : undefined,
        ...metadata,
      });

      // Trigger the sync processor immediately if something was added
      onQueueAdded?.();

      return Promise.resolve({ data: { offline: true } });
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const res = await axios.post(`${API_URL}/user/refresh`, {
          refreshToken,
        });
        const newAccessToken = res.data.accessToken;
        const newRefreshToken = res.data.refreshToken;
        setTokens(newAccessToken, newRefreshToken);
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (err) {
        // Refresh failed — logout user
        console.error('Refresh token invalid, logging out');
        const { reset: resetExpenseStore } = useExpenseStore.getState()
        const { reset: resetAdminStore } = useAdminStore.getState()
        resetExpenseStore()
        resetAdminStore()
        await clearQueue()
        reset()
        router.replace('/')
        return Promise.reject(err);
      }
    }
    return Promise.reject(error);
  }
)

export default api;
