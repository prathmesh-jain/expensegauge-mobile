import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Modal, RefreshControl, ScrollView, Share, Switch, Text, TextInput, TouchableOpacity, View, useColorScheme
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Toast } from 'toastify-react-native';
import { useGroupStore } from '@/store/groupStore';
import {
  addGroupMemberApi,
  addGroupMemberByEmailApi,
  deleteSettlementApi,
  lookupEmailApi,
  fetchActivityApi,
  fetchGroupApi,
  leaveGroupApi,
  removeGroupMemberApi,
  rotateInviteApi,
  updateGroupApi,
} from '@/api/groupApi';
import SettleRoute from '@/components/SettleRoute';
import { getQueue } from '@/store/offlineQueue';
import {
  expenseImpact, formatMoney, memberBalanceLabel, memberName, myBalanceLabel, paymentMethodLabel, TONE_TEXT,
} from '@/helper/groupFormat';
import { cleanName, inviteLink, looksLikeEmail, MAX_GROUP_NAME_LENGTH } from '@/helper/groupLimits';
import { useKeyboardHeight } from '@/helper/useKeyboardHeight';
import InitialsAvatar from '@/components/InitialsAvatar';
import ConfirmModal from '@/components/ConfirmModal';
import { setGroupNotifications } from '@/helper/pushService';
import type { ActivityItem, Group, GroupExpense, GroupMember, GroupSettlement } from '@/types/group';

const PAGE_SIZE = 20;
const EMPTY_ACTIVITY: ActivityItem[] = [];
const EMPTY_PENDING: GroupExpense[] = [];


const roundOffText = (s: GroupSettlement, group: Group) => {
  if (s.roundOff === 0) return null;
  const who = memberName(group, s.roundOff > 0 ? s.fromMemberId : s.toMemberId);
  return `${formatMoney(Math.abs(s.roundOff), group.currencySymbol)} rounded off by ${who}`;
};

const formatShortDate = (value: string) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

// clientIds of shared expenses still waiting in the offline queue
const queuedClientIds = async () => {
  const queue = await getQueue();
  return new Set(
    queue.filter((r) => /\/group\/[^/]+\/expenses$/.test(r.url) && r.data?.clientId).map((r) => String(r.data.clientId))
  );
};

type Confirm =
  | { kind: 'remove'; member: GroupMember }
  | { kind: 'rotate' }
  | { kind: 'leave' };

