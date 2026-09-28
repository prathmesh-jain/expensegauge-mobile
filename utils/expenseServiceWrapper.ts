import { useAuthStore } from '@/store/authStore';
import { useAccountStore, AccountSource } from '@/store/accountStore';
import * as guestExpenseService from './guestExpenseService';
import { addExpenseApi, editExpenseApi } from '@/api/expenseApi';
import {
  fetchAccountsApi,
  createAccountApi,
  updateAccountApi,
  setDefaultAccountApi,
  deleteAccountApi
} from '@/api/accountApi';
import api from '@/api/api';

export const addExpense = async (expense: any): Promise<{ id?: number; _id?: string; clientId?: string } | null> => {
  const isGuest = useAuthStore.getState().isGuest;

  if (isGuest) {
    // Use local SQLite for guest users
    const result = await guestExpenseService.addLocalExpense({
      details: expense.details,
      amount: expense.amount,
      type: expense.type,
      category: expense.category,
      date: expense.date,
      sourceId: expense.sourceId as string | undefined,
    });
    return result; // Return the result with id and clientId
  } else {
    // Use API for logged-in users
    const apiResult = await addExpenseApi(expense);
    if (apiResult) {
      return { _id: apiResult };
    }
    return null;
  }
};

export const editExpense = async (id: string, expense: any) => {
  const isGuest = useAuthStore.getState().isGuest;

  if (isGuest) {
    // Use local SQLite for guest users
    await guestExpenseService.updateLocalExpense(parseInt(id), {
      details: expense.details,
      amount: expense.amount,
      type: expense.type,
      category: expense.category,
      date: expense.date,
      sourceId: expense.sourceId as string | undefined,
    });
  } else {
    // Use API for logged-in users
    await editExpenseApi({ ...expense, _id: id });
  }
};

export const deleteExpense = async (id: string) => {
  const isGuest = useAuthStore.getState().isGuest;
  
  if (isGuest) {
    // Use local SQLite for guest users
    await guestExpenseService.deleteLocalExpense(parseInt(id));
  } else {
    // Use API for logged-in users
    await api.delete(`/expense/${id}`);
  }
};

export const getExpenses = async (
  limit = 50,
  offset = 0,
  range = 'all_time',
  sourceId?: string | null
) => {
  const isGuest = useAuthStore.getState().isGuest;
  
  if (isGuest) {
    // Use local SQLite for guest users
    return await guestExpenseService.getLocalExpenses(limit, offset, range, sourceId);
  } else {
    // Use API for logged-in users
    const rangeParam = range !== 'all_time' ? `&range=${range}` : '';
    const accountParam = sourceId ? `&sourceId=${sourceId}` : '';
    const response = await api.get(`/expense/get-expense/?limit=${limit}&offset=${offset}${rangeParam}${accountParam}`);
    return response.data;
  }
};

export const getExpenseAnalytics = async (range = 'all_time', sourceId?: string | null) => {
  const isGuest = useAuthStore.getState().isGuest;
  
  if (isGuest) {
    // Use local SQLite for guest users
    return await guestExpenseService.getLocalExpenseAnalytics(range, sourceId);
  } else {
    // Use API for logged-in users
    const params = new URLSearchParams();
    if (sourceId) params.append('sourceId', sourceId);
    if (range && range !== 'all_time') params.append('range', range);
    const queryString = params.toString();
    const response = await api.get(`/expense/stats/analytics${queryString ? `?${queryString}` : ''}`);
    return response.data;
  }
};

export const getMonthlyStats = async (sourceId?: string | null, range = 'all_time') => {
  const isGuest = useAuthStore.getState().isGuest;
  
  if (isGuest) {
    // Use local SQLite for guest users
    return await guestExpenseService.getLocalMonthlyStats(sourceId, range);
  } else {
    // Use API for logged-in users
    const params = new URLSearchParams();
    if (sourceId) params.append('sourceId', sourceId);
    if (range && range !== 'all_time') params.append('range', range);
    const queryString = params.toString();
    const response = await api.get(`/expense/stats/monthly${queryString ? '?' + queryString : ''}`);
    return response.data;
  }
};

