import { View, Text, FlatList, Dimensions, useColorScheme, RefreshControl, ScrollView, TouchableOpacity } from 'react-native';
import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useExpenseStore } from '../../../store/expenseStore';
import { LineChart } from 'react-native-chart-kit';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '@/api/api';
import { ActivityIndicator } from 'react-native-paper';
import ExpenseItem from '@/app/expenseModal/ExpenseItem';
import DeleteModal from '../home/DeleteModal';
import { processQueue } from '@/api/syncQueue';
import { Transaction } from "@/types";
import { useAccountStore } from '@/store/accountStore';
import { fetchAccountsApi } from '@/api/accountApi';
import { Dropdown, IDropdownRef } from 'react-native-element-dropdown';

const screenWidth = Dimensions.get('window').width;

const ranges = [
  { label: "Today", value: "current_day" },
  { label: "Current Month", value: "current_month" },
  { label: "Last Month", value: "last_month" },
  { label: "Last 3 Months", value: "last_3_months" },
  { label: "All Time", value: "all_time" },
];

export default function TransactionHistory() {
  const insets = useSafeAreaInsets();

  const { setCachedExpenses, removeExpense, cachedExpenses, cachedStats, setCachedStats, selectedRange, setSelectedRange } = useExpenseStore();
  const { accounts, setAccounts, selectedAccountId, setSelectedAccountId } = useAccountStore();

  const [expenses, setExpenses] = useState<Transaction[]>(cachedExpenses);

  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Stats State
  const [stats, setStats] = useState<any>(cachedStats || { labels: [], datasets: [] });
  const [statsLoading, setStatsLoading] = useState(!cachedStats?.labels?.length);

  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    value: number;
    visible: boolean;
    type: 'Debit' | 'Credit';
  } | null>(null);

  const tooltipTimeout = useRef<any>(null);
  const rangeDropdownRef = useRef<IDropdownRef>(null);
  const statsRequestRef = useRef(0);
  const expensesRequestRef = useRef(0);
  const colorScheme = useColorScheme()
  const backcolor = colorScheme === "light" ? "white" : "#111827";
  const textColor = colorScheme === "light" ? "black" : "#d1d5db";

  useEffect(() => {
    setExpenses(prev => {
      if (cachedExpenses.length === 0) return [];

      const oldestCachedTime = new Date(cachedExpenses[cachedExpenses.length - 1].date).getTime();
      const cachedIds = new Set(cachedExpenses.map(exp => exp._id));

      const extraExpenses = prev.filter(exp => {
        const isNotCached = !cachedIds.has(exp._id);
        const isOlderThanCache = new Date(exp.date).getTime() < oldestCachedTime;
        return isNotCached && isOlderThanCache;
      });

      return [...cachedExpenses, ...extraExpenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    });
  }, [cachedExpenses]);

  // Load accounts if not yet loaded
  useEffect(() => {
    if (accounts.length === 0) {
      fetchAccountsApi().then((fetched) => {
        if (fetched.length > 0) setAccounts(fetched);
      });
    }
  }, []);

  const handleTransactionPress = (transaction: Transaction) => {
    setSelectedTransaction(
      selectedTransaction?._id === transaction._id ? null : transaction
    );
  }

  const handleDelete = async () => {
    if (selectedTransaction) {
      try {
        await api.delete(`/expense/${selectedTransaction._id}`)
        setExpenses(prev => prev.filter((item) => item._id !== selectedTransaction._id))
        removeExpense(selectedTransaction)
        fetchStats();
      } catch (error) {
        console.error(error);
      }
    }
    setShowDeleteModal(false)
  }

  // Filtered expenses for the list (apply account filter client-side on cached data too)
  const filteredExpenses = useMemo(() => {
    if (!selectedAccountId) return expenses;
    return expenses.filter((e) => e.sourceId === selectedAccountId);
  }, [expenses, selectedAccountId]);

  const flatData = useMemo(() => {
    const grouped: Record<string, Transaction[]> = {};

    filteredExpenses.forEach((transaction) => {
      const date = new Date(transaction.date);
      const month = date.toLocaleString("default", { month: "long" });
      const year = date.getFullYear();
      const monthYear = `${month.substring(0, 3)} ${year}`;

      if (!grouped[monthYear]) grouped[monthYear] = [];
      grouped[monthYear].push(transaction);
    });

    const result: any[] = [];

    Object.keys(grouped)
      .forEach((monthYear) => {
        result.push({
          type: "header",
          id: `header-${monthYear}`,
          title: monthYear,
        });

        grouped[monthYear].forEach((expense) => {
          result.push({
            type: "item",
            id: expense._id,
            data: expense,
          });
        });
      });

    return result;
  }, [filteredExpenses]);

  const scrollViewRef = useRef<ScrollView>(null);

  const fetchStats = async () => {
    setStatsLoading(true);
    const requestId = ++statsRequestRef.current;
    
    try {
      const params = new URLSearchParams();
      if (selectedAccountId) {
        params.append('sourceId', selectedAccountId);
      }
      if (selectedRange && selectedRange !== 'all_time') {
        params.append('range', selectedRange);
      }
      
      const queryString = params.toString();
      const res = await api.get(`/expense/stats/monthly${queryString ? '?' + queryString : ''}`);
      
      // Discard stale responses
      if (requestId !== statsRequestRef.current) {
        return;
      }
      
      const { labels, raw } = res.data;

      const chartLabels = ["", ...labels];
      const debitData = [0, ...(raw.debits || [])];
      const creditData = [0, ...(raw.credits || [])];

      const processedStats = {
        labels: chartLabels,
        datasets: [
          { data: debitData, color: () => '#EF4444' },
          { data: creditData, color: () => '#10B981' }
        ]
      };

      setStats(processedStats);
      // Only cache stats when no account filter is applied
      if (!selectedAccountId) {
        setCachedStats(processedStats);
      }
    } catch (e) {
      // Only log errors for current request
      if (requestId === statsRequestRef.current) {
        console.error("Error fetching stats", e);
      }
    } finally {
      // Only update loading state if this is the latest request
      if (requestId === statsRequestRef.current) {
        setStatsLoading(false);
      }
    }
  }

  const fetchExpenses = async (isRefresh = false) => {
    if (loading || (!isRefresh && !hasMore)) return;

    setLoading(true);
    if (isRefresh) setRefreshing(true);
    
    const requestId = ++expensesRequestRef.current;

    try {
      const limit = 10;
      const currentOffset = isRefresh ? 0 : offset;
      if (currentOffset === 0) {
        setSyncMessage("Checking pending offline changes...");
        const syncResult = await processQueue(true);
        if (!syncResult.completed) {
          setSyncMessage(
            `${syncResult.pending} pending change${syncResult.pending === 1 ? "" : "s"} still syncing. Refreshing...`
          );
        } else {
          setSyncMessage("Refreshing expenses...");
        }
      }

      const rangeParam = selectedRange !== 'all_time' ? `&range=${selectedRange}` : '';
      const accountParam = selectedAccountId ? `&sourceId=${selectedAccountId}` : '';
      const response = await api.get(`/expense/get-expense/?offset=${currentOffset}&limit=${limit}${rangeParam}${accountParam}`);
      
      // Discard stale responses
      if (requestId !== expensesRequestRef.current) {
        return;
      }

      const fetched = response.data.expenses;

      const merged = isRefresh || offset === 0 ? fetched : [...expenses, ...fetched];
      const unique = merged.filter((item: Transaction, index: number, self: Transaction[]) =>
        index === self.findIndex((t: Transaction) => t._id === item._id)
      );
      const sorted = unique.sort((a: Transaction, b: Transaction) => new Date(b.date).getTime() - new Date(a.date).getTime());

      if (currentOffset === 0) {
        setCachedExpenses(sorted.slice(0, 21), response.data.rangeBalance ?? response.data.totalBalance ?? 0, selectedRange);
        setExpenses(useExpenseStore.getState().cachedExpenses);
      } else {
        setExpenses(sorted);
      }

      setOffset(isRefresh ? limit : offset + limit);
      setHasMore(response.data.hasMore);
      setSyncMessage(null);
    } catch (err) {
      // Only log errors for current request
      if (requestId === expensesRequestRef.current) {
        console.error('Failed to fetch expenses', err);
        if (isRefresh || offset === 0) {
          setSyncMessage("Could not refresh. Showing cached expenses.");
        }
      }
    } finally {
      // Only update loading state if this is the latest request
      if (requestId === expensesRequestRef.current) {
        setLoading(false);
        setRefreshing(false)
      }
    }
  };

  const handleRefresh = () => {
    setOffset(0);
    setHasMore(true);
    fetchStats();
    fetchExpenses(true);
  };

  // Re-fetch when filters change
  useEffect(() => {
    setOffset(0);
    setHasMore(true);
    fetchExpenses(true);
    fetchStats();
  }, [selectedRange, selectedAccountId]);

  const chartWidth = Math.max(screenWidth * 0.9, (stats.labels.length - 1) * (screenWidth * 0.3));

  const chartConfig = {
    backgroundGradientFrom: '#1E293B',
    backgroundGradientTo: '#1E293B',
    decimalPlaces: 0,
    fromZero: true,
    color: (opacity = 1) => `${colorScheme == 'dark' ? `rgba(255, 255, 255, ${opacity})` : `rgba(0, 0, 0, ${opacity})`}`,
    labelColor: (opacity = 1) => `${colorScheme == 'dark' ? `rgba(255, 255, 255, ${opacity})` : `rgba(0, 0, 0, ${opacity})`}`,
    propsForDots: { r: '5', strokeWidth: '1', stroke: '#ffa726' },
  };

  // Account filter chips
  const accountChips = [
    { _id: null, name: "All", isDefault: false },
    ...accounts,
  ];

  const renderHeader = () => (
    <View className="mb-4">
      {/* Filters Row */}
      <View className="mb-4 flex-row items-center gap-3">
        {/* Range Dropdown */}
        <TouchableOpacity
          onPress={() => rangeDropdownRef.current?.open()}
          className="bg-gray-200 dark:bg-gray-800 px-3 py-2 rounded-full flex-row items-center"
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
            itemTextStyle={{ color: textColor }}
            activeColor={backcolor}
            iconColor={textColor}
          />
        </TouchableOpacity>

        {/* Account Filter Chips */}
        {accounts.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ gap: 8 }}>
            {accountChips.map((acc) => {
              const isSelected = acc._id === selectedAccountId;
              return (
                <TouchableOpacity
                  key={acc._id ?? "all"}
                  onPress={() => setSelectedAccountId(acc._id)}
                  className={`px-3 py-2 rounded-full border ${isSelected
                    ? 'bg-indigo-600 border-indigo-600'
                    : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600'
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

      {/* Chart */}
      <View className="mb-6" style={{ backgroundColor: colorScheme == 'dark' ? '#1E293B' : 'white', borderRadius: 16, padding: 16 }}>
        {syncMessage && (
          <Text className="dark:text-indigo-200 text-indigo-700 text-sm font-semibold mb-3">
            {syncMessage}
          </Text>
        )}
        {!statsLoading && stats.labels.length > 1 ? (
          <>
            <Text className="dark:text-white text-lg font-semibold mb-2">Transaction Trends</Text>
            <ScrollView
              horizontal
              ref={scrollViewRef}
              showsHorizontalScrollIndicator={false}
              onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
              onScrollBeginDrag={() => setTooltip(null)}
            >
              <View style={{ position: 'relative' }}>
                <LineChart
                  data={stats}
                  width={chartWidth}
                  height={280}
                  chartConfig={chartConfig}
                  bezier
                  transparent
                  style={{ borderRadius: 16, marginHorizontal: -13 }}
                  onDataPointClick={({ x, y, value, dataset }) => {
                    const colorVal = dataset.color ? dataset.color(1) : '';
                    const type = colorVal === '#EF4444' ? 'Debit' : 'Credit';
                    if (tooltipTimeout.current) clearTimeout(tooltipTimeout.current);
                    setTooltip({ x, y, value, type, visible: true });
                    tooltipTimeout.current = setTimeout(() => setTooltip(null), 3000);
                  }}
                />

                {tooltip && tooltip.visible && (
                  <View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      left: tooltip.x - 45,
                      top: tooltip.y < 70 ? tooltip.y + 15 : tooltip.y - 65,
                      backgroundColor: 'rgba(30, 41, 59, 0.95)',
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: tooltip.type === 'Debit' ? '#EF4444' : '#10B981',
                      alignItems: 'center',
                      zIndex: 100,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.3,
                      shadowRadius: 4.65,
                      elevation: 8,
                    }}
                  >
                    <Text style={{ color: 'white', fontSize: 13, fontWeight: 'bold' }}>
                      {tooltip.type}
                    </Text>
                    <Text style={{ color: 'white', fontSize: 15, fontWeight: '900', marginTop: 2 }}>
                      ₹{tooltip.value.toLocaleString('en-IN')}
                    </Text>
                    <View
                      style={{
                        position: 'absolute',
                        bottom: tooltip.y < 70 ? undefined : -6,
                        top: tooltip.y < 70 ? -6 : undefined,
                        width: 12,
                        height: 12,
                        backgroundColor: 'rgba(30, 41, 59, 0.95)',
                        borderRightWidth: 1,
                        borderBottomWidth: 1,
                        borderTopWidth: 0,
                        borderLeftWidth: 0,
                        borderColor: tooltip.type === 'Debit' ? '#EF4444' : '#10B981',
                        transform: [{ rotate: tooltip.y < 70 ? '225deg' : '45deg' }],
                      }}
                    />
                  </View>
                )}
              </View>
            </ScrollView>
          </>
        ) : (
          <Text className="text-gray-600 dark:text-gray-300 font-semibold text-center py-5 text-lg">
            {statsLoading ? "Loading Trends..." : "No data available"}
          </Text>
        )}
      </View>
    </View>
  );

  const showAccountNames = !selectedAccountId && accounts.length > 1;

  const getAccountName = (sourceId?: string | null) => {
    if (!sourceId) return '';
    const acc = accounts.find((a) => a._id === sourceId);
    return acc?.name || '';
  };

  const handleDeletePress = useCallback(() => {
    setShowDeleteModal(true);
  }, []);

  const renderTransactionItem = useCallback(
    ({ item }: any) => {
      if (item.type === "header") {
        return (
          <View className="mb-3 mt-6">
            <View className="flex-row items-center">
              <Text className="dark:text-white text-lg font-semibold pr-3">
                {item.title}
              </Text>
              <View className="bg-gray-500 h-[0.5px] flex-1" />
            </View>
          </View>
        );
      }

      return (
        <ExpenseItem
          item={item.data}
          selectedId={selectedTransaction?._id || null}
          type="user"
          onSelect={handleTransactionPress}
          onDeletePress={handleDeletePress}
          showAccountName={showAccountNames}
          accountName={getAccountName(item.data.sourceId)}
        />
      );
    },
    [selectedTransaction, showAccountNames, accounts]
  );

  return (
    <View className="flex-1 dark:bg-gray-900" style={{ paddingTop: insets.top }}>
      <FlatList
        data={flatData}
        renderItem={renderTransactionItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 80,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        }
        showsVerticalScrollIndicator={false}
        onEndReached={() => fetchExpenses()}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loading ? <ActivityIndicator size="large" /> : null
        }
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews
        updateCellsBatchingPeriod={50}
      />
      {showDeleteModal && <DeleteModal setShow={setShowDeleteModal} handleDelete={handleDelete} />}
    </View>
  );
}
