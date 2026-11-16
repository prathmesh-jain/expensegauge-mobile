import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ActivityItem, Group, GroupExpense } from '@/types/group';

type GroupStore = {
  // Last fetched groups, so the tab shows something offline
  groups: Group[];
  // Loaded pages of each group's activity (expenses and payments), for offline viewing
  activityByGroup: Record<string, ActivityItem[]>;
  // Shared expenses saved offline, waiting in the sync queue (matched by clientId)
  pendingExpenses: Record<string, GroupExpense[]>;
  // Invite opened before sign-in (or before the tabs mounted); handled once signed in
  pendingInviteCode: string | null;
  // Bumped when group activity changed your personal expenses, so Home refetches
  personalLedgerVersion: number;
  // Per group: the server's lastActivityAt when you last looked at it
  lastSeen: Record<string, string>;
  // Invitations waiting for you (counted in the tab badge)
  invitationCount: number;
  // Account-wide group notifications switch (Preferences); off mutes every group
  notificationsOn: boolean;
  setNotificationsOn: (on: boolean) => void;
  setGroups: (groups: Group[]) => void;
  markSeen: (groupId: string, lastActivityAt: string) => void;
  setInvitationCount: (count: number) => void;
  upsertGroup: (group: Group) => void;
  removeGroup: (id: string) => void;
  setActivity: (groupId: string, items: ActivityItem[], queuedClientIds?: Set<string>) => void;
  addPendingExpense: (groupId: string, expense: GroupExpense) => void;
  setPendingInviteCode: (code: string | null) => void;
  bumpPersonalLedger: () => void;
  reset: () => void;
};

export const useGroupStore = create<GroupStore>()(
  persist(
    (set) => ({
      groups: [],
      activityByGroup: {},
      pendingExpenses: {},
      pendingInviteCode: null,
      personalLedgerVersion: 0,
      lastSeen: {},
      invitationCount: 0,
      notificationsOn: true,
      setNotificationsOn: (notificationsOn) => set({ notificationsOn }),
      // Groups seen for the first time start as "seen", so a new install or a
      // fresh sign-in doesn't flag every group at once
      setGroups: (groups) =>
        set((state) => {
          const lastSeen = { ...state.lastSeen };
          for (const g of groups) {
            if (!lastSeen[g._id] && g.lastActivityAt) lastSeen[g._id] = g.lastActivityAt;
          }
          return { groups, lastSeen };
        }),
      markSeen: (groupId, lastActivityAt) =>
        set((state) =>
          state.lastSeen[groupId] && state.lastSeen[groupId] >= lastActivityAt
            ? state
            : { lastSeen: { ...state.lastSeen, [groupId]: lastActivityAt } }),
      setInvitationCount: (invitationCount) => set({ invitationCount }),
      upsertGroup: (group) =>
        set((state) => {
          const others = state.groups.filter((g) => g._id !== group._id);
          return { groups: [group, ...others] };
        }),
      removeGroup: (id) =>
        set((state) => {
          const { [id]: _activity, ...activityByGroup } = state.activityByGroup;
          const { [id]: _pending, ...pendingExpenses } = state.pendingExpenses;
          return { groups: state.groups.filter((g) => g._id !== id), activityByGroup, pendingExpenses };
        }),
      // Also drops pending expenses the server now has, or that left the sync queue
      setActivity: (groupId, items, queuedClientIds) =>
        set((state) => {
          const synced = new Set(items.map((e) => e.clientId).filter(Boolean));
          const stillPending = (state.pendingExpenses[groupId] || []).filter(
            (e) => !synced.has(e.clientId) && (!queuedClientIds || queuedClientIds.has(e.clientId ?? ''))
          );
          return {
            activityByGroup: { ...state.activityByGroup, [groupId]: items },
            pendingExpenses: { ...state.pendingExpenses, [groupId]: stillPending },
          };
        }),
      addPendingExpense: (groupId, expense) =>
        set((state) => ({
          pendingExpenses: {
            ...state.pendingExpenses,
            [groupId]: [expense, ...(state.pendingExpenses[groupId] || [])],
          },
        })),
      setPendingInviteCode: (pendingInviteCode) => set({ pendingInviteCode }),
      bumpPersonalLedger: () => set((state) => ({ personalLedgerVersion: state.personalLedgerVersion + 1 })),
      // Keeps a pending invite so it survives logging out and in as someone else
      reset: () => set({ groups: [], activityByGroup: {}, pendingExpenses: {}, lastSeen: {}, invitationCount: 0, notificationsOn: true }),
    }),
    {
      name: 'group-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// New activity from someone else since you last opened the group
export const hasUnseenActivity = (group: Group, lastSeen: Record<string, string>) =>
  !group.lastActivityByYou && !!group.lastActivityAt && !!lastSeen[group._id] && group.lastActivityAt > lastSeen[group._id];
