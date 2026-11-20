import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Toast } from 'toastify-react-native';
import { useGroupStore } from '@/store/groupStore';
import { fetchActivityApi, queuedExpenseClientIds } from '@/api/groupApi';
import ActivityRow from '@/components/groups/ActivityRow';
import ActivityDetailSheet from '@/components/groups/ActivityDetailSheet';
import type { ActivityItem, GroupExpense } from '@/types/group';

const PAGE_SIZE = 20;
const EMPTY_ACTIVITY: ActivityItem[] = [];
const EMPTY_PENDING: GroupExpense[] = [];

// Every expense and payment in a group, newest first, loading more as you scroll
export default function GroupActivityScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';

  const group = useGroupStore((state) => state.groups.find((g) => g._id === groupId));
  const activity = useGroupStore((state) => (groupId ? state.activityByGroup[groupId] : undefined) ?? EMPTY_ACTIVITY);
  const pending = useGroupStore((state) => (groupId ? state.pendingExpenses[groupId] : undefined) ?? EMPTY_PENDING);
  const setActivity = useGroupStore((state) => state.setActivity);
  const markSeen = useGroupStore((state) => state.markSeen);

  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<ActivityItem | null>(null);

  const lastActivityAt = group?.lastActivityAt;
  useEffect(() => {
    if (groupId && lastActivityAt) markSeen(groupId, lastActivityAt);
  }, [groupId, lastActivityAt, markSeen]);

  const refresh = useCallback(async () => {
    if (!groupId) return;
    const [result, queued] = await Promise.all([fetchActivityApi(groupId, 0, PAGE_SIZE), queuedExpenseClientIds()]);
    if (!result.ok) return Toast.error(result.message);
    setActivity(groupId, result.data.items, queued);
    setHasMore(result.data.hasMore);
  }, [groupId, setActivity]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const loadMore = async () => {
    if (!groupId || loadingMore || !hasMore) return;
    setLoadingMore(true);
    const result = await fetchActivityApi(groupId, activity.length, PAGE_SIZE);
    setLoadingMore(false);
    if (!result.ok) return;
    const known = new Set(activity.map((a) => a._id));
    setActivity(groupId, [...activity, ...result.data.items.filter((a) => !known.has(a._id))]);
    setHasMore(result.data.hasMore);
  };

  if (!group) return null;
  const items: ActivityItem[] = [...pending.map((e) => ({ ...e, kind: 'expense' as const })), ...activity];

  return (
    <SafeAreaView className="flex-1 dark:bg-gray-900 bg-white" edges={['top']}>
      <View className="flex-row items-center px-5 pt-4 pb-2">
        <TouchableOpacity onPress={() => router.back()} className="mr-4" hitSlop={8}>
          <Feather name="arrow-left" size={22} color={isDark ? 'white' : '#111827'} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-xl font-bold dark:text-white text-gray-900">Activity</Text>
          <Text className="dark:text-gray-400 text-gray-500 text-xs" numberOfLines={1}>{group.name}</Text>
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => <ActivityRow group={group} item={item} onPress={setSelected} />}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 90 + insets.bottom }}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await refresh();
              setRefreshing(false);
            }}
            colors={['#6366f1']}
            tintColor="#6366f1"
          />
        }
        ListEmptyComponent={
          <Text className="dark:text-gray-400 text-gray-500 text-center mt-16">No shared expenses yet</Text>
        }
        ListFooterComponent={loadingMore ? <ActivityIndicator color="#6366f1" className="py-4" /> : null}
      />

      <ActivityDetailSheet group={group} item={selected} onClose={() => setSelected(null)} />
    </SafeAreaView>
  );
}
