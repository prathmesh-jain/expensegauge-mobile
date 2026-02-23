// syncQueue.ts
import api from './api';
import { getQueue, removeFromQueue, updateRequestInQueue, QueuedRequest } from '@/store/offlineQueue';
import { useExpenseStore } from '@/store/expenseStore';
import { useAdminStore } from '@/store/adminStore';
import { checkConnection } from './network';

const MAX_RETRIES = 10;
const BASE_DELAY = 1000; // 1s
const MAX_DELAY = 60000; // 60s

let isProcessingQueue = false;

export const processQueue = async (force: boolean = false) => {
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  const isConnected = await checkConnection();
  if (!isConnected) {
    isProcessingQueue = false;
    return;
  }

  const queue = await getQueue();
  if (queue.length === 0) {
    isProcessingQueue = false;
    return;
  }

  try {
    const { markAsSynced } = useExpenseStore.getState();
    const { markAsSyncedAdmin } = useAdminStore.getState();
    const now = Date.now();

    for (const request of queue) {
      // 1. Skip if it's not time to retry or if there's no connection
      // If 'force' is true, we ignore the backoff timer.
      if (!force && request.nextRetryTime && request.nextRetryTime > now) continue;


      // Double check connection inside the loop in case it dropped
      if (!(await checkConnection())) break;

      try {
        const res = await api.request({
          method: request.method,
          url: request.url,
          data: request.data,
          headers: { 'x-skip-queue': 'true' }, // Ensure we don't re-queue this from the interceptor
        });

        // Handle Sync Mapping
        if (request.type === 'expense') {
          if (request.action === 'add') {
            markAsSynced(request.localId!, res.data?.id || request.localId!);
          } else if (request.action === 'edit') {
            markAsSynced(request.localId!, request.localId!);
          }
        } else if (request.type === 'admin_expense') {
          if (request.action === 'edit' && request.userId) {
            markAsSyncedAdmin(request.localId!, request.localId!, request.userId);
          }
        } else if (request.type === 'admin_balance') {
          if (request.action === 'add' && request.userId) {
            markAsSyncedAdmin(request.localId!, res.data?.id || request.localId!, request.userId);
          }
        }

        await removeFromQueue(request.id);
      } catch (err: any) {
        const status = err?.response?.status as number | undefined;

        // 2. Handle 401 during sync: The api request above might have failed if token expired
        // but the api.ts interceptor should handle token refresh automatically now if it's not skipped.
        // Wait, we used `api.request` which DOES go through interceptors.
        // If interceptor fails to refresh, it should reject here.

        // 3. Decide if error is fatal (validation) or retryable (network/server)
        const isFatalClientError =
          typeof status === 'number' &&
          status >= 400 &&
          status <= 499 &&
          status !== 401 && // 401 is handled by refresh flow, if it reach here refresh failed
          status !== 408 && // Timeout
          status !== 429;  // Too Many Requests

        if (isFatalClientError) {
          console.error(`[Sync] Fatal error for request ${request.id}, removing from queue:`, status, err?.response?.data);
          await removeFromQueue(request.id);
          continue;
        }

        // 4. Implement Exponential Backoff with Jitter
        const retryCount = request.retryCount + 1;

        if (retryCount >= MAX_RETRIES) {
          console.warn(`[Sync] Max retries reached for request ${request.id}, giving up.`);
          await removeFromQueue(request.id);
          continue;
        }

        // backoff = min(MAX_DELAY, BASE_DELAY * 2^retryCount)
        const exponentialDelay = Math.min(MAX_DELAY, BASE_DELAY * Math.pow(2, retryCount));
        // Add jitter: random between 0.8 and 1.2 of the delay
        const jitter = 0.8 + Math.random() * 0.4;
        const backoffDelay = exponentialDelay * jitter;
        const nextRetryTime = Date.now() + backoffDelay;

        console.log(`[Sync] Request ${request.id} failed (${status || 'Network Error'}). Retrying in ${Math.round(backoffDelay / 1000)}s (Attempt ${retryCount}/${MAX_RETRIES})`);

        await updateRequestInQueue({
          ...request,
          retryCount,
          nextRetryTime,
        });
      }
    }
  } finally {
    isProcessingQueue = false;
  }
};

