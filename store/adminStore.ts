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
    isSynced: string | null;
};
type User = {
    _id: string;
    netBalance: number;
    name: string;
    createdAt: string;
    expenses: Transaction[];
};

type AdminStore = {
    cachedUsers: User[];
    activeUser: User | null;
    totalUserBalance: number;
    LastSyncedAt: string;
    setActiveUser: (user: User | null) => void;
    updateUserFromServer: (user: Omit<User, 'expenses'> & { expenses?: Transaction[] }) => void;
    addUser: (data: User) => void;
    setCachedUsers: (data: User[], balance: number) => void;
    assignBalance: (id: string, expense: Transaction) => void;
    deleteUser: (data: User) => void;
    editUserExpenseByAdmin: (id: string, data: Transaction) => void;
    removeUserExpenseByAdmin: (id: string, data: Transaction) => void;
    markAsSyncedAdmin: (tempId: string, newIdFromBackend: string, userId: String) => void;
    statsCache: Record<string, any>;
    setStatsCache: (userId: string, data: any) => void;
    reset: () => void;
};

export const useAdminStore = create<AdminStore>()(
    persist(
        (set) => ({
            cachedUsers: [],
            activeUser: null,
            totalUserBalance: 0,
            LastSyncedAt: new Date(Date.now()).toLocaleString(),
            setActiveUser: (user) => set({ activeUser: user }),
            updateUserFromServer: (user) =>
                set((state) => {
                    const existing = state.cachedUsers.find((u) => u._id === user._id) || null;
                    const activeMatch = state.activeUser?._id === user._id;
                    const prevBalance = existing?.netBalance ?? (activeMatch ? state.activeUser!.netBalance : 0);
                    const nextBalance = user.netBalance;
                    const diff = nextBalance - prevBalance;

                    return {
                        ...state,
                        activeUser: state.activeUser?._id === user._id
                            ? {
                                ...state.activeUser,
                                ...user,
                                expenses: user.expenses ?? state.activeUser.expenses,
                            }
                            : state.activeUser,
                        cachedUsers: state.cachedUsers.map((u) =>
                            u._id === user._id
                                ? {
                                    ...u,
                                    ...user,
                                    expenses: user.expenses ?? u.expenses,
                                }
                                : u
                        ),
                        totalUserBalance: state.totalUserBalance + ((existing || activeMatch) ? diff : 0),
                    };
                }),
            setCachedUsers: (data: User[], balance) => set((state) => ({
                cachedUsers: data.slice(0, 5).map(user => ({
                    ...user,
                    expenses: (user.expenses || []).slice(0, 10)
                })),
                totalUserBalance: balance,
                LastSyncedAt: new Date(Date.now()).toLocaleString()
            })),
            addUser: (data) =>
                set((state) => {
                    const normalized = { ...data, expenses: (data.expenses || []) };
                    const updatedUsers = [normalized, ...state.cachedUsers].sort(
                        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                    ).slice(0, 5);
                    return {
                        ...state,
                        cachedUsers: updatedUsers,
                        totalUserBalance: state.totalUserBalance + data.netBalance
                    }
                }),
            assignBalance: (id, expense) =>
                set((state) => ({
                    ...state,
                    activeUser: state.activeUser?._id === id ? {
                        ...state.activeUser,
                        netBalance: (state.activeUser.netBalance + expense.amount),
                        expenses: [expense, ...state.activeUser.expenses]
                    } : state.activeUser,
                    cachedUsers: state.cachedUsers.map((item) => (
                        item._id === id ? {
                            ...item,
                            netBalance: (item.netBalance + expense.amount),
                            expenses: [expense, ...item.expenses].slice(0, 10)
                        } : item
                    )),
                    totalUserBalance: state.totalUserBalance + expense.amount
                })),
            deleteUser: (data) =>
                set((state) => ({
                    ...state,
                    cachedUsers: state.cachedUsers.filter((item) => item._id !== data._id),
                    totalUserBalance: state.totalUserBalance - data.netBalance
                })),
            editUserExpenseByAdmin: (id, data) => set((state) => {
                let diffAmount = 0
                return {
                    ...state,
                    activeUser: state.activeUser?._id === id ? {
                        ...state.activeUser,
                        expenses: state.activeUser.expenses.map((it) => {
                            if (it._id === data._id) {
                                diffAmount = data.amount - it.amount; // Note: this calculates diff for activeUser separately, but logic is same
                                return { ...data }
                            }
                            return it
                        }),
                        netBalance: state.activeUser.netBalance + (data.amount - (state.activeUser.expenses.find(e => e._id === data._id)?.amount || 0))
                    } : state.activeUser,
                    cachedUsers: state.cachedUsers.map((item) => {
                        if (item._id === id) {
                            return {
                                ...item, expenses: item.expenses.map((it) => {
                                    if (it._id === data._id) {
                                        diffAmount = data.amount - it.amount;
                                        return { ...data }
                                    }
                                    return it
                                }), netBalance: item.netBalance + diffAmount
                            }
                        }
                        return item
                    }),
                    totalUserBalance: state.totalUserBalance + diffAmount
                }
            }),
            removeUserExpenseByAdmin: (id, data) => set((state) => {
                let diffAmount = 0
                return {
                    ...state,
                    activeUser: state.activeUser?._id === id ? {
                        ...state.activeUser,
                        expenses: state.activeUser.expenses.filter((it) => it._id !== data._id),
                        netBalance: state.activeUser.netBalance - data.amount
                    } : state.activeUser,
                    cachedUsers: state.cachedUsers.map((item) => {
                        if (item._id === id) {
                            return {
                                ...item, expenses: item.expenses.filter((it) => {
                                    if (it._id === data._id) {
                                        diffAmount = data.amount
                                        return false
                                    }
                                    return true
                                }), netBalance: item.netBalance - diffAmount
                            }
                        }
                        return item
                    }),
                    totalUserBalance: state.totalUserBalance - diffAmount
                }
            }),
            markAsSyncedAdmin: (tempId, newIdFromBackend, userId) => set((state) => {
                return {
                    ...state,
                    activeUser: state.activeUser?._id === userId ? {
                        ...state.activeUser,
                        expenses: state.activeUser.expenses.map((e) =>
                            e._id === tempId
                                ? { ...e, _id: newIdFromBackend, isSynced: 'true' }
                                : e)
                    } : state.activeUser,
                    cachedUsers: state.cachedUsers.map((item) => {
                        if (item._id === userId) {
                            return {
                                ...item, expenses: item.expenses.map((e) =>
                                    e._id === tempId
                                        ? { ...e, _id: newIdFromBackend, isSynced: 'true' }
                                        : e)
                            }
                        }
                        return item
                    }),
                }
            }),
            statsCache: {},
            setStatsCache: (userId, data) => set((state) => ({
                statsCache: { ...state.statsCache, [userId]: data }
            })),
            reset: () =>
                set(() => ({
                    cachedUsers: [],
                    activeUser: null,
                    totalUserBalance: 0,
                    LastSyncedAt: new Date(Date.now()).toLocaleString(),
                    statsCache: {},
                })),
        }),
        {
            name: 'admin-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
