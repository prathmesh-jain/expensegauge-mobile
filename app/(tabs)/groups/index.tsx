import React, { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { askAboutGroupNotifications } from '@/helper/pushService';
import { hasUnseenActivity, useGroupStore } from '@/store/groupStore';
import { fetchGroupsApi, fetchInvitationsApi, respondToInvitationApi } from '@/api/groupApi';
import { Toast } from 'toastify-react-native';
import InitialsAvatar from '@/components/InitialsAvatar';
import type { Group, GroupInvitation } from '@/types/group';
import { formatMoney, myBalanceLabel, TONE_TEXT, totalsByCurrency } from '@/helper/groupFormat';

const memberSummary = (group: Group) => {
  const current = group.members.filter((m) => m.status !== 'left');
  const others = current.filter((m) => !m.isYou).map((m) => m.name.split(' ')[0]);
  const names = others.length === 0 ? 'Just you' : `You, ${others.slice(0, 3).join(', ')}${others.length > 3 ? ` +${others.length - 3}` : ''}`;
  return names;
};

export default function GroupsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const groups = useGroupStore((state) => state.groups);
  const lastSeen = useGroupStore((state) => state.lastSeen);
  const setInvitationCount = useGroupStore((state) => state.setInvitationCount);
  const setGroups = useGroupStore((state) => state.setGroups);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [invitations, setInvitations] = useState<GroupInvitation[]>([]);
  const [responding, setResponding] = useState<string | null>(null);
  const upsertGroup = useGroupStore((state) => state.upsertGroup);

  const load = useCallback(async () => {
    const [result, invites] = await Promise.all([fetchGroupsApi(), fetchInvitationsApi()]);
    if (invites.ok) {
      setInvitations(invites.data);
      setInvitationCount(invites.data.length);
    }
    if (result.ok) {
      setGroups(result.data);
      setLoadError(null);
    } else {
      setLoadError(result.message);
    }
  }, [setGroups, setInvitationCount]);

  const respond = async (invitation: GroupInvitation, accept: boolean) => {
    setResponding(invitation.groupId);
    const result = await respondToInvitationApi(invitation.groupId, accept);
    setResponding(null);
    if (!result.ok) return Toast.error(result.message);
    setInvitations((prev) => prev.filter((i) => i.groupId !== invitation.groupId));
    setInvitationCount(Math.max(0, useGroupStore.getState().invitationCount - 1));
    if (accept && result.data.group) {
      upsertGroup(result.data.group);
      Toast.success(`You joined ${invitation.groupName}`);
      askAboutGroupNotifications(result.data.group);
      router.push({ pathname: '/(tabs)/groups/[id]', params: { id: invitation.groupId } });
    } else {
      Toast.info('Invitation declined');
    }
  };

  useFocusEffect(
    useCallback(() => {
      const showSpinner = useGroupStore.getState().groups.length === 0;
      if (showSpinner) setLoading(true);
      load().finally(() => setLoading(false));
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeAreaView className="flex-1 dark:bg-gray-900 bg-white" edges={['top']}>
      <View className="flex-row items-center px-5 pt-4 pb-2">
        <Text className="text-2xl font-bold dark:text-white text-gray-900 flex-1">Groups</Text>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/groups/join')}
          className="px-3 py-2 rounded-full flex-row items-center border border-indigo-600 mr-2"
        >
          <Feather name="log-in" size={15} color="#6366f1" />
          <Text className="text-indigo-600 dark:text-indigo-400 text-sm font-semibold ml-1">Join</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/groups/new')}
          className="bg-indigo-600 px-3 py-2 rounded-full flex-row items-center"
        >
          <Feather name="plus" size={16} color="white" />
          <Text className="text-white text-sm font-semibold ml-1">New</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      ) : (
        <ScrollView
          className="flex-1 px-5 pt-3"
          contentContainerStyle={{ paddingBottom: 90 + insets.bottom, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6366f1']} tintColor="#6366f1" />}
        >
          {loadError && groups.length > 0 && (
            <View className="flex-row items-center dark:bg-gray-800 bg-gray-50 rounded-xl px-3 py-2 mb-3">
              <Feather name="wifi-off" size={14} color="#d97706" />
              <Text className="text-amber-700 dark:text-amber-300 text-xs ml-2 flex-1">
                Showing saved groups. Pull down to refresh.
              </Text>
            </View>
          )}

          {invitations.map((invitation) => (
            <View
              key={invitation.groupId}
              className="rounded-xl p-4 mb-3 dark:bg-gray-800 bg-gray-50 border dark:border-gray-700 border-gray-200"
            >
              <View className="flex-row items-center">
                <InitialsAvatar name={invitation.groupName} size={40} />
                <View className="flex-1 ml-3">
                  <Text className="dark:text-white text-gray-900 font-semibold" numberOfLines={1}>
                    {invitation.invitedBy ? `${invitation.invitedBy} invited you` : "You're invited"}
                  </Text>
                  <Text className="dark:text-gray-400 text-gray-500 text-xs mt-0.5" numberOfLines={1}>
                    {invitation.groupName} · {invitation.memberCount} members
                  </Text>
                </View>
              </View>
              <View className="flex-row gap-3 mt-3">
                <TouchableOpacity
                  onPress={() => respond(invitation, false)}
                  disabled={!!responding}
                  className="flex-1 py-2.5 rounded-xl bg-gray-200 dark:bg-gray-700"
                >
                  <Text className="text-center font-semibold text-gray-700 dark:text-gray-300">Decline</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => respond(invitation, true)}
                  disabled={!!responding}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600"
                >
                  {responding === invitation.groupId ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text className="text-center font-semibold text-white">Join</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {groups.length === 0 && invitations.length > 0 ? null : groups.length === 0 ? (
            <View className="flex-1 items-center justify-center px-4 pb-16">
              <View className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 items-center justify-center mb-5">
                <Feather name="users" size={34} color="#6366f1" />
              </View>
              <Text className="text-xl font-bold dark:text-white text-gray-900 text-center">
                Split expenses with friends
              </Text>
              <Text className="dark:text-gray-400 text-gray-500 text-center mt-2 leading-5">
                Make a group for a trip, your flat or any shared plan. Add what each person paid and see who owes whom.
              </Text>
              {loadError && (
                <Text className="text-red-500 text-center text-sm mt-3">{loadError}</Text>
              )}
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/groups/new')}
                className="mt-6 bg-indigo-600 px-6 py-3 rounded-xl w-full"
              >
                <Text className="text-white font-semibold text-center">Create a group</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/groups/join')}
                className="mt-3 px-6 py-3 rounded-xl w-full border border-gray-300 dark:border-gray-700"
              >
                <Text className="dark:text-gray-200 text-gray-700 font-semibold text-center">I have an invite code</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
            {(() => {
              const totals = totalsByCurrency(groups);
              return (
                <View className="rounded-xl p-5 mb-4 dark:bg-indigo-600 bg-white dark:border-0 border border-gray-300">
                  <Text className="dark:text-indigo-100 text-gray-500 text-xs font-medium">Across your groups</Text>
                  {totals.length === 0 ? (
                    <Text className="dark:text-white text-slate-800 text-lg font-bold mt-1">You&apos;re all settled up</Text>
                  ) : (
                    totals.map((t) => (
                      <View key={t.symbol} className="flex-row mt-2">
                        <View className="flex-1">
                          <Text className="dark:text-indigo-100 text-gray-500 text-xs">You are owed</Text>
                          <Text className="dark:text-white text-slate-800 text-lg font-bold">{formatMoney(t.owed, t.symbol)}</Text>
                        </View>
                        <View className="flex-1">
                          <Text className="dark:text-indigo-100 text-gray-500 text-xs">You owe</Text>
                          <Text className="dark:text-white text-slate-800 text-lg font-bold">{formatMoney(t.owe, t.symbol)}</Text>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              );
            })()}
            {groups.map((group) => {
              const pending = group.members.filter((m) => m.status === 'pending').length;
              const balance = myBalanceLabel(group.myNet ?? 0, group.currencySymbol);
              const unseen = hasUnseenActivity(group, lastSeen);
              return (
                <TouchableOpacity
                  key={group._id}
                  onPress={() => router.push({ pathname: '/(tabs)/groups/[id]', params: { id: group._id } })}
                  activeOpacity={0.8}
                  className="flex-row items-center rounded-xl p-4 mb-3 dark:bg-gray-800 bg-gray-50 border dark:border-gray-700 border-gray-200"
                >
                  <View>
                    <InitialsAvatar name={group.name} size={44} />
                    {unseen && (
                      <View className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-indigo-600 border-2 border-white dark:border-gray-800" />
                    )}
                  </View>
                  <View className="flex-1 ml-3">
                    <Text className={`text-base dark:text-white text-gray-900 ${unseen ? 'font-bold' : 'font-semibold'}`} numberOfLines={1}>
                      {group.name}
                    </Text>
                    <Text className="dark:text-gray-400 text-gray-500 text-xs mt-0.5" numberOfLines={1}>
                      {memberSummary(group)}
                    </Text>
                    <Text className={`text-xs font-semibold mt-1 ${TONE_TEXT[balance.tone]}`}>
                      {balance.text}
                      {pending > 0 && <Text className="text-amber-600 dark:text-amber-400 font-normal">{`  ·  ${pending} not joined`}</Text>}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={20} color="#9ca3af" />
                </TouchableOpacity>
              );
            })}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
