import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Transaction = {
  _id: string;
  amount: number;
  date: string;
  details: string;
  type: string;
  category: string;
  isSynced: string | null
};

type ExpenseStore = {
  cachedExpenses: Transaction[];
  totalBalance: number;
  LastSyncedAt: string;
  addExpense: (data: Transaction) => void;
  editExpense: (data: Transaction) => void;
  removeExpense: (data: Transaction) => void;
  setCachedExpenses: (data: Transaction[], balance: number) => void;
  markAsSynced: (id: string, newIdFromBackend: string) => void;
  cachedStats: any;
  setCachedStats: (data: any) => void;
  reset: () => void;
};

export const useExpenseStore = create<ExpenseStore>()(
  persist(
    (set) => ({
      cachedExpenses: [],
      totalBalance: 0,
      LastSyncedAt: new Date(Date.now()).toLocaleString(),
      addExpense: (data) =>
        set((state) => {
          return {
            ...state,
            cachedExpenses: [data, ...state.cachedExpenses].sort(
              (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
            ),
            totalBalance: data.type == 'debit' ? state.totalBalance - data.amount : state.totalBalance + data.amount,
          }
        }),
      editExpense: (data) =>
        set((state) => {
          let diffAmount = 0
          return {
            ...state,
            cachedExpenses: state.cachedExpenses.map((item) => {
              if (item._id === data._id) {
                // Correctly calculate total balance based on type
                if (item.type === 'debit') {
                  diffAmount = item.amount - data.amount
                } else {
                  diffAmount = data.amount - item.amount
                }
                return { ...data }
              }
              return item
            }),
            totalBalance: state.totalBalance + diffAmount
          }
        }),
      removeExpense: (data) =>
        set((state) => {
          // find the item to remove
          const itemToRemove = state.cachedExpenses.find((item) => item._id === data._id);

          if (!itemToRemove) return state; // nothing to remove

          const updatedExpenses = state.cachedExpenses.filter(
            (item) => item._id !== data._id
          );

          const updatedBalance =
            itemToRemove.type === "debit"
              ? state.totalBalance + itemToRemove.amount
              : state.totalBalance - itemToRemove.amount;

          return {
            ...state,
            cachedExpenses: updatedExpenses,
            totalBalance: updatedBalance,
          };
        }),
      setCachedExpenses: (data, balance) => set((state) => {
        return {
          cachedExpenses: data,
          LastSyncedAt: new Date(Date.now()).toLocaleString(),
          totalBalance: balance
        }
      }),
      markAsSynced: (tempId, newIdFromBackend) =>
        set((state) => ({
          cachedExpenses: state.cachedExpenses.map((e) =>
            e._id === tempId
              ? { ...e, _id: newIdFromBackend, isSynced: 'true' }
              : e
          ),
        })),
      cachedStats: { labels: [], datasets: [] },
      setCachedStats: (data) => set({ cachedStats: data }),
      reset: () =>
        set(() => ({
          cachedExpenses: [],
          totalBalance: 0,
          LastSyncedAt: new Date(Date.now()).toLocaleString(),
          cachedStats: { labels: [], datasets: [] },
        })),
    }),
    {
      name: 'expense-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
