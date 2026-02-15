// syncQueue.ts
import api from './api';
import { getQueue, removeFromQueue, updateRequestInQueue, QueuedRequest } from '@/store/offlineQueue';
import { useExpenseStore } from '@/store/expenseStore';
import { useAdminStore } from '@/store/adminStore';
import { checkConnection } from './network';

const MAX_RETRIES = 3;
const BASE_DELAY = 1000; // Start with 1s

let isProcessingQueue = false;

export const processQueue = async () => {
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

  const { markAsSynced } = useExpenseStore.getState();
  const { markAsSyncedAdmin } = useAdminStore.getState();
  const now = Date.now();

  const inFlight = new Set<string>();

  for (const request of queue) {
    if (request.nextRetryTime && request.nextRetryTime > now) continue;
    if (inFlight.has(request.id)) continue;
    inFlight.add(request.id);

    try {
      const res = await api.request({
        method: request.method,
        url: request.url,
        data: request.data,
        headers: { 'x-skip-queue': 'true' },
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

      const isFatalClientError =
        typeof status === 'number' &&
        status >= 400 &&
        status <= 499 &&
        status !== 408 &&
        status !== 429;

      if (isFatalClientError) {
        await removeFromQueue(request.id);
        continue;
      }

      const retryCount = request.retryCount + 1;
      const boundedRetryCount = Math.min(retryCount, MAX_RETRIES);
      const backoffDelay = Math.pow(2, boundedRetryCount) * BASE_DELAY;
      const nextRetryTime = Date.now() + backoffDelay;

      await updateRequestInQueue({
        ...request,
        retryCount,
        nextRetryTime,
      });
    }
  }

  isProcessingQueue = false;
};
