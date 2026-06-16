// accountApi.ts
import api from './api';
import { AccountSource } from '@/store/accountStore';

export const fetchAccountsApi = async (): Promise<AccountSource[]> => {
  try {
    const res = await api.get('/account/');
    return res.data.accounts as AccountSource[];
  } catch (error) {
    console.error('Error fetching accounts:', error);
    return [];
  }
};

export const createAccountApi = async (data: {
  name: string;
  type: AccountSource['type'];
  openingBalance?: number;
}): Promise<AccountSource | null> => {
  try {
    const res = await api.post('/account/', data);
    return res.data.account as AccountSource;
  } catch (error) {
    console.error('Error creating account:', error);
    return null;
  }
};

export const updateAccountApi = async (
  id: string,
  data: { name?: string; type?: AccountSource['type'] }
): Promise<AccountSource | null> => {
  try {
    const res = await api.patch(`/account/${id}`, data);
    return res.data.account as AccountSource;
  } catch (error) {
    console.error('Error updating account:', error);
    return null;
  }
};

export const setDefaultAccountApi = async (id: string): Promise<AccountSource | null> => {
  try {
    const res = await api.patch(`/account/${id}/set-default`, {});
    return res.data.account as AccountSource;
  } catch (error) {
    console.error('Error setting default account:', error);
    return null;
  }
};

export const deleteAccountApi = async (id: string, transferToAccountId: string): Promise<{ success: boolean; message?: string }> => {
  try {
    const res = await api.delete(`/account/${id}`, { data: { transferToAccountId } });
    return { success: true, message: res.data.message };
  } catch (error: any) {
    console.error('Error deleting account:', error?.response?.data?.message || error);
    return { success: false, message: error?.response?.data?.message || 'Failed to delete account' };
  }
};
