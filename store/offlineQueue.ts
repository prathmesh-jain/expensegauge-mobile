import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = '@offline_api_queue';

const MAX_QUEUE_LENGTH = 200;
const MAX_QUEUE_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type QueuedRequest = {
  id: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  data?: any;
  timestamp: number;
  retryCount: number;
  nextRetryTime: number;
  // Custom metadata to identify what to mark synced later
  localId?: string; // local temp _id of expense
  userId?: string;  // user _id for admin actions
  type?: 'expense' | 'balance' | 'admin_expense' | 'admin_balance' | 'other';
  action?: 'add' | 'edit' | 'delete' | 'other';
};

export const addToQueue = async (request: Omit<QueuedRequest, 'id' | 'timestamp' | 'retryCount' | 'nextRetryTime'>) => {
  const currentQueue = await getQueue();
  const newItem: QueuedRequest = {
    ...request,
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    timestamp: Date.now(),
    retryCount: 0,
    nextRetryTime: Date.now(),
  };
  const now = Date.now();
  const prunedByAge = [...currentQueue, newItem].filter((item) => {
    if (!item.timestamp) return true;
    return now - item.timestamp <= MAX_QUEUE_AGE_MS;
  });
  const updatedQueue = prunedByAge.slice(-MAX_QUEUE_LENGTH);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(updatedQueue));
};

export const getQueue = async (): Promise<QueuedRequest[]> => {
  const data = await AsyncStorage.getItem(QUEUE_KEY);
  return data ? JSON.parse(data) : [];
};

export const removeFromQueue = async (id: string) => {
  const currentQueue = await getQueue();
  const updatedQueue = currentQueue.filter(item => item.id !== id);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(updatedQueue));
};

export const updateRequestInQueue = async (updatedRequest: QueuedRequest) => {
  const currentQueue = await getQueue();
  const updatedQueue = currentQueue.map(item =>
    item.id === updatedRequest.id ? updatedRequest : item
  );
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(updatedQueue));
};

export const hasPendingUserMutationRequests = async (): Promise<boolean> => {
  const queue = await getQueue();
  return queue.some((req) => {
    const isUserMutationType = req.type === 'expense' || req.type === 'balance';
    const isUserAction = req.action === 'add' || req.action === 'edit' || req.action === 'delete';
    return isUserMutationType && isUserAction;
  });
};

export const clearQueue = async () => {
  await AsyncStorage.removeItem(QUEUE_KEY);
};
