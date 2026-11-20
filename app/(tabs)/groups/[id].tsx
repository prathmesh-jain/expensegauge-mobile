import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Modal, RefreshControl, ScrollView, Switch, Text, TextInput, TouchableOpacity, View, useColorScheme,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Toast } from 'toastify-react-native';
import { useGroupStore } from '@/store/groupStore';
import {
  fetchActivityApi, fetchGroupApi, leaveGroupApi, queuedExpenseClientIds, rotateInviteApi, updateGroupApi,
} from '@/api/groupApi';
import { myBalanceLabel, TONE_TEXT } from '@/helper/groupFormat';
import { cleanName, MAX_GROUP_NAME_LENGTH } from '@/helper/groupLimits';
import { useKeyboardHeight } from '@/helper/useKeyboardHeight';
import { setGroupNotifications } from '@/helper/pushService';
import { shareGroupInvite } from '@/helper/shareInvite';
import InitialsAvatar from '@/components/InitialsAvatar';
import ConfirmModal from '@/components/ConfirmModal';
import ActivityRow from '@/components/groups/ActivityRow';
import ActivityDetailSheet from '@/components/groups/ActivityDetailSheet';
import type { ActivityItem, Group, GroupExpense } from '@/types/group';

// The group screen shows the latest few; the rest is on the Activity screen
const PREVIEW_COUNT = 5;
const PAGE_SIZE = 20;
const EMPTY_ACTIVITY: ActivityItem[] = [];
const EMPTY_PENDING: GroupExpense[] = [];

