import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Modal, RefreshControl, ScrollView, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useGroupStore } from '@/store/groupStore';
import { fetchSettlePlanApi } from '@/api/groupApi';
import { formatMoney, memberName } from '@/helper/groupFormat';
import InitialsAvatar from '@/components/InitialsAvatar';
import SettleRoute from '@/components/SettleRoute';
import type { SettlePlan, Transfer } from '@/types/group';

export default function SettleUpScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';
  const group = useGroupStore((state) => state.groups.find((g) => g._id === groupId));

  const [plan, setPlan] = useState<SettlePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [explain, setExplain] = useState<Transfer | 'all' | null>(null);

  const load = useCallback(async () => {
    if (!groupId) return;
    const result = await fetchSettlePlanApi(groupId);
    if (result.ok) {
      setPlan(result.data);
      setError(null);
    } else {
      setError(result.message);
    }
  }, [groupId]);

  // Balances change after every payment, so always fetch fresh
  useFocusEffect(
    useCallback(() => {
      load().finally(() => setLoading(false));
    }, [load])
  );

  if (!group) {
    return (
      <SafeAreaView className="flex-1 dark:bg-gray-900 bg-white items-center justify-center">
        <TouchableOpacity onPress={() => router.back()} className="bg-indigo-600 px-6 py-3 rounded-xl">
          <Text className="text-white font-semibold">Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const me = group.myMemberId;
  const involvesMe = (t: Transfer) => t.from === me || t.to === me;
  const transfers = plan ? [...plan.transfers].sort((a, b) => Number(involvesMe(b)) - Number(involvesMe(a))) : [];
  const saved = plan && plan.simplifyDebts ? plan.before.length - plan.transfers.length : 0;

  const record = (t?: Transfer) => {
    router.push({
      pathname: '/(tabs)/groups/payment',
      params: t
        ? { groupId: group._id, from: t.from, to: t.to, amount: String(t.amount), source: plan?.simplifyDebts ? 'smart' : 'manual' }
        : { groupId: group._id },
    });
  };

  return (
    <SafeAreaView className="flex-1 dark:bg-gray-900 bg-white" edges={['top']}>
      <View className="flex-row items-center px-5 pt-4 pb-2">
        <TouchableOpacity onPress={() => router.back()} className="mr-4" hitSlop={8}>
          <Feather name="arrow-left" size={22} color={isDark ? 'white' : '#111827'} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-xl font-bold dark:text-white text-gray-900">Settle up</Text>
          <Text className="dark:text-gray-400 text-gray-500 text-xs" numberOfLines={1}>{group.name}</Text>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      ) : (
        <ScrollView
          className="flex-1 px-5"
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 90 + insets.bottom }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} colors={['#6366f1']} tintColor="#6366f1" />}
        >
          {error && !plan ? (
            <View className="items-center pt-16 px-6">
              <Feather name="wifi-off" size={32} color="#9ca3af" />
              <Text className="dark:text-gray-300 text-gray-600 text-center mt-3">{error}</Text>
              <Text className="dark:text-gray-500 text-gray-400 text-xs text-center mt-1">
                Settling up needs a connection so everyone&apos;s latest expenses are included.
              </Text>
              <TouchableOpacity onPress={() => { setLoading(true); load().finally(() => setLoading(false)); }} className="mt-5 bg-indigo-600 px-6 py-3 rounded-xl">
                <Text className="text-white font-semibold">Try again</Text>
              </TouchableOpacity>
            </View>
          ) : plan && transfers.length === 0 ? (
            <View className="items-center pt-16 px-6">
              <View className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 items-center justify-center">
                <Feather name="check" size={30} color="#6b7280" />
              </View>
              <Text className="dark:text-white text-gray-900 text-lg font-bold mt-4">Everyone is settled up</Text>
              <Text className="dark:text-gray-400 text-gray-500 text-center mt-1">Nobody owes anything in this group.</Text>
            </View>
          ) : plan ? (
            <>
              {plan.simplifyDebts ? (
                <TouchableOpacity
                  onPress={() => setExplain('all')}
                  activeOpacity={0.8}
                  className="rounded-xl p-4 dark:bg-gray-800 bg-gray-50 border dark:border-gray-700 border-gray-200"
                >
                  <View className="flex-row items-center">
                    <Text className="dark:text-white text-gray-900 font-semibold flex-1">
                      {saved > 0
                        ? `Smart settle: ${plan.before.length} payments → ${plan.transfers.length}`
                        : 'Smart settle'}
                    </Text>
                    <Text className="text-indigo-600 dark:text-indigo-300 text-sm font-semibold">How?</Text>
                  </View>
                  <Text className="dark:text-gray-400 text-gray-500 text-xs mt-1 leading-4">
                    Fewer payments, same totals. Everyone ends at zero.
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text className="dark:text-gray-400 text-gray-500 text-xs leading-4">
                  Smart settle is off for this group, so these are the direct debts between people. Turn it on in group settings for fewer payments.
                </Text>
              )}

              <Text className="text-lg font-bold dark:text-white text-gray-900 mt-6 mb-2">Suggested payments</Text>
              {transfers.map((t) => {
                const mine = involvesMe(t);
                return (
                  <View
                    key={`${t.from}-${t.to}`}
                    className={`rounded-xl p-4 mb-3 border ${mine ? 'border-gray-300 dark:border-gray-600' : 'border-gray-200 dark:border-gray-700'}`}
                  >
                    <View className="flex-row items-center">
                      <InitialsAvatar name={memberName(group, t.from, { you: false })} size={34} />
                      <Feather name="arrow-right" size={16} color="#9ca3af" style={{ marginHorizontal: 6 }} />
                      <InitialsAvatar name={memberName(group, t.to, { you: false })} size={34} />
                      <View className="flex-1 ml-3">
                        <Text className="dark:text-white text-gray-900 font-medium" numberOfLines={2}>
                          {memberName(group, t.from)} {t.from === me ? 'pay' : 'pays'} {memberName(group, t.to)}
                        </Text>
                        <Text className="dark:text-white text-gray-900 text-lg font-bold">{formatMoney(t.amount, group.currencySymbol)}</Text>
                      </View>
                    </View>
                    <View className="flex-row items-center mt-3">
                      {plan.simplifyDebts && (
                        <TouchableOpacity onPress={() => setExplain(t)} hitSlop={8} className="flex-row items-center">
                          <Feather name="help-circle" size={14} color="#6366f1" />
                          <Text className="text-indigo-600 dark:text-indigo-300 text-sm ml-1">Why?</Text>
                        </TouchableOpacity>
                      )}
                      <View className="flex-1" />
                      {mine ? (
                        <TouchableOpacity onPress={() => record(t)} className="px-4 py-2 rounded-lg bg-indigo-600">
                          <Text className="text-white font-semibold">Record payment</Text>
                        </TouchableOpacity>
                      ) : (
                        // Only the two people involved can record it
                        <Text className="dark:text-gray-500 text-gray-400 text-xs">
                          {memberName(group, t.from)} or {memberName(group, t.to)} records this
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}

              <TouchableOpacity onPress={() => record()} className="py-4 items-center">
                <Text className="text-indigo-600 dark:text-indigo-400 font-semibold">Record a different payment</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </ScrollView>
      )}

      <Modal visible={!!explain} transparent animationType="slide" onRequestClose={() => setExplain(null)}>
        <View className="flex-1 justify-end bg-black/50">
          {plan && explain && (
            <View className="dark:bg-gray-900 bg-white rounded-t-2xl p-6" style={{ paddingBottom: insets.bottom + 24, maxHeight: '90%' }}>
              <View className="flex-row items-center mb-4">
                <Text className="text-xl font-bold dark:text-white text-gray-900 flex-1">
                  {explain === 'all' ? 'How smart settle works' : `Why ${memberName(group, explain.from)} ${explain.from === me ? 'pay' : 'pays'} ${memberName(group, explain.to)}`}
                </Text>
                <TouchableOpacity onPress={() => setExplain(null)} hitSlop={10}>
                  <Feather name="x" size={22} color={isDark ? '#d1d5db' : '#4b5563'} />
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                <SettleRoute
                  group={group}
                  before={plan.before}
                  after={plan.transfers}
                  nets={plan.nets}
                  highlight={explain === 'all' ? undefined : explain}
                />
              </ScrollView>
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}