export const addAccount = async (account: {
  name: string;
  type: AccountSource['type'];
  openingBalance?: number;
}): Promise<AccountSource | null> => {
  const isGuest = useAuthStore.getState().isGuest;
  
  if (isGuest) {
    // Use local SQLite for guest users
    const result = await guestExpenseService.addLocalAccount({
      name: account.name,
      type: account.type,
      balance: account.openingBalance || 0,
    });
    const now = new Date().toISOString();
    return {
      _id: result.id.toString(),
      userId: '',
      name: account.name,
      normalizedName: account.name.toLowerCase().replace(/\s+/g, ' '),
      type: account.type,
      openingBalance: account.openingBalance || 0,
      currentBalance: account.openingBalance || 0,
      isDefault: false,
      isSystem: false,
      createdAt: now,
      updatedAt: now,
      transactionCount: 0,
      lastUsed: null,
    };
  } else {
    // Use API for logged-in users
    return await createAccountApi(account);
  }
};

export const getAccounts = async (): Promise<AccountSource[]> => {
  const isGuest = useAuthStore.getState().isGuest;
  
  if (isGuest) {
    // Use local SQLite for guest users
    const fetched = await guestExpenseService.getLocalAccounts();
    return fetched.map(acc => ({
      _id: acc.id?.toString() || '',
      userId: '',
      name: acc.name,
      normalizedName: acc.name.toLowerCase().replace(/\s+/g, ' '),
      type: acc.type,
      openingBalance: acc.balance,
      currentBalance: acc.balance,
      isDefault: false,
      isSystem: false,
      createdAt: acc.createdAt,
      updatedAt: acc.updatedAt,
      transactionCount: 0,
      lastUsed: null,
    }));
  } else {
    // Use API for logged-in users
    return await fetchAccountsApi();
  }
};

export const updateAccount = async (
  id: string,
  account: { name?: string; type?: AccountSource['type'] }
): Promise<AccountSource | null> => {
  const isGuest = useAuthStore.getState().isGuest;
  
  if (isGuest) {
    // Use local SQLite for guest users
    await guestExpenseService.updateLocalAccount(parseInt(id), {
      name: account.name,
      type: account.type,
    });
    const existing = useAccountStore.getState().accounts.find(a => a._id === id);
    if (!existing) return null;
    return {
      ...existing,
      name: account.name ?? existing.name,
      normalizedName: (account.name ?? existing.name).toLowerCase().replace(/\s+/g, ' '),
      type: account.type ?? existing.type,
      updatedAt: new Date().toISOString(),
    };
  } else {
    // Use API for logged-in users
    return await updateAccountApi(id, account);
  }
};

export const setDefaultAccount = async (id: string): Promise<AccountSource | null> => {
  const isGuest = useAuthStore.getState().isGuest;

  if (isGuest) {
    const existing = useAccountStore.getState().accounts.find(a => a._id === id);
    return existing ? { ...existing, isDefault: true } : null;
  } else {
    return await setDefaultAccountApi(id);
  }
};

export const deleteAccount = async (
  id: string,
  transferToAccountId?: string
): Promise<{ success: boolean; message?: string }> => {
  const isGuest = useAuthStore.getState().isGuest;
  
  if (isGuest) {
    // Use local SQLite for guest users
    try {
      await guestExpenseService.deleteLocalAccount(parseInt(id), transferToAccountId);
      return { success: true, message: 'Account deleted' };
    } catch (error: any) {
      return { success: false, message: error?.message || 'Failed to delete account' };
    }
  } else {
    // Use API for logged-in users
    return await deleteAccountApi(id, transferToAccountId || '');
  }
};