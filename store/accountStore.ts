// accountStore.ts
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type AccountSource = {
  _id: string;
  userId: string;
  name: string;
  normalizedName: string;
  type: 'bank' | 'cash' | 'wallet' | 'credit_card' | 'business';
  openingBalance: number;
  currentBalance: number;
  isDefault: boolean;
  isSystem?: boolean; // System accounts (Primary Account) cannot be edited/deleted
  createdAt: string;
  updatedAt?: string;
  transactionCount: number;
  lastUsed: string | null;
};

type AccountStore = {
  accounts: AccountSource[];
  selectedAccountId: string | null; // null = "All Accounts"
  setAccounts: (accounts: AccountSource[]) => void;
  addAccount: (account: AccountSource) => void;
  updateAccount: (account: AccountSource) => void;
  removeAccount: (id: string) => void;
  setSelectedAccountId: (id: string | null) => void;
  setDefaultAccount: (id: string) => void;
  getDefaultAccount: () => AccountSource | undefined;
  reset: () => void;
};

export const useAccountStore = create<AccountStore>()(
  persist(
    (set, get) => ({
      accounts: [],
      selectedAccountId: null,

      setAccounts: (accounts) => set({ accounts }),

      addAccount: (account) =>
        set((state) => ({ accounts: [...state.accounts, account] })),

      updateAccount: (account) =>
        set((state) => ({
          accounts: state.accounts.map((a) => (a._id === account._id ? account : a)),
        })),

      removeAccount: (id) =>
        set((state) => ({
          accounts: state.accounts.filter((a) => a._id !== id),
          selectedAccountId: state.selectedAccountId === id ? null : state.selectedAccountId,
        })),

      setSelectedAccountId: (id) => set({ selectedAccountId: id }),

      setDefaultAccount: (id) =>
        set((state) => ({
          accounts: state.accounts.map((a) => ({ ...a, isDefault: a._id === id })),
        })),

      getDefaultAccount: () => get().accounts.find((a) => a.isDefault),

      reset: () => set({ accounts: [], selectedAccountId: null }),
    }),
    {
      name: 'account-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
