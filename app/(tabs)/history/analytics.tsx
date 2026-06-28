import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { ActivityIndicator } from 'react-native-paper';
import { Dropdown, IDropdownRef } from 'react-native-element-dropdown';
import api from '@/api/api';
import { fetchAccountsApi } from '@/api/accountApi';
import { useExpenseStore } from '@/store/expenseStore';
import { useAccountStore } from '@/store/accountStore';
import { AnalyticsBreakdownItem, ExpenseAnalytics } from '@/types';

const ranges = [
  { label: "Today", value: "current_day" },
  { label: "Current Month", value: "current_month" },
  { label: "Last Month", value: "last_month" },
  { label: "Last 3 Months", value: "last_3_months" },
  { label: "All Time", value: "all_time" },
];

const breakdownColors = ['#6366F1', '#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444'];

const emptyAnalytics: ExpenseAnalytics = {
  summary: {
    totalSpend: 0,
    totalTransactions: 0,
    averageDailySpend: 0,
    activeDays: 0,
  },
  categoryBreakdown: [],
  accountBreakdown: [],
  insights: {
    largestExpense: null,
    topWeekday: null,
    highestCategory: null,
    topAccount: null,
  },
};

const formatCurrency = (value: number) => `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const formatDate = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toDateString();
};

function BreakdownSection({
  title,
  subtitle,
  items,
  colorScheme,
}: {
  title: string;
  subtitle: string;
  items: AnalyticsBreakdownItem[];
  colorScheme: 'light' | 'dark' | null;
}) {
  return (
    <View
      className="mb-4 rounded-3xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
      style={{
        shadowColor: colorScheme === 'dark' ? 'transparent' : '#0F172A',
        shadowOpacity: colorScheme === 'dark' ? 0 : 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: colorScheme === 'dark' ? 0 : 2,
      }}
    >
      <Text className="text-lg font-semibold text-gray-900 dark:text-white">{title}</Text>
      <Text className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</Text>

      {items.length === 0 ? (
        <Text className="py-6 text-center text-sm font-medium text-gray-500 dark:text-gray-400">
          No spending data available for this filter.
        </Text>
      ) : (
        <View className="mt-4 gap-4">
          {items.map((item, index) => {
            const barColor = breakdownColors[index % breakdownColors.length];
            return (
              <View key={`${title}-${item.key}`}>
                <View className="mb-2 flex-row items-center justify-between">
                  <Text className="flex-1 pr-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {item.label}
                  </Text>
                  <Text className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                    {formatCurrency(item.amount)}
                  </Text>
                </View>
                <View className="h-3 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
                  <View
                    style={{
                      width: `${Math.max(item.percentage, item.percentage > 0 ? 6 : 0)}%`,
                      backgroundColor: barColor,
                      height: '100%',
                      borderRadius: 999,
                    }}
                  />
                </View>
                <Text className="mt-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                  {item.percentage.toFixed(1)}% of total spend
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

export default function HistoryAnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme() || null;
  const backcolor = colorScheme === "light" ? "white" : "#111827";
  const textColor = colorScheme === "light" ? "black" : "#d1d5db";
  const rangeDropdownRef = useRef<IDropdownRef>(null);
  const requestRef = useRef(0);

  const { selectedRange, setSelectedRange } = useExpenseStore();
  const { accounts, setAccounts, selectedAccountId, setSelectedAccountId } = useAccountStore();

  const [analytics, setAnalytics] = useState<ExpenseAnalytics>(emptyAnalytics);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (accounts.length === 0) {
      fetchAccountsApi().then((fetched) => {
        if (fetched.length > 0) setAccounts(fetched);
      });
    }
  }, [accounts.length, setAccounts]);

  const fetchAnalytics = useCallback(async () => {
    const requestId = ++requestRef.current;
    setLoading(true);

    try {
      const params = new URLSearchParams();
      if (selectedAccountId) params.append('sourceId', selectedAccountId);
      if (selectedRange && selectedRange !== 'all_time') params.append('range', selectedRange);

      const queryString = params.toString();
      const response = await api.get(`/expense/stats/analytics${queryString ? `?${queryString}` : ''}`);

      if (requestId !== requestRef.current) return;
      setAnalytics(response.data || emptyAnalytics);
    } catch (error) {
      if (requestId === requestRef.current) {
        console.error('Failed to fetch analytics', error);
        setAnalytics(emptyAnalytics);
      }
    } finally {
      if (requestId === requestRef.current) {
        setLoading(false);
      }
    }
  }, [selectedAccountId, selectedRange]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const accountChips = useMemo(() => ([
    { _id: null, name: "All", isDefault: false },
    ...accounts,
  ]), [accounts]);

  const summaryCards = [
    { label: 'Total spent', value: formatCurrency(analytics.summary.totalSpend), icon: 'trending-down' as const },
    { label: 'Avg daily spend', value: formatCurrency(analytics.summary.averageDailySpend), icon: 'calendar' as const },
    { label: 'Spend entries', value: analytics.summary.totalTransactions.toString(), icon: 'hash' as const },
    { label: 'Active days', value: analytics.summary.activeDays.toString(), icon: 'activity' as const },
  ];

  const insightCards = [
    analytics.insights.largestExpense && {
      title: 'Largest spend',
      value: formatCurrency(analytics.insights.largestExpense.amount),
      note: `${analytics.insights.largestExpense.category} · ${analytics.insights.largestExpense.details || 'Expense'} · ${formatDate(analytics.insights.largestExpense.date)}`,
      icon: 'arrow-up-right' as const,
    },
    analytics.insights.topWeekday && {
      title: 'Highest spend day',
      value: analytics.insights.topWeekday.day,
      note: `${formatCurrency(analytics.insights.topWeekday.amount)} spent on average busiest day`,
      icon: 'bar-chart-2' as const,
    },
    analytics.insights.highestCategory && {
      title: 'Top category',
      value: analytics.insights.highestCategory.label,
      note: `${formatCurrency(analytics.insights.highestCategory.amount)} · ${analytics.insights.highestCategory.percentage.toFixed(1)}% of spend`,
      icon: 'pie-chart' as const,
    },
    accounts.length>1 && analytics.insights.topAccount && {
      title: 'Top account',
      value: analytics.insights.topAccount.label,
      note: `${formatCurrency(analytics.insights.topAccount.amount)} · ${analytics.insights.topAccount.percentage.toFixed(1)}% of spend`,
      icon: 'credit-card' as const,
    },
  ].filter(Boolean) as { title: string; value: string; note: string; icon: keyof typeof Feather.glyphMap }[];

  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-900" style={{ paddingTop: insets.top }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 80 }}
      >
        <View className="mb-5 flex-row items-center justify-between">
          <TouchableOpacity
            onPress={() => router.back()}
            className="h-11 w-11 items-center justify-center rounded-full bg-white dark:bg-gray-900"
          >
            <Feather name="arrow-left" size={20} color={textColor} />
          </TouchableOpacity>
          <View className="flex-1 px-4">
            <Text className="text-center text-xl font-semibold text-gray-900 dark:text-white">
              Spending analytics
            </Text>
          </View>
          <View className="h-11 w-11" />
        </View>

        <View className="mb-5 flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() => rangeDropdownRef.current?.open()}
            className="rounded-full bg-gray-200 px-3 py-2 dark:bg-gray-800"
            style={{ minWidth: 130 }}
          >
            <Dropdown
              ref={rangeDropdownRef}
              data={ranges}
              labelField="label"
              valueField="value"
              value={selectedRange}
              onChange={(item) => setSelectedRange(item.value)}
              style={{ minWidth: 120, pointerEvents: "none" }}
              selectedTextStyle={{ color: textColor, fontSize: 13, fontWeight: "600" }}
              containerStyle={{ backgroundColor: backcolor, borderRadius: 12, borderWidth: 0 }}
              itemTextStyle={{ color: textColor, fontSize: 13 }}
              activeColor={backcolor}
              iconColor={textColor}
            />
          </TouchableOpacity>

          {accounts.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ gap: 8 }}>
              {accountChips.map((acc) => {
                const isSelected = acc._id === selectedAccountId;
                return (
                  <TouchableOpacity
                    key={acc._id ?? "all"}
                    onPress={() => setSelectedAccountId(acc._id)}
                    className={`rounded-full border px-3 py-2 ${isSelected
                      ? 'border-indigo-600 bg-indigo-600'
                      : 'border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800'
                      }`}
                  >
                    <Text className={`text-xs font-medium ${isSelected ? 'text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                      {acc.name}{acc.isDefault ? ' ★' : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

        {loading ? (
          <View className="py-24 items-center justify-center">
            <ActivityIndicator size="large" />
            <Text className="mt-4 text-sm font-medium text-gray-500 dark:text-gray-400">
              Loading analytics...
            </Text>
          </View>
        ) : (
          <>
            <View className="mb-4 flex-row flex-wrap justify-between">
              {summaryCards.map((card) => (
                <View
                  key={card.label}
                  className="mb-3 w-[48%] rounded-3xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
                >
                  <View className="mb-3 h-10 w-10 items-center justify-center rounded-2xl bg-indigo-100 dark:bg-indigo-950">
                    <Feather name={card.icon} size={18} color="#6366F1" />
                  </View>
                  <Text className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {card.label}
                  </Text>
                  <Text className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">
                    {card.value}
                  </Text>
                </View>
              ))}
            </View>

            <BreakdownSection
              title="Category wise spending"
              subtitle="Progress based on debit transactions in the selected filter"
              items={analytics.categoryBreakdown}
              colorScheme={colorScheme}
            />

            {accounts.length > 1 && (
              <BreakdownSection
                title="Account wise spending"
                subtitle="See which account is used most for expenses"
                items={analytics.accountBreakdown}
                colorScheme={colorScheme}
              />
            )}

            <View
              className="rounded-3xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
              style={{
                shadowColor: colorScheme === 'dark' ? 'transparent' : '#0F172A',
                shadowOpacity: colorScheme === 'dark' ? 0 : 0.08,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 6 },
                elevation: colorScheme === 'dark' ? 0 : 2,
              }}
            >
              <Text className="text-lg font-semibold text-gray-900 dark:text-white">
                Spending insights
              </Text>
              <Text className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Helpful takeaways from your spending pattern
              </Text>

              {insightCards.length === 0 ? (
                <Text className="py-6 text-center text-sm font-medium text-gray-500 dark:text-gray-400">
                  Add some expenses to unlock insights here.
                </Text>
              ) : (
                <View className="mt-4 gap-3">
                  {insightCards.map((card) => (
                    <View
                      key={card.title}
                      className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-800"
                    >
                      <View className="flex-row items-start">
                        <View className="mr-3 mt-0.5 h-10 w-10 items-center justify-center rounded-2xl bg-indigo-100 dark:bg-indigo-950">
                          <Feather name={card.icon} size={17} color="#6366F1" />
                        </View>
                        <View className="flex-1">
                          <Text className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            {card.title}
                          </Text>
                          <Text className="mt-1 text-base font-semibold text-gray-900 dark:text-white">
                            {card.value}
                          </Text>
                          <Text className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                            {card.note}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