type Confirm = 'rotate' | 'leave';

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
  const notificationsOn = useGroupStore((state) => state.notificationsOn);
  const markSeen = useGroupStore((state) => state.markSeen);

  const [hasMore, setHasMore] = useState(false);
  const [selected, setSelected] = useState<ActivityItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [savingNotify, setSavingNotify] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  const applyGroup = useCallback((next: Group) => upsertGroup(next), [upsertGroup]);

  // Viewing the group clears its "new activity" badge
  const lastActivityAt = group?.lastActivityAt;
  useEffect(() => {
    if (id && lastActivityAt) markSeen(id, lastActivityAt);
  }, [id, lastActivityAt, markSeen]);

  const load = useCallback(async () => {
    if (!id) return;
    const [result, activityResult, queued] = await Promise.all([
      fetchGroupApi(id),
      fetchActivityApi(id, 0, PAGE_SIZE),
      queuedExpenseClientIds(),
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
  const notJoined = members.filter((m) => m.status !== 'active').length;
  const myBalance = myBalanceLabel(group.myNet ?? 0, group.currencySymbol);
  const allActivity: ActivityItem[] = [...pendingExpenses.map((e) => ({ ...e, kind: 'expense' as const })), ...activity];
  const preview = allActivity.slice(0, PREVIEW_COUNT);
  const showViewAll = allActivity.length > PREVIEW_COUNT || hasMore;
  const showInviteCard = !!created || members.length < 2;
  const hasBalances = (group.balances ?? []).length > 0;

  // "You, Bhavna, Charan +2"
  const others = members.filter((m) => !m.isYou).map((m) => m.name.split(' ')[0]);
  const memberSummary = others.length === 0
    ? 'Just you so far'
    : `You, ${others.slice(0, 3).join(', ')}${others.length > 3 ? ` +${others.length - 3}` : ''}`;

  const openMembers = () => router.push({ pathname: '/(tabs)/groups/members', params: { groupId: group._id } });

  const saveName = async () => {
    const nextName = cleanName(renameValue);
    if (!nextName || nextName === group.name) {
      setShowSettings(false);
      return;
    }
    setBusy(true);
    const result = await updateGroupApi(group._id, { name: nextName });
    setBusy(false);
    if (!result.ok) return Toast.error(result.message);
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
    setBusy(true);
    if (confirm === 'rotate') {
      const result = await rotateInviteApi(group._id);
      setBusy(false);
      if (!result.ok) return Toast.error(result.message);
      applyGroup(result.data);
      setConfirm(null);
      Toast.success('New invite link ready. The old one no longer works.');
      return;
    }
    const result = await leaveGroupApi(group._id);
    setBusy(false);
    if (!result.ok) return Toast.error(result.message);
    setConfirm(null);
    setShowSettings(false);
    removeGroup(group._id);
    Toast.success(`You left ${group.name}`);
    router.back();
  };

  return (
    <SafeAreaView className="flex-1 dark:bg-gray-900 bg-white" edges={['top']}>
      <View className="flex-row items-center px-5 pt-4 pb-2">
        <TouchableOpacity onPress={() => router.back()} className="mr-4" hitSlop={8}>
          <Feather name="arrow-left" size={22} color={isDark ? 'white' : '#111827'} />
        </TouchableOpacity>
        <Text className="text-xl font-bold dark:text-white text-gray-900 flex-1" numberOfLines={1}>
          {group.name}
        </Text>
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
        <View className="rounded-xl p-4 dark:bg-gray-800 bg-gray-50 border dark:border-gray-700 border-gray-200">
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

        {/* Members: one compact row; the full list is on the Members screen */}
        <TouchableOpacity
          onPress={openMembers}
          activeOpacity={0.7}
          className="flex-row items-center mt-4 py-3 border-b border-gray-100 dark:border-gray-800"
        >
          <View className="flex-row">
            {members.slice(0, 4).map((m, index) => (
              <View key={m._id} style={{ marginLeft: index === 0 ? 0 : -10 }} className="rounded-full border-2 border-white dark:border-gray-900">
                <InitialsAvatar name={m.name} size={30} muted={m.status !== 'active'} />
              </View>
            ))}
          </View>
          <View className="flex-1 ml-3">
            <Text className="dark:text-white text-gray-900 font-medium" numberOfLines={1}>{memberSummary}</Text>
            <Text className="dark:text-gray-400 text-gray-500 text-xs mt-0.5">
              {members.length} {members.length === 1 ? 'member' : 'members'}
              {notJoined > 0 ? ` · ${notJoined} not joined yet` : ''}
            </Text>
          </View>
          <Feather name="chevron-right" size={20} color="#9ca3af" />
        </TouchableOpacity>

        {/* Summary: balances, spending and payments for everyone */}
        <TouchableOpacity
          onPress={() => router.push({ pathname: '/(tabs)/groups/summary', params: { groupId: group._id } })}
          activeOpacity={0.7}
          className="flex-row items-center py-3 border-b border-gray-100 dark:border-gray-800"
        >
          <View className="w-[30px] items-center">
            <Feather name="pie-chart" size={20} color={isDark ? '#d1d5db' : '#4b5563'} />
          </View>
          <View className="flex-1 ml-3">
            <Text className="dark:text-white text-gray-900 font-medium">Summary</Text>
            <Text className="dark:text-gray-400 text-gray-500 text-xs mt-0.5">Who owes whom, who spent what, payments</Text>
          </View>
          <Feather name="chevron-right" size={20} color="#9ca3af" />
        </TouchableOpacity>

        {/* Invite: only until the group has someone else in it */}
        {showInviteCard && (
          <View className="rounded-xl p-4 mt-4 dark:bg-gray-800 bg-gray-50 border dark:border-gray-700 border-gray-200">
            <Text className="font-semibold dark:text-white text-gray-900 text-base">
              {created ? 'Group created! Now invite your friends' : 'Invite friends'}
            </Text>
            <Text className="dark:text-gray-400 text-gray-500 text-xs mt-1 leading-4">
              Share the link so they can join. People you added by name can claim their spot.
            </Text>
            <TouchableOpacity
              onPress={() => shareGroupInvite(group.name, group.inviteCode)}
              className="bg-indigo-600 px-4 py-3 rounded-xl flex-row items-center justify-center mt-3"
            >
              <Feather name="share-2" size={16} color="white" />
              <Text className="text-white font-semibold ml-2">Share invite</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Latest activity */}
        <View className="flex-row items-center mt-6 mb-2">
          <Text className="text-lg font-bold dark:text-white text-gray-900 flex-1">Activity</Text>
          {showViewAll && (
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/(tabs)/groups/activity', params: { groupId: group._id } })}
              hitSlop={8}
            >
              <Text className="text-indigo-600 dark:text-indigo-400 font-semibold">View all</Text>
            </TouchableOpacity>
          )}
        </View>
        {preview.length === 0 ? (
          <View className="items-center rounded-xl py-8 px-6 dark:bg-gray-800 bg-gray-50 border dark:border-gray-700 border-gray-200">
            <Feather name="file-text" size={28} color="#9ca3af" />
            <Text className="dark:text-gray-300 text-gray-600 font-medium mt-3">No shared expenses yet</Text>
            <Text className="dark:text-gray-500 text-gray-400 text-xs text-center mt-1">
              Add what someone paid and choose who it&apos;s split between.
            </Text>
          </View>
        ) : (
          preview.map((item) => <ActivityRow key={item._id} group={group} item={item} onPress={setSelected} />)
        )}
      </ScrollView>

      <ActivityDetailSheet group={group} item={selected} onClose={() => setSelected(null)} />

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
              <TouchableOpacity onPress={() => setConfirm('rotate')} className="flex-row items-center mt-6">
                <Feather name="refresh-cw" size={18} color={isDark ? '#d1d5db' : '#4b5563'} />
                <View className="ml-3 flex-1">
                  <Text className="dark:text-white text-gray-900 font-medium">Reset invite link</Text>
                  <Text className="dark:text-gray-400 text-gray-500 text-xs mt-0.5">Use this if the link was shared with the wrong people.</Text>
                </View>
              </TouchableOpacity>
            )}

            <TouchableOpacity onPress={() => setConfirm('leave')} className="flex-row items-center mt-6">
              <Feather name="log-out" size={18} color="#ef4444" />
              <Text className="ml-3 text-red-500 font-medium">Leave group</Text>
            </TouchableOpacity>
          </View>
        </View>
        <ConfirmModal
          visible={!!confirm}
          title={confirm === 'rotate' ? 'Reset invite link?' : `Leave ${group.name}?`}
          message={confirm === 'rotate'
            ? "The current link and code stop working. People who already joined aren't affected."
            : 'The group disappears from your list. You can join again later with an invite link.'}
          confirmLabel={confirm === 'rotate' ? 'Reset' : 'Leave'}
          icon={confirm === 'rotate' ? 'refresh-cw' : 'log-out'}
          tone={confirm === 'rotate' ? 'primary' : 'danger'}
          loading={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={runConfirm}
        />
      </Modal>
    </SafeAreaView>
  );
}
