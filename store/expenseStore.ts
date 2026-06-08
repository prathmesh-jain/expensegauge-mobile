//expensestore.ts
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Transaction } from '@/types';


const getSignedAmount = (item: Transaction) =>
  item.type === 'debit' ? -item.amount : item.amount;

const getTime = (value?: string) => {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
};

const compareExpensesNewestFirst = (
  a: { date: string; createdAt?: string },
  b: { date: string; createdAt?: string }
) => {
  const dateDiff = getTime(b.date) - getTime(a.date);
  if (dateDiff !== 0) return dateDiff;
  return getTime(b.createdAt) - getTime(a.createdAt);
};

export const sortExpensesNewestFirst = <T extends { date: string; createdAt?: string }>(expenses: T[]) =>
  [...expenses].sort(compareExpensesNewestFirst);

const insertExpenseNewestFirst = <T extends { date: string; createdAt?: string }>(expenses: T[], expense: T) => {
  const insertAt = expenses.findIndex((item) => compareExpensesNewestFirst(expense, item) < 0);
  if (insertAt === -1) return [...expenses, expense];
  return [...expenses.slice(0, insertAt), expense, ...expenses.slice(insertAt)];
};

export const isExpenseInRange = (date: string, range: string) => {
  if (range === 'all_time') return true;

  const expenseDate = new Date(date);
  if (Number.isNaN(expenseDate.getTime())) return false;

  const now = new Date();
  const currentDayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const nextDayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  if (range === 'current_day') {
    return expenseDate >= currentDayStart && expenseDate < nextDayStart;
  }
  if (range === 'current_month') {
    return expenseDate >= currentMonthStart && expenseDate < nextMonthStart;
  }
  if (range === 'last_month') {
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return expenseDate >= lastMonthStart && expenseDate < currentMonthStart;
  }
  if (range === 'last_3_months') {
    const lastThreeMonthsStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    return expenseDate >= lastThreeMonthsStart && expenseDate < nextMonthStart;
  }

  return true;
};


type ExpenseStore = {
  cachedExpenses: Transaction[];
  totalBalance: number;
  selectedRange: string;
  LastSyncedAt: string;
  addExpense: (data: Transaction) => void;
  editExpense: (data: Transaction) => void;
  removeExpense: (data: Transaction) => void;
  setCachedExpenses: (data: Transaction[], balance: number, balanceRange?: string) => void;
  setSelectedRange: (range: string) => void;
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
      selectedRange: 'all_time',
      LastSyncedAt: new Date(Date.now()).toLocaleString(),
      addExpense: (data) =>
        set((state) => {
          const newTransaction = {
            ...data,
            isSynced: false,
            createdAt: data.createdAt || new Date().toISOString(),
            clientId: data.clientId || data._id // Ensure clientId is set
          };
          const inSelectedRange = isExpenseInRange(newTransaction.date, state.selectedRange);
          return {
            ...state,
            cachedExpenses: insertExpenseNewestFirst(state.cachedExpenses, newTransaction),
            totalBalance: inSelectedRange
              ? state.totalBalance + getSignedAmount(newTransaction)
              : state.totalBalance,
          }
        }),

      editExpense: (data) =>
        set((state) => {
          const existing = state.cachedExpenses.find((item) => item._id === data._id);
          if (!existing) return state;

          const oldInRange = isExpenseInRange(existing.date, state.selectedRange);
          const newInRange = isExpenseInRange(data.date, state.selectedRange);

          let nextBalance = state.totalBalance;
          if (oldInRange) nextBalance -= getSignedAmount(existing);
          if (newInRange) nextBalance += getSignedAmount(data);

          return {
            ...state,
            cachedExpenses: sortExpensesNewestFirst(state.cachedExpenses.map((item) => {
              if (item._id === data._id) {
                return { ...data }
              }
              return item
            })),
            totalBalance: nextBalance
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
            isExpenseInRange(itemToRemove.date, state.selectedRange)
              ? state.totalBalance - getSignedAmount(itemToRemove)
              : state.totalBalance;

          return {
            ...state,
            cachedExpenses: updatedExpenses,
            totalBalance: updatedBalance,
          };
        }),
      setCachedExpenses: (data, balance, balanceRange) => set((state) => {
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

        const sorted = sortExpensesNewestFirst(merged);
        const incomingIds = new Set(data.map((item) => item._id));
        const incomingClientIds = new Set(data.map((item) => item.clientId).filter(Boolean));
        const effectiveBalanceRange = balanceRange ?? state.selectedRange;
        const shouldUpdateBalance = effectiveBalanceRange === state.selectedRange;
        const pendingBalanceDelta = unsyncedLocal.reduce((sum, localItem) => {
          const alreadyIncluded =
            incomingIds.has(localItem._id) ||
            (localItem.clientId && incomingClientIds.has(localItem.clientId));

          if (alreadyIncluded || !isExpenseInRange(localItem.date, effectiveBalanceRange)) {
            return sum;
          }

          return sum + getSignedAmount(localItem);
        }, 0);

        return {
          cachedExpenses: sorted,
          LastSyncedAt: new Date(Date.now()).toLocaleString(),
          totalBalance: shouldUpdateBalance
            ? balance + pendingBalanceDelta
            : state.totalBalance
        }
      }),
      setSelectedRange: (range) => set({ selectedRange: range }),


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
          selectedRange: 'all_time',
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
