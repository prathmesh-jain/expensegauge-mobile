import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, RefreshControl, ScrollView, Text, TouchableOpacity, View, useColorScheme,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useGroupStore } from '@/store/groupStore';
import { fetchActivityApi, fetchGroupSummaryApi } from '@/api/groupApi';
import {
  chipClass, chipTextClass, formatMoney, memberBalanceLabel, memberName, toPaise, TONE_TEXT,
} from '@/helper/groupFormat';
import InitialsAvatar from '@/components/InitialsAvatar';
import ActivityRow from '@/components/groups/ActivityRow';
import ActivityDetailSheet from '@/components/groups/ActivityDetailSheet';
import type { ActivityItem, Group, GroupSummary, MemberSummary, Transfer } from '@/types/group';

type Tab = 'balances' | 'spending' | 'payments';
const TABS: { value: Tab; label: string }[] = [
  { value: 'balances', label: 'Balances' },
  { value: 'spending', label: 'Spending' },
  { value: 'payments', label: 'Payments' },
];
const PAGE_SIZE = 20;

// Balances, spending and payments for a whole group, or for one person in it
export default function GroupSummaryScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';
  const group = useGroupStore((state) => state.groups.find((g) => g._id === groupId));

  const [summary, setSummary] = useState<GroupSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>('balances');
  // null = everyone
  const [person, setPerson] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!groupId) return;
    const result = await fetchGroupSummaryApi(groupId);
    if (result.ok) {
      setSummary(result.data);
      setError(null);
    } else {
      setError(result.message);
    }
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (!group) return null;

  const people = summary?.members ?? [];
  const shown = person ? people.filter((m) => m.memberId === person) : people;
  // You first, then by group order
  const filterOptions = [...people].sort((a, b) => Number(b.memberId === group.myMemberId) - Number(a.memberId === group.myMemberId));

  return (
    <SafeAreaView className="flex-1 dark:bg-gray-900 bg-white" edges={['top']}>
      <View className="flex-row items-center px-5 pt-4 pb-2">
        <TouchableOpacity onPress={() => router.back()} className="mr-4" hitSlop={8}>
          <Feather name="arrow-left" size={22} color={isDark ? 'white' : '#111827'} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-xl font-bold dark:text-white text-gray-900">Summary</Text>
          <Text className="dark:text-gray-400 text-gray-500 text-xs" numberOfLines={1}>{group.name}</Text>
        </View>
      </View>

      {/* Whose figures to show */}
      <View className="px-5 pt-1">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2">
            <TouchableOpacity onPress={() => setPerson(null)} className={chipClass(person === null)}>
              <Text className={chipTextClass(person === null)}>Everyone</Text>
            </TouchableOpacity>
            {filterOptions.map((m) => (
              <TouchableOpacity key={m.memberId} onPress={() => setPerson(m.memberId)} className={chipClass(person === m.memberId)}>
                <Text className={chipTextClass(person === m.memberId)}>{memberName(group, m.memberId)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <View className="flex-row bg-gray-100 dark:bg-gray-800 rounded-full p-1 mt-3">
          {TABS.map((t) => (
            <TouchableOpacity
              key={t.value}
              onPress={() => setTab(t.value)}
              className={`flex-1 py-1.5 rounded-full ${tab === t.value ? 'bg-white dark:bg-gray-700' : ''}`}
            >
              <Text className={`text-center ${tab === t.value ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {tab === 'payments' ? (
        <PaymentsList group={group} memberId={person} bottom={insets.bottom} />
      ) : !summary ? (
        <View className="flex-1 items-center justify-center px-8">
          {error ? (
            <>
              <Text className="dark:text-gray-300 text-gray-600 text-center">{error}</Text>
              <TouchableOpacity onPress={load} className="mt-4 bg-indigo-600 px-6 py-3 rounded-xl">
                <Text className="text-white font-semibold">Try again</Text>
              </TouchableOpacity>
            </>
          ) : (
            <ActivityIndicator size="large" color="#6366f1" />
          )}
        </View>
      ) : (
        <ScrollView
          className="flex-1 px-5"
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 90 + insets.bottom }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={['#6366f1']} tintColor="#6366f1" />}
        >
          {tab === 'balances'
            ? shown.map((m) => (
              <BalanceCard
                key={m.memberId}
                group={group}
                member={m}
                summary={summary}
                expanded={!!person}
                onSelect={() => setPerson(m.memberId)}
              />
            ))
            : (
              <>
                {!person && (
                  <View className="rounded-xl p-4 mb-4 dark:bg-gray-800 bg-gray-50 border dark:border-gray-700 border-gray-200">
                    <Text className="dark:text-gray-400 text-gray-500 text-xs">Spent in this group</Text>
                    <Text className="dark:text-white text-gray-900 text-2xl font-bold mt-0.5">
                      {formatMoney(summary.totalSpent, group.currencySymbol)}
                    </Text>
                    <Text className="dark:text-gray-400 text-gray-500 text-xs mt-1">
                      {summary.expenseCount} {summary.expenseCount === 1 ? 'expense' : 'expenses'} · {summary.paymentCount} {summary.paymentCount === 1 ? 'payment' : 'payments'}
                    </Text>
                  </View>
                )}
                {shown.map((m) => (
                  <SpendingCard
                    key={m.memberId}
                    group={group}
                    member={m}
                    totalSpent={summary.totalSpent}
                    onSelect={() => setPerson(m.memberId)}
                  />
                ))}
                <Text className="dark:text-gray-500 text-gray-400 text-xs mt-2 leading-4">
                  Paid: what they put down for expenses. Share: what they spent. Sent and received: settle-up payments.
                </Text>
              </>
            )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const sumPaise = (list: Transfer[]) => list.reduce((t, x) => t + toPaise(x.amount), 0);
const sameTransfers = (a: Transfer[], b: Transfer[]) =>
  a.length === b.length && a.every((x) => b.some((y) => y.from === x.from && y.to === x.to && toPaise(y.amount) === toPaise(x.amount)));

// One person's overall balance; expanded, who they owe and who owes them
const BalanceCard = ({ group, member, summary, expanded, onSelect }: {
  group: Group; member: MemberSummary; summary: GroupSummary; expanded: boolean; onSelect: () => void;
}) => {
  const label = memberBalanceLabel(member.net, group.currencySymbol);
  const name = memberName(group, member.memberId);
  const owes = summary.debts.filter((d) => d.from === member.memberId);
  const owed = summary.debts.filter((d) => d.to === member.memberId);
  const smart = (summary.smartPlan ?? []).filter((t) => t.from === member.memberId || t.to === member.memberId);
  const showSmart = summary.smartPlan !== null && !sameTransfers(smart, [...owes, ...owed]);
  const money = (amount: number) => formatMoney(amount, group.currencySymbol);

  return (
    <TouchableOpacity
      onPress={onSelect}
      activeOpacity={expanded ? 1 : 0.7}
      className="rounded-xl p-4 mb-3 dark:bg-gray-800 bg-gray-50 border dark:border-gray-700 border-gray-200"
    >
      <View className="flex-row items-center">
        <InitialsAvatar name={memberName(group, member.memberId, { you: false })} size={36} />
        <Text className="flex-1 ml-3 dark:text-white text-gray-900 font-medium">{name}</Text>
        <Text className={`text-sm font-semibold ${TONE_TEXT[label.tone]}`}>{label.text}</Text>
        {!expanded && <Feather name="chevron-right" size={18} color="#9ca3af" style={{ marginLeft: 6 }} />}
      </View>

      {expanded && (
        <View className="mt-3">
          {owes.length === 0 && owed.length === 0 ? (
            <Text className="dark:text-gray-400 text-gray-500 text-sm">Nothing owed either way.</Text>
          ) : (
            <>
              {owes.length > 0 && (
                <>
                  <Text className="dark:text-gray-400 text-gray-500 text-xs font-semibold mt-1">
                    {name === 'You' ? 'You owe' : `${name} owes`} · {money(sumPaise(owes) / 100)}
                  </Text>
                  {owes.map((d) => (
                    <View key={d.to} className="flex-row py-1">
                      <Text className="flex-1 dark:text-gray-200 text-gray-700">{memberName(group, d.to)}</Text>
                      <Text className="dark:text-gray-200 text-gray-700">{money(d.amount)}</Text>
                    </View>
                  ))}
                </>
              )}
              {owed.length > 0 && (
                <>
                  <Text className="dark:text-gray-400 text-gray-500 text-xs font-semibold mt-3">
                    Owed by others · {money(sumPaise(owed) / 100)}
                  </Text>
                  {owed.map((d) => (
                    <View key={d.from} className="flex-row py-1">
                      <Text className="flex-1 dark:text-gray-200 text-gray-700">{memberName(group, d.from)}</Text>
                      <Text className="dark:text-gray-200 text-gray-700">{money(d.amount)}</Text>
                    </View>
                  ))}
                </>
              )}
              {showSmart && smart.length > 0 && (
                <Text className="dark:text-gray-400 text-gray-500 text-xs mt-3 leading-4">
                  With smart settle:{' '}
                  {smart.map((t) => `${memberName(group, t.from)} ${t.from === group.myMemberId ? 'pay' : 'pays'} ${memberName(group, t.to)} ${money(t.amount)}`).join(', ')}
                </Text>
              )}
            </>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

// Paid, share, sent and received for one person, with their part of the group's spending
const SpendingCard = ({ group, member, totalSpent, onSelect }: {
  group: Group; member: MemberSummary; totalSpent: number; onSelect: () => void;
}) => {
  const money = (amount: number) => formatMoney(amount, group.currencySymbol);
  const sharePercent = totalSpent > 0 ? Math.round((member.share / totalSpent) * 100) : 0;
  const figure = (label: string, value: number) => (
    <View className="w-1/2 py-1">
      <Text className="dark:text-gray-400 text-gray-500 text-xs">{label}</Text>
      <Text className="dark:text-white text-gray-900 font-semibold">{money(value)}</Text>
    </View>
  );

  return (
    <TouchableOpacity
      onPress={onSelect}
      activeOpacity={0.7}
      className="rounded-xl p-4 mb-3 dark:bg-gray-800 bg-gray-50 border dark:border-gray-700 border-gray-200"
    >
      <View className="flex-row items-center">
        <InitialsAvatar name={memberName(group, member.memberId, { you: false })} size={32} />
        <Text className="flex-1 ml-3 dark:text-white text-gray-900 font-medium">{memberName(group, member.memberId)}</Text>
        <Text className="dark:text-gray-400 text-gray-500 text-xs">{sharePercent}% of spending</Text>
      </View>
      <View className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 mt-3 overflow-hidden">
        <View className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${Math.min(sharePercent, 100)}%` }} />
      </View>
      <View className="flex-row flex-wrap mt-2">
        {figure('Paid', member.paid)}
        {figure('Share', member.share)}
        {figure('Sent', member.sent)}
        {figure('Received', member.received)}
      </View>
    </TouchableOpacity>
  );
};

// Settle-up payments, newest first; only those involving `memberId` when set
const PaymentsList = ({ group, memberId, bottom }: { group: Group; memberId: string | null; bottom: number }) => {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ActivityItem | null>(null);
  const filter = { kind: 'settlement' as const, ...(memberId ? { memberId } : {}) };

  const loadFirst = useCallback(async () => {
    const result = await fetchActivityApi(group._id, 0, PAGE_SIZE, { kind: 'settlement', ...(memberId ? { memberId } : {}) });
    setLoading(false);
    if (!result.ok) return setError(result.message);
    setError(null);
    setItems(result.data.items);
    setHasMore(result.data.hasMore);
  }, [group._id, memberId]);

  useEffect(() => {
    setLoading(true);
    loadFirst();
  }, [loadFirst]);

  const loadMore = async () => {
    if (!hasMore || loading) return;
    const result = await fetchActivityApi(group._id, items.length, PAGE_SIZE, filter);
    if (!result.ok) return;
    const known = new Set(items.map((i) => i._id));
    setItems([...items, ...result.data.items.filter((i) => !known.has(i._id))]);
    setHasMore(result.data.hasMore);
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <>
      <FlatList
        data={items}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => <ActivityRow group={group} item={item} onPress={setSelected} />}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 90 + bottom }}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await loadFirst();
              setRefreshing(false);
            }}
            colors={['#6366f1']}
            tintColor="#6366f1"
          />
        }
        ListEmptyComponent={
          <Text className="dark:text-gray-400 text-gray-500 text-center mt-16 px-8">
            {error ?? (memberId ? `No payments involving ${memberName(group, memberId) === 'You' ? 'you' : memberName(group, memberId)} yet` : 'No payments yet')}
          </Text>
        }
      />
      <ActivityDetailSheet
        group={group}
        item={selected}
        onClose={() => {
          setSelected(null);
          // The payment may have been deleted from the sheet
          loadFirst();
        }}
      />
    </>
  );
};
