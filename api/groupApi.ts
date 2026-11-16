import api from './api';
import type {
  ActivityItem, EmailLookupUser, GroupInvitation, Group, GroupExpense, GroupExpenseInput, GroupSettlement, InvitePreview, SettlePlan, SettlementInput,
} from '@/types/group';

// Most group changes need the server's answer right away (invite codes, who claimed
// what, balances), so they are not queued for offline sync. Adding an expense is the
// exception: see addGroupExpenseApi.
const ONLINE_ONLY = { headers: { 'x-online-only': '1' } };

type ApiResult<T> = { ok: true; data: T } | { ok: false; message: string; status?: number };

const toError = (error: any, fallback: string): { ok: false; message: string; status?: number } => {
  const status = error?.response?.status;
  if (!error?.response) return { ok: false, message: "You're offline. Connect to the internet and try again." };
  return { ok: false, status, message: error.response.data?.message || fallback };
};

const run = async <T>(request: () => Promise<T>, fallback: string): Promise<ApiResult<T>> => {
  try {
    return { ok: true, data: await request() };
  } catch (error) {
    return toError(error, fallback);
  }
};

export const fetchGroupsApi = () =>
  run(async () => (await api.get('/group')).data.groups as Group[], 'Failed to load groups');

export const fetchGroupApi = (id: string) =>
  run(async () => (await api.get(`/group/${id}`)).data.group as Group, 'Failed to load group');

// Exact match only. Sent in the body so the email never appears in a URL.
export const lookupEmailApi = (email: string) =>
  run(async () => (await api.post('/group/lookup-email', { email }, ONLINE_ONLY)).data.user as EmailLookupUser, 'Could not look up that email');

export const addGroupMemberByEmailApi = (id: string, email: string) =>
  run(async () => (await api.post(`/group/${id}/members`, { email }, ONLINE_ONLY)).data.group as Group, 'Failed to invite');

export const fetchInvitationsApi = () =>
  run(async () => (await api.get('/group/invitations')).data.invitations as GroupInvitation[], 'Failed to load invitations');

export const respondToInvitationApi = (id: string, accept: boolean) =>
  run(
    async () => (await api.post(`/group/${id}/invitation`, { accept }, ONLINE_ONLY)).data as { group?: Group; declined?: boolean },
    'Failed to respond'
  );

export const createGroupApi = (body: { name: string; currencySymbol: string; memberNames: string[]; memberEmails: string[]; clientId: string }) =>
  run(async () => (await api.post('/group', body, ONLINE_ONLY)).data.group as Group, 'Failed to create group');

export const updateGroupApi = (id: string, body: { name?: string; currencySymbol?: string; simplifyDebts?: boolean }) =>
  run(async () => (await api.patch(`/group/${id}`, body, ONLINE_ONLY)).data.group as Group, 'Failed to update group');

export const addGroupMemberApi = (id: string, name: string) =>
  run(async () => (await api.post(`/group/${id}/members`, { name }, ONLINE_ONLY)).data.group as Group, 'Failed to add member');

export const removeGroupMemberApi = (id: string, memberId: string) =>
  run(async () => (await api.delete(`/group/${id}/members/${memberId}`, ONLINE_ONLY)).data.group as Group, 'Failed to remove member');

export const setGroupNotificationsApi = (id: string, notify: boolean) =>
  run(async () => (await api.patch(`/group/${id}/notifications`, { notify }, ONLINE_ONLY)).data.group as Group, 'Failed to save notification setting');

export const rotateInviteApi = (id: string) =>
  run(async () => (await api.post(`/group/${id}/invite/rotate`, {}, ONLINE_ONLY)).data.group as Group, 'Failed to reset invite link');

export const leaveGroupApi = (id: string) =>
  run(async () => (await api.post(`/group/${id}/leave`, {}, ONLINE_ONLY)).data as { deleted: boolean }, 'Failed to leave group');

export const previewInviteApi = (code: string) =>
  run(async () => (await api.get(`/group/invite/${code}`)).data.invite as InvitePreview, 'This invite link is not valid anymore');

// Adding works offline: the request is queued (with its clientId) and the
// server ignores the retry if the first one already got through.
export const addGroupExpenseApi = (id: string, body: GroupExpenseInput) =>
  run(async () => {
    const res = await api.post(`/group/${id}/expenses`, body);
    if (res.data?.offline) return { offline: true as const };
    return { offline: false as const, expense: res.data.expense as GroupExpense, group: res.data.group as Group };
  }, 'Failed to add expense');

export const updateGroupExpenseApi = (id: string, expenseId: string, body: GroupExpenseInput) =>
  run(
    async () => (await api.patch(`/group/${id}/expenses/${expenseId}`, body, ONLINE_ONLY)).data as { expense: GroupExpense; group: Group },
    'Failed to update expense'
  );

export const deleteGroupExpenseApi = (id: string, expenseId: string) =>
  run(
    async () => (await api.delete(`/group/${id}/expenses/${expenseId}`, ONLINE_ONLY)).data.group as Group,
    'Failed to delete expense'
  );

export const fetchActivityApi = (id: string, offset = 0, limit = 20) =>
  run(
    async () => (await api.get(`/group/${id}/activity`, { params: { offset, limit } })).data as { items: ActivityItem[]; hasMore: boolean },
    'Failed to load activity'
  );

export const fetchSettlePlanApi = (id: string) =>
  run(async () => (await api.get(`/group/${id}/settle-plan`)).data.plan as SettlePlan, 'Failed to work out settlements');

// Online only: rounding and smart-settle checks need the latest balances
export const addSettlementApi = (id: string, body: SettlementInput) =>
  run(
    async () => (await api.post(`/group/${id}/settlements`, body, ONLINE_ONLY)).data as { settlement: GroupSettlement; group: Group },
    'Failed to record payment'
  );

export const deleteSettlementApi = (id: string, settlementId: string) =>
  run(
    async () => (await api.delete(`/group/${id}/settlements/${settlementId}`, ONLINE_ONLY)).data.group as Group,
    'Failed to delete payment'
  );

export const joinGroupApi = (code: string, claimMemberId?: string) =>
  run(async () => (await api.post('/group/join', { code, claimMemberId }, ONLINE_ONLY)).data.group as Group, 'Failed to join group');