export default function GroupDetailScreen() {
  const { id, created } = useLocalSearchParams<{ id: string; created?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';
  const keyboardHeight = useKeyboardHeight();
  const sheetPaddingBottom = keyboardHeight > 0 ? 24 : insets.bottom + 24;

  const group = useGroupStore((state) => state.groups.find((g) => g._id === id));
  const upsertGroup = useGroupStore((state) => state.upsertGroup);
  const removeGroup = useGroupStore((state) => state.removeGroup);
  const activity = useGroupStore((state) => (id ? state.activityByGroup[id] : undefined) ?? EMPTY_ACTIVITY);
  const pendingExpenses = useGroupStore((state) => (id ? state.pendingExpenses[id] : undefined) ?? EMPTY_PENDING);
  const setActivity = useGroupStore((state) => state.setActivity);
  const bumpPersonalLedger = useGroupStore((state) => state.bumpPersonalLedger);

  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<GroupExpense | null>(null);
  const [selectedSettlement, setSelectedSettlement] = useState<GroupSettlement | null>(null);
  const [confirmDeletePayment, setConfirmDeletePayment] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const notificationsOn = useGroupStore((state) => state.notificationsOn);
  const [savingNotify, setSavingNotify] = useState(false);
  const [foundUser, setFoundUser] = useState<{ email: string; name: string; maskedEmail: string } | null>(null);
  const [notFoundEmail, setNotFoundEmail] = useState<string | null>(null);
  const [newMemberName, setNewMemberName] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  const applyGroup = useCallback((next: Group) => upsertGroup(next), [upsertGroup]);

  // Viewing the group clears its "new activity" badge
  const markSeen = useGroupStore((state) => state.markSeen);
  const lastActivityAt = group?.lastActivityAt;
  useEffect(() => {
    if (id && lastActivityAt) markSeen(id, lastActivityAt);
  }, [id, lastActivityAt, markSeen]);

  const load = useCallback(async () => {
    if (!id) return;
    const [result, activityResult, queued] = await Promise.all([
      fetchGroupApi(id),
      fetchActivityApi(id, 0, PAGE_SIZE),
      queuedClientIds(),
    ]);
    if (activityResult.ok) {
      setActivity(id, activityResult.data.items, queued);
      setHasMore(activityResult.data.hasMore);
    }
    if (result.ok) {
      applyGroup(result.data);
    } else if (result.status === 404) {
      removeGroup(id);
      Toast.error("This group isn't available anymore");
      router.back();
    } else if (!useGroupStore.getState().groups.some((g) => g._id === id)) {
      Toast.error(result.message);
    }
  }, [id, applyGroup, removeGroup, router, setActivity]);

  const loadMore = async () => {
    if (!id || loadingMore || !hasMore) return;
    setLoadingMore(true);
    const result = await fetchActivityApi(id, activity.length, PAGE_SIZE);
    setLoadingMore(false);
    if (!result.ok) return Toast.error(result.message);
    const known = new Set(activity.map((e) => e._id));
    setActivity(id, [...activity, ...result.data.items.filter((e) => !known.has(e._id))]);
    setHasMore(result.data.hasMore);
  };

  useFocusEffect(
    useCallback(() => {
      const cached = useGroupStore.getState().groups.some((g) => g._id === id);
      if (!cached) setLoading(true);
      load().finally(() => setLoading(false));
    }, [id, load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (!group) {
    return (
      <SafeAreaView className="flex-1 dark:bg-gray-900 bg-white items-center justify-center">
        {loading ? (
          <ActivityIndicator size="large" color="#6366f1" />
        ) : (
          <>
            <Text className="dark:text-gray-400 text-gray-500">Couldn&apos;t load this group</Text>
            <TouchableOpacity onPress={() => router.back()} className="mt-4 bg-indigo-600 px-6 py-3 rounded-xl">
              <Text className="text-white font-semibold">Go back</Text>
            </TouchableOpacity>
          </>
        )}
      </SafeAreaView>
    );
  }

  const members = group.members.filter((m) => m.status !== 'left');
  const pendingCount = members.filter((m) => m.status === 'pending').length;
  const link = inviteLink(group.inviteCode);
  const canRemove = (m: GroupMember) =>
    (m.status === 'pending' || m.status === 'invited') && (group.isCreator || m.addedByYou);
  const myBalance = myBalanceLabel(group.myNet ?? 0, group.currencySymbol);
  const netByMember = new Map((group.balances ?? []).map((b) => [b.memberId, b.net]));
  const allActivity: ActivityItem[] = [...pendingExpenses.map((e) => ({ ...e, kind: 'expense' as const })), ...activity];
  const showInviteCard = !!created || pendingCount > 0 || members.length < 2 || allActivity.length === 0;
  const hasBalances = (group.balances ?? []).length > 0;

  const deletePayment = async () => {
    if (!selectedSettlement) return;
    setBusy(true);
    const result = await deleteSettlementApi(group._id, selectedSettlement._id);
    setBusy(false);
    if (!result.ok) return Toast.error(result.message);
    applyGroup(result.data);
    setActivity(group._id, activity.filter((a) => a._id !== selectedSettlement._id));
    if (selectedSettlement.addedToPersonal) bumpPersonalLedger();
    setConfirmDeletePayment(false);
    setSelectedSettlement(null);
    Toast.success('Payment deleted');
  };

  const shareInvite = async () => {
    try {
      await Share.share({
        message: `Join "${group.name}" on ExpenseGauge so we can split expenses:\n${link}\n\nOr open Groups → Join and enter code ${group.inviteCode}`,
      });
    } catch {
      Toast.error("Couldn't open the share sheet");
    }
  };

  const closeAddMember = () => {
    setShowAddMember(false);
    setNewMemberName('');
    setFoundUser(null);
    setNotFoundEmail(null);
  };

  const handleAddMember = async () => {
    const input = newMemberName.trim();
    if (!input) return;

    if (looksLikeEmail(input)) {
      const email = input.toLowerCase();
      // First tap: show who the email belongs to, so the right person gets invited
      if (foundUser?.email !== email) {
        setBusy(true);
        const lookup = await lookupEmailApi(email);
        setBusy(false);
        if (!lookup.ok) {
          if (lookup.status === 404) setNotFoundEmail(email);
          else Toast.error(lookup.message);
          return;
        }
        if (lookup.data.isYou) return Toast.error("That's your own email");
        setFoundUser({ email, name: lookup.data.name, maskedEmail: lookup.data.maskedEmail });
        return;
      }
      // Second tap: send the invitation
      setBusy(true);
      const result = await addGroupMemberByEmailApi(group._id, email);
      setBusy(false);
      if (!result.ok) return Toast.error(result.message);
      applyGroup(result.data);
      Toast.success(`Invitation sent to ${foundUser.name}`);
      closeAddMember();
      return;
    }

    const memberName = cleanName(input);
    setBusy(true);
    const result = await addGroupMemberApi(group._id, memberName);
    setBusy(false);
    if (!result.ok) {
      Toast.error(result.message);
      return;
    }
    applyGroup(result.data);
    closeAddMember();
    Toast.success(`${memberName} added`);
  };

  const saveName = async () => {
    const nextName = cleanName(renameValue);
    if (!nextName || nextName === group.name) {
      setShowSettings(false);
      return;
    }
    setBusy(true);
    const result = await updateGroupApi(group._id, { name: nextName });
    setBusy(false);
    if (!result.ok) {
      Toast.error(result.message);
      return;
    }
    applyGroup(result.data);
    setShowSettings(false);
    Toast.success('Group renamed');
  };

  const toggleNotify = async (value: boolean) => {
    setSavingNotify(true);
    const result = await setGroupNotifications(group._id, value);
    setSavingNotify(false);
    if (!result.ok) Toast.info(result.message);
  };

  const toggleSmartSettle = async (value: boolean) => {
    // Optimistic: flip now, undo if the server refuses
    applyGroup({ ...group, simplifyDebts: value });
    const result = await updateGroupApi(group._id, { simplifyDebts: value });
    if (result.ok) {
      applyGroup(result.data);
    } else {
      applyGroup({ ...group, simplifyDebts: !value });
      Toast.error(result.message);
    }
  };

  const runConfirm = async () => {
    if (!confirm) return;
    setBusy(true);
    if (confirm.kind === 'remove') {
      const result = await removeGroupMemberApi(group._id, confirm.member._id);
      setBusy(false);
      if (!result.ok) return Toast.error(result.message);
      applyGroup(result.data);
      Toast.success(`${confirm.member.name} removed`);
    } else if (confirm.kind === 'rotate') {
      const result = await rotateInviteApi(group._id);
      setBusy(false);
      if (!result.ok) return Toast.error(result.message);
      applyGroup(result.data);
      Toast.success('New invite link ready. The old one no longer works.');
    } else {
      const result = await leaveGroupApi(group._id);
      setBusy(false);
      if (!result.ok) return Toast.error(result.message);
      setConfirm(null);
      setShowSettings(false);
      removeGroup(group._id);
      Toast.success(`You left ${group.name}`);
      router.back();
      return;
    }
    setConfirm(null);
  };

  const confirmCopy = (() => {
    if (!confirm) return null;
    if (confirm.kind === 'remove') {
      return {
        title: confirm.member.status === 'invited' ? 'Cancel invitation?' : `Remove ${confirm.member.name}?`,
        message: confirm.member.status === 'invited'
          ? `${confirm.member.name} won't see this invitation anymore.`
          : `${confirm.member.name} hasn't joined yet. They won't be part of this group anymore.`,
        confirmLabel: 'Remove', icon: 'user-x' as const, tone: 'danger' as const,
      };
    }
    if (confirm.kind === 'rotate') {
      return {
        title: 'Reset invite link?',
        message: "The current link and code stop working. People who already joined aren't affected.",
        confirmLabel: 'Reset', icon: 'refresh-cw' as const, tone: 'primary' as const,
      };
    }
    return {
      title: `Leave ${group.name}?`,
      message: 'The group disappears from your list. You can join again later with an invite link.',
      confirmLabel: 'Leave', icon: 'log-out' as const, tone: 'danger' as const,
    };
  })();

  return (
    <SafeAreaView className="flex-1 dark:bg-gray-900 bg-white" edges={['top']}>
      <View className="flex-row items-center px-5 pt-4 pb-2">
        <TouchableOpacity onPress={() => router.back()} className="mr-4" hitSlop={8}>
          <Feather name="arrow-left" size={22} color={isDark ? 'white' : '#111827'} />
        </TouchableOpacity>
        <Text className="text-xl font-bold dark:text-white text-gray-900 flex-1" numberOfLines={1}>
          {group.name}
        </Text>
        {!showInviteCard && (
          <TouchableOpacity onPress={shareInvite} hitSlop={8} className="mr-5">
            <Feather name="user-plus" size={21} color={isDark ? '#d1d5db' : '#4b5563'} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={() => {
            setRenameValue(group.name);
            setShowSettings(true);
          }}
          hitSlop={8}
        >
          <Feather name="settings" size={21} color={isDark ? '#d1d5db' : '#4b5563'} />
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 90 + insets.bottom }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6366f1']} tintColor="#6366f1" />}
      >
        {/* Your balance */}
        <View className="rounded-2xl p-4 dark:bg-gray-800 bg-gray-50 border dark:border-gray-700 border-gray-200">
          <Text className="dark:text-gray-400 text-gray-500 text-xs">Your balance</Text>
          <Text className={`text-xl font-bold mt-0.5 ${TONE_TEXT[myBalance.tone]}`}>{myBalance.text}</Text>
          <View className="flex-row gap-3 mt-4">
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/(tabs)/groups/expense', params: { groupId: group._id } })}
              className="flex-1 bg-indigo-600 rounded-xl py-3 flex-row items-center justify-center"
            >
              <Feather name="plus" size={18} color="white" />
              <Text className="text-white font-semibold ml-2">Add expense</Text>
            </TouchableOpacity>
            {hasBalances && (
              <TouchableOpacity
                onPress={() => router.push({ pathname: '/(tabs)/groups/settle', params: { groupId: group._id } })}
                className="flex-1 rounded-xl py-3 flex-row items-center justify-center border border-indigo-600"
              >
                <Feather name="check-circle" size={17} color="#6366f1" />
                <Text className="text-indigo-600 dark:text-indigo-300 font-semibold ml-2">Settle up</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Invite: prominent until everyone has joined */}
        {showInviteCard && (
          <View className="rounded-2xl p-4 mt-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900">
            <Text className="font-semibold text-indigo-900 dark:text-indigo-200 text-base">
              {created ? 'Group created! Now invite your friends' : 'Invite friends'}
            </Text>
            <Text className="text-indigo-700/80 dark:text-indigo-300/80 text-xs mt-1 leading-4">
              {pendingCount > 0
                ? `${pendingCount} ${pendingCount === 1 ? "person hasn't" : "people haven't"} joined yet. Send them the link so they can claim their name.`
                : 'Anyone with the link or code can join this group.'}
            </Text>
            <View className="flex-row items-center mt-3">
              <View className="flex-1">
                <Text className="text-indigo-700/70 dark:text-indigo-300/70 text-xs">Invite code</Text>
                <Text selectable className="text-indigo-900 dark:text-white text-lg font-bold tracking-widest">
                  {group.inviteCode}
                </Text>
              </View>
              <TouchableOpacity onPress={shareInvite} className="bg-indigo-600 px-4 py-3 rounded-xl flex-row items-center">
                <Feather name="share-2" size={16} color="white" />
                <Text className="text-white font-semibold ml-2">Share invite</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Expenses */}
        <Text className="text-lg font-bold dark:text-white text-gray-900 mt-6 mb-2">Activity</Text>
        {allActivity.length === 0 ? (
          <View className="items-center rounded-2xl py-8 px-6 dark:bg-gray-800 bg-gray-50 border dark:border-gray-700 border-gray-200">
            <Feather name="file-text" size={28} color="#9ca3af" />
            <Text className="dark:text-gray-300 text-gray-600 font-medium mt-3">No shared expenses yet</Text>
            <Text className="dark:text-gray-500 text-gray-400 text-xs text-center mt-1">
              Add what someone paid and choose who it&apos;s split between.
            </Text>
          </View>
        ) : (
          allActivity.map((item) => {
            if (item.kind === 'settlement') {
              const rounding = roundOffText(item, group);
              const involvesMe = item.fromMemberId === group.myMemberId || item.toMemberId === group.myMemberId;
              return (
                <TouchableOpacity
                  key={item._id}
                  onPress={() => setSelectedSettlement(item)}
                  activeOpacity={0.7}
                  className="flex-row items-center py-3 border-b border-gray-100 dark:border-gray-800"
                >
                  <View className="w-11 items-center">
                    <Text className="dark:text-gray-400 text-gray-500 text-xs text-center">{formatShortDate(item.date)}</Text>
                  </View>
                  <View className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 items-center justify-center ml-2">
                    <Feather name="check" size={15} color="#16a34a" />
                  </View>
                  <View className="flex-1 ml-2">
                    <Text className={`dark:text-white text-gray-900 ${involvesMe ? 'font-semibold' : 'font-medium'}`} numberOfLines={1}>
                      {memberName(group, item.fromMemberId)} paid {memberName(group, item.toMemberId)} {formatMoney(item.amount, group.currencySymbol)}
                    </Text>
                    <View className="flex-row items-center mt-0.5">
                      {item.source === 'smart' && (
                        <View className="flex-row items-center bg-indigo-50 dark:bg-indigo-900/30 rounded-full px-1.5 py-0.5 mr-1.5">
                          <Feather name="zap" size={10} color="#6366f1" />
                          <Text className="text-indigo-600 dark:text-indigo-300 text-[10px] font-semibold ml-0.5">Smart settle</Text>
                        </View>
                      )}
                      <Text className="dark:text-gray-400 text-gray-500 text-xs flex-1" numberOfLines={1}>
                        {rounding ?? paymentMethodLabel(item.method)}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            }
            const expense = item;
            const impact = expenseImpact(expense, group.currencySymbol);
            const payer = memberName(group, expense.paidBy[0]?.memberId);
            return (
              <TouchableOpacity
                key={expense._id}
                onPress={() => !expense.pendingSync && setSelectedExpense(expense)}
                activeOpacity={expense.pendingSync ? 1 : 0.7}
                className="flex-row items-center py-3 border-b border-gray-100 dark:border-gray-800"
              >
                <View className="w-11 items-center">
                  <Text className="dark:text-gray-400 text-gray-500 text-xs text-center">{formatShortDate(expense.date)}</Text>
                </View>
                <View className="flex-1 ml-2">
                  <Text className="dark:text-white text-gray-900 font-medium" numberOfLines={1}>{expense.details}</Text>
                  <Text className="dark:text-gray-400 text-gray-500 text-xs mt-0.5" numberOfLines={1}>
                    {expense.pendingSync
                      ? 'Waiting to sync'
                      : `${payer} paid ${formatMoney(expense.amount, group.currencySymbol)}`}
                  </Text>
                </View>
                <View className="items-end ml-2">
                  {expense.pendingSync ? (
                    <Feather name="clock" size={16} color="#d97706" />
                  ) : (
                    <Text className={`text-xs font-semibold ${TONE_TEXT[impact.tone]}`}>{impact.text}</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })
        )}
        {hasMore && (
          <TouchableOpacity onPress={loadMore} disabled={loadingMore} className="py-4 items-center">
            {loadingMore ? <ActivityIndicator color="#6366f1" /> : <Text className="text-indigo-600 dark:text-indigo-400 font-semibold">Show older activity</Text>}
          </TouchableOpacity>
        )}

        {/* Members */}
        <View className="flex-row items-center mt-6 mb-2">
          <Text className="text-lg font-bold dark:text-white text-gray-900 flex-1">
            Members <Text className="text-gray-400 font-normal text-base">· {members.length}</Text>
          </Text>
          <TouchableOpacity onPress={() => setShowAddMember(true)} className="flex-row items-center" hitSlop={8}>
            <Feather name="user-plus" size={16} color="#6366f1" />
            <Text className="text-indigo-600 dark:text-indigo-400 font-semibold ml-1">Add</Text>
          </TouchableOpacity>
        </View>
        {members.map((member) => (
          <View key={member._id} className="flex-row items-center py-2.5">
            <InitialsAvatar name={member.name} size={40} muted={member.status === 'pending' || member.status === 'invited'} />
            <View className="flex-1 ml-3">
              <Text className="dark:text-white text-gray-900 font-medium">
                {member.name}{member.isYou ? ' (you)' : ''}
              </Text>
              {member.status === 'pending' && (
                <Text className="text-amber-600 dark:text-amber-400 text-xs mt-0.5">Not joined yet</Text>
              )}
              {member.status === 'invited' && (
                <Text className="text-indigo-600 dark:text-indigo-300 text-xs mt-0.5">Invited · hasn&apos;t accepted yet</Text>
              )}
            </View>
            {(() => {
              const label = memberBalanceLabel(netByMember.get(member._id) ?? 0, group.currencySymbol);
              return <Text className={`text-xs font-semibold mr-3 ${TONE_TEXT[label.tone]}`}>{label.text}</Text>;
            })()}
            {canRemove(member) && (
              <TouchableOpacity onPress={() => setConfirm({ kind: 'remove', member })} hitSlop={10}>
                <Feather name="x" size={18} color="#9ca3af" />
              </TouchableOpacity>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Payment details */}
      <Modal visible={!!selectedSettlement} transparent animationType="slide" onRequestClose={() => setSelectedSettlement(null)}>
        <View className="flex-1 justify-end bg-black/50">
          {selectedSettlement && (
            <View className="dark:bg-gray-900 bg-white rounded-t-2xl p-6" style={{ paddingBottom: insets.bottom + 24, maxHeight: '90%' }}>
              <View className="flex-row items-start">
                <View className="flex-1 pr-3">
                  <Text className="text-xl font-bold dark:text-white text-gray-900">
                    {memberName(group, selectedSettlement.fromMemberId)} paid {memberName(group, selectedSettlement.toMemberId)}
                  </Text>
                  <Text className="dark:text-gray-400 text-gray-500 text-xs mt-1">
                    {new Date(selectedSettlement.date).toDateString()} · {paymentMethodLabel(selectedSettlement.method)}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedSettlement(null)} hitSlop={10}>
                  <Feather name="x" size={22} color={isDark ? '#d1d5db' : '#4b5563'} />
                </TouchableOpacity>
              </View>

              <ScrollView className="mt-4" showsVerticalScrollIndicator={false}>
                <Text className="text-3xl font-bold dark:text-white text-gray-900">
                  {formatMoney(selectedSettlement.amount, group.currencySymbol)}
                </Text>
                {selectedSettlement.roundOff !== 0 && (
                  <Text className="dark:text-gray-300 text-gray-600 mt-1">
                    Cleared {formatMoney(selectedSettlement.settledAmount, group.currencySymbol)} owed ·{' '}
                    {roundOffText(selectedSettlement, group)}
                  </Text>
                )}
                {!!selectedSettlement.note && (
                  <Text className="dark:text-gray-300 text-gray-600 mt-3 italic">&ldquo;{selectedSettlement.note}&rdquo;</Text>
                )}

                {selectedSettlement.route ? (
                  <View className="mt-5 rounded-2xl p-3 border border-indigo-100 dark:border-indigo-900">
                    <Text className="dark:text-white text-gray-900 font-semibold mb-3">
                      How this was settled
                    </Text>
                    <SettleRoute
                      group={group}
                      before={selectedSettlement.route.before}
                      after={selectedSettlement.route.after}
                      nets={selectedSettlement.route.nets}
                      highlight={{ from: selectedSettlement.fromMemberId, to: selectedSettlement.toMemberId }}
                    />
                    <Text className="dark:text-gray-500 text-gray-400 text-[11px] mt-3">
                      Balances as of {new Date(selectedSettlement.route.computedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                    </Text>
                  </View>
                ) : (
                  <Text className="dark:text-gray-500 text-gray-400 text-xs mt-4">Recorded as a direct payment.</Text>
                )}

                <Text className="dark:text-gray-500 text-gray-400 text-xs mt-4">
                  Recorded by {memberName(group, selectedSettlement.createdByMemberId)}
                  {selectedSettlement.addedToPersonal ? ' · also in your expenses' : ''}
                </Text>

                {selectedSettlement.canDelete && (
                  <TouchableOpacity
                    onPress={() => setConfirmDeletePayment(true)}
                    className="mt-5 p-4 rounded-xl border border-red-300 dark:border-red-800 flex-row items-center justify-center"
                  >
                    <Feather name="trash-2" size={16} color="#ef4444" />
                    <Text className="text-red-500 font-semibold ml-2">Delete payment</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </View>
          )}
        </View>
        <ConfirmModal
          visible={confirmDeletePayment}
          title="Delete this payment?"
          message={selectedSettlement?.addedToPersonal
            ? 'Balances go back to how they were, and the entry in your personal expenses is removed.'
            : 'Balances go back to how they were before this payment.'}
          confirmLabel="Delete"
          icon="trash-2"
          tone="danger"
          loading={busy}
          onCancel={() => setConfirmDeletePayment(false)}
          onConfirm={deletePayment}
        />
      </Modal>

      {/* Expense details */}
      <Modal visible={!!selectedExpense} transparent animationType="slide" onRequestClose={() => setSelectedExpense(null)}>
        <View className="flex-1 justify-end bg-black/50">
          {selectedExpense && (
            <View className="dark:bg-gray-900 bg-white rounded-t-2xl p-6" style={{ paddingBottom: insets.bottom + 24 }}>
              <View className="flex-row items-start">
                <View className="flex-1 pr-3">
                  <Text className="text-xl font-bold dark:text-white text-gray-900">{selectedExpense.details}</Text>
                  <Text className="dark:text-gray-400 text-gray-500 text-xs mt-1">
                    {new Date(selectedExpense.date).toDateString()} · {selectedExpense.category}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedExpense(null)} hitSlop={10}>
                  <Feather name="x" size={22} color={isDark ? '#d1d5db' : '#4b5563'} />
                </TouchableOpacity>
              </View>

              <Text className="text-3xl font-bold dark:text-white text-gray-900 mt-4">
                {formatMoney(selectedExpense.amount, group.currencySymbol)}
              </Text>
              <Text className="dark:text-gray-300 text-gray-600 mt-1">
                Paid by {memberName(group, selectedExpense.paidBy[0]?.memberId)}
                {{
                  equal: ', split equally',
                  exact: ', split by exact amounts',
                  percent: ', split by percentage',
                  shares: ', split by shares',
                }[selectedExpense.splitType]}
              </Text>

              <ScrollView style={{ maxHeight: 260 }} className="mt-4">
                {selectedExpense.splits.map((s) => (
                  <View key={s.memberId} className="flex-row items-center py-2">
                    <InitialsAvatar name={memberName(group, s.memberId, { you: false })} size={32} />
                    <Text className="flex-1 ml-3 dark:text-white text-gray-900">{memberName(group, s.memberId)}</Text>
                    {typeof s.weight === 'number' && (
                      <Text className="dark:text-gray-500 text-gray-400 text-xs mr-2">
                        {selectedExpense.splitType === 'percent' ? `${s.weight}%` : `${s.weight} ${s.weight === 1 ? 'share' : 'shares'}`}
                      </Text>
                    )}
                    <Text className="dark:text-gray-300 text-gray-700">{formatMoney(s.amount, group.currencySymbol)}</Text>
                  </View>
                ))}
              </ScrollView>

              <Text className="dark:text-gray-500 text-gray-400 text-xs mt-3">
                Added by {memberName(group, selectedExpense.createdByMemberId)}
                {selectedExpense.addedToPersonal ? ' · also in your expenses' : ''}
              </Text>

              {selectedExpense.canEdit ? (
                <TouchableOpacity
                  onPress={() => {
                    const expenseId = selectedExpense._id;
                    setSelectedExpense(null);
                    router.push({ pathname: '/(tabs)/groups/expense', params: { groupId: group._id, expenseId } });
                  }}
                  className="bg-indigo-600 p-4 rounded-xl mt-5 flex-row items-center justify-center"
                >
                  <Feather name="edit-2" size={16} color="white" />
                  <Text className="text-white font-semibold ml-2">Edit or delete</Text>
                </TouchableOpacity>
              ) : (
                <Text className="dark:text-gray-500 text-gray-400 text-xs mt-2">
                  Only {memberName(group, selectedExpense.createdByMemberId)} can edit or delete this expense.
                </Text>
              )}
            </View>
          )}
        </View>
      </Modal>

      {/* Add member sheet */}
      <Modal visible={showAddMember} transparent animationType="slide" onRequestClose={closeAddMember}>
        <View className="flex-1 justify-end bg-black/50" style={{ paddingBottom: keyboardHeight }}>
          <View className="dark:bg-gray-900 bg-white rounded-t-2xl p-6" style={{ paddingBottom: sheetPaddingBottom }}>
            <Text className="text-xl font-bold dark:text-white text-gray-900">Add member</Text>
            <Text className="dark:text-gray-400 text-gray-500 text-sm mt-1 mb-4">
              Enter their ExpenseGauge email to send an invitation, or just a name. People added by name claim it when they join with the invite link.
            </Text>
            <TextInput
              className="dark:bg-gray-800 bg-gray-100 rounded-lg p-3 dark:text-white text-gray-900 text-base"
              placeholder="Name or email"
              placeholderTextColor="#9ca3af"
              value={newMemberName}
              onChangeText={(v) => {
                setNewMemberName(v);
                setFoundUser(null);
                setNotFoundEmail(null);
              }}
              maxLength={254}
              autoCorrect={false}
              autoFocus
              onSubmitEditing={handleAddMember}
            />
            {foundUser && (
              <View className="flex-row items-center mt-3 rounded-xl p-3 bg-indigo-50 dark:bg-indigo-900/20">
                <InitialsAvatar name={foundUser.name} size={36} />
                <View className="ml-3 flex-1">
                  <Text className="dark:text-white text-gray-900 font-medium">{foundUser.name}</Text>
                  <Text className="dark:text-gray-400 text-gray-500 text-xs">{foundUser.maskedEmail}</Text>
                </View>
                <Feather name="check-circle" size={18} color="#6366f1" />
              </View>
            )}
            {notFoundEmail && (
              <View className="mt-3 rounded-xl p-3 bg-amber-50 dark:bg-amber-900/20">
                <Text className="text-amber-800 dark:text-amber-200 text-xs leading-4">
                  No ExpenseGauge account uses {notFoundEmail}. Type their name instead and share the invite link from this group.
                </Text>
              </View>
            )}
            <View className="flex-row gap-3 mt-5">
              <TouchableOpacity onPress={closeAddMember} className="flex-1 bg-gray-200 dark:bg-gray-700 p-4 rounded-xl">
                <Text className="text-center font-semibold text-gray-700 dark:text-gray-300">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleAddMember} disabled={busy} className="flex-1 bg-indigo-600 p-4 rounded-xl">
                {busy ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-center font-semibold text-white">
                    {foundUser ? 'Send invitation' : looksLikeEmail(newMemberName) ? 'Find' : 'Add'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Settings sheet */}
      <Modal visible={showSettings} transparent animationType="slide" onRequestClose={() => setShowSettings(false)}>
        <View className="flex-1 justify-end bg-black/50" style={{ paddingBottom: keyboardHeight }}>
          <View className="dark:bg-gray-900 bg-white rounded-t-2xl p-6" style={{ paddingBottom: sheetPaddingBottom }}>
            <View className="flex-row items-center mb-4">
              <Text className="text-xl font-bold dark:text-white text-gray-900 flex-1">Group settings</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)} hitSlop={10}>
                <Feather name="x" size={22} color={isDark ? '#d1d5db' : '#4b5563'} />
              </TouchableOpacity>
            </View>

            <Text className="dark:text-gray-300 text-gray-600 mb-1">Group name</Text>
            <View className="flex-row items-center">
              <TextInput
                className="flex-1 dark:bg-gray-800 bg-gray-100 rounded-lg p-3 dark:text-white text-gray-900 text-base"
                value={renameValue}
                onChangeText={setRenameValue}
                maxLength={MAX_GROUP_NAME_LENGTH}
                onSubmitEditing={saveName}
              />
              <TouchableOpacity
                onPress={saveName}
                disabled={busy || cleanName(renameValue) === group.name || !cleanName(renameValue)}
                className={`ml-2 px-4 py-3 rounded-lg ${cleanName(renameValue) && cleanName(renameValue) !== group.name ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-700'}`}
              >
                <Text className="text-white font-semibold">Save</Text>
              </TouchableOpacity>
            </View>

            <View className="flex-row items-center mt-6">
              <Feather name={group.myNotify ? 'bell' : 'bell-off'} size={18} color={isDark ? '#d1d5db' : '#4b5563'} />
              <View className="flex-1 px-3">
                <Text className="dark:text-white text-gray-900 font-medium">Notify me about {group.name}</Text>
                <Text className="dark:text-gray-400 text-gray-500 text-xs mt-0.5 leading-4">
                  {notificationsOn
                    ? 'New expenses you are part of and payments with you.'
                    : 'All group notifications are off in Profile → Preferences.'}
                </Text>
              </View>
              <Switch
                value={!!group.myNotify}
                disabled={!notificationsOn || savingNotify}
                onValueChange={toggleNotify}
                trackColor={{ false: '#9ca3af', true: '#818cf8' }}
                thumbColor={group.myNotify ? '#4f46e5' : '#f4f4f5'}
              />
            </View>

            <View className="flex-row items-center mt-6">
              <View className="flex-1 pr-3">
                <Text className="dark:text-white text-gray-900 font-medium">Smart settle</Text>
                <Text className="dark:text-gray-400 text-gray-500 text-xs mt-0.5 leading-4">
                  Fewer payments, same totals. Suggests who should pay whom so the group settles with the least number of transfers.
                </Text>
              </View>
              <Switch
                value={group.simplifyDebts}
                onValueChange={toggleSmartSettle}
                trackColor={{ false: '#9ca3af', true: '#818cf8' }}
                thumbColor={group.simplifyDebts ? '#4f46e5' : '#f4f4f5'}
              />
            </View>

            {group.isCreator && (
              <TouchableOpacity onPress={() => setConfirm({ kind: 'rotate' })} className="flex-row items-center mt-6">
                <Feather name="refresh-cw" size={18} color={isDark ? '#d1d5db' : '#4b5563'} />
                <View className="ml-3 flex-1">
                  <Text className="dark:text-white text-gray-900 font-medium">Reset invite link</Text>
                  <Text className="dark:text-gray-400 text-gray-500 text-xs mt-0.5">Use this if the link was shared with the wrong people.</Text>
                </View>
              </TouchableOpacity>
            )}

            <TouchableOpacity onPress={() => setConfirm({ kind: 'leave' })} className="flex-row items-center mt-6">
              <Feather name="log-out" size={18} color="#ef4444" />
              <Text className="ml-3 text-red-500 font-medium">Leave group</Text>
            </TouchableOpacity>
          </View>
        </View>
        {confirmCopy && (
          <ConfirmModal
            visible={!!confirm && confirm.kind !== 'remove'}
            {...confirmCopy}
            loading={busy}
            onCancel={() => setConfirm(null)}
            onConfirm={runConfirm}
          />
        )}
      </Modal>

      {confirmCopy && confirm?.kind === 'remove' && (
        <ConfirmModal
          visible
          {...confirmCopy}
          loading={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={runConfirm}
        />
      )}
    </SafeAreaView>
  );
}
