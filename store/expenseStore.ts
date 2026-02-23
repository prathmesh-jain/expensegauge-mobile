//expensestore.ts
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
  isSynced: boolean;
  clientId?: string;
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
          const newTransaction = {
            ...data,
            isSynced: false,
            clientId: data.clientId || data._id // Ensure clientId is set
          };
          return {
            ...state,
            cachedExpenses: [newTransaction, ...state.cachedExpenses].sort(
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
        // Data Reconciliation: Preserve local unsynced transactions
        const unsyncedLocal = state.cachedExpenses.filter(e => e.isSynced === false);

        // Deduplication using clientId and _id
        const merged = [...data];

        unsyncedLocal.forEach(localItem => {
          // Find if this local item matches an existing item in the incoming data
          const index = merged.findIndex(m =>
            m._id === localItem._id ||
            (localItem.clientId && m.clientId === localItem.clientId)
          );

          if (index !== -1) {
            // Version Check:
            // If the backend has the same clientId, then backend record is up-to-date.
            // If clientIds differ, local version is a newer pending edit.
            if (localItem.clientId && merged[index].clientId === localItem.clientId) {
              // Same version found in backend; discard local unsynced copy 
              // (Keep the backend's synced item in merged)
            } else {
              // Backend is stale or ID matches but version is different; keep local unsynced version
              merged[index] = localItem;
            }
          } else {
            merged.push(localItem);
          }
        });

        const sorted = merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return {
          cachedExpenses: sorted,
          LastSyncedAt: new Date(Date.now()).toLocaleString(),
          totalBalance: balance
        }
      }),


      markAsSynced: (tempId, newIdFromBackend) =>
        set((state) => {
          // Deduplication: Check if an item with newIdFromBackend already exists (excluding the tempId item itself)
          const alreadyExists = state.cachedExpenses.some((e) => e._id === newIdFromBackend && e._id !== tempId);


          if (alreadyExists) {
            return {
              cachedExpenses: state.cachedExpenses.filter((e) => e._id !== tempId),
            };
          }

          return {
            cachedExpenses: state.cachedExpenses.map((e) =>
              e._id === tempId ? { ...e, _id: newIdFromBackend, isSynced: true } : e
            ),
          };
        }),


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
