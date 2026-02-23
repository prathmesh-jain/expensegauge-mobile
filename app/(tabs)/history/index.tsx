import { View, Text, FlatList, Dimensions, useColorScheme, RefreshControl, ScrollView } from 'react-native';
import { useEffect, useState, useRef } from 'react';
import { useExpenseStore } from '../../../store/expenseStore';
import { LineChart } from 'react-native-chart-kit';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '@/api/api';
import { ActivityIndicator } from 'react-native-paper';
import { useAuthStore } from '@/store/authStore';
import ExpenseItem from '@/app/expenseModal/ExpenseItem';
import DeleteModal from '../home/DeleteModal';
import { processQueue } from '@/api/syncQueue';

type Transaction = {
  _id: string;
  amount: number;
  date: string;
  details: string;
  type: string;
  category: string;
  isSynced: boolean;
  clientId?: string;
}


const screenWidth = Dimensions.get('window').width;

export default function TransactionHistory() {
  const userRole = useAuthStore((state) => state.role);
  const viewMode = useAuthStore((state) => state.viewMode);
  const insets = useSafeAreaInsets();

  const { setCachedExpenses, removeExpense, LastSyncedAt, cachedExpenses, cachedStats, setCachedStats } = useExpenseStore();
  const [expenses, setExpenses] = useState<Transaction[]>(cachedExpenses);

  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(false);
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
        fetchStats(); // Update stats on delete
      } catch (error) {
        console.error(error);
      }
    }
    setShowDeleteModal(false)
  }

  // Group by Month for List
  const getMonthlyData = () => {
    const monthlyData: { [key: string]: Transaction[] } = {};
    const sortedExpenses = [...expenses].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    sortedExpenses.forEach((transaction: Transaction) => {
      const date = new Date(transaction.date);
      const month = date.toLocaleString('default', { month: 'long' });
      const year = date.getFullYear();
      const monthYear = `${month.substring(0, 3)} ${year}`;

      if (!monthlyData[monthYear]) {
        monthlyData[monthYear] = [];
      }
      monthlyData[monthYear].unshift(transaction);
    });

    return monthlyData;
  };

  const monthlyList = getMonthlyData();

  const scrollViewRef = useRef<ScrollView>(null);
  const colorScheme = useColorScheme()

  const fetchStats = async () => {
    try {
      const res = await api.get('/expense/stats/monthly');
      // Backend returns { labels: [], datasets: [...], raw: { credits: [], debits: [] } }
      // We need to shape it for the chart
      const { labels, raw } = res.data;

      // Prepend dummy for chart config as per original
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
      setCachedStats(processedStats);
    } catch (e) {
      console.error("Error fetching stats", e);
    } finally {
      setStatsLoading(false);
    }
  }

  const fetchExpenses = async (isRefresh = false) => {
    if (loading || (!isRefresh && !hasMore)) return;

    setLoading(true);
    if (isRefresh) setRefreshing(true);

    try {
      const limit = 10;
      const currentOffset = isRefresh ? 0 : offset;
      const response = await api.get(`/expense/get-expense/?offset=${currentOffset}&limit=${limit}`);

      const fetched = response.data.expenses;

      const merged = isRefresh || offset === 0 ? fetched : [...expenses, ...fetched];
      const unique = merged.filter((item: Transaction, index: number, self: Transaction[]) =>
        index === self.findIndex((t: Transaction) => t._id === item._id)
      );
      const sorted = unique.sort((a: Transaction, b: Transaction) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setExpenses(sorted);

      if (currentOffset === 0) {
        setCachedExpenses(sorted.slice(0, 21), response.data.totalBalance);
        // Force sync immediately after refresh to flush any pending mutations
        processQueue(true);
      }


      setOffset(isRefresh ? limit : offset + limit);
      setHasMore(response.data.hasMore);
    } catch (err) {
      console.error('Failed to fetch expenses', err);
    } finally {
      setLoading(false);
      setRefreshing(false)
    }
  };

  const handleRefresh = () => {
    fetchStats();
    fetchExpenses(true);
  };

  useEffect(() => {
    fetchExpenses()
    fetchStats();
  }, []);

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

  const renderHeader = () => (
    <View className="mb-6" style={{ backgroundColor: colorScheme == 'dark' ? '#1E293B' : 'white', borderRadius: 16, padding: 16 }}>
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
                  // dataset.color is a function, we call it to check value
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
  );

  return (
    <View className="flex-1 dark:bg-gray-900" style={{ paddingTop: insets.top }}>
      <FlatList
        data={Object.keys(monthlyList).reverse()} // Newest months first
        ListHeaderComponent={renderHeader}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 80 }} // Extra padding for tab bar
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        renderItem={({ item: monthYear }) => (
          <View className="mb-6">
            <View className='flex-row items-center'>
              <Text className="dark:text-white text-lg font-semibold mb-2 pr-3">{monthYear}</Text>
              <Text className='bg-gray-500 h-[0.01px] w-full'></Text>
            </View>
            <FlatList
              data={monthlyList[monthYear]}
              renderItem={({ item }) => (
                <ExpenseItem
                  item={item}
                  selectedId={selectedTransaction?._id || null}
                  type="user"
                  onSelect={handleTransactionPress}
                  onDeletePress={() => setShowDeleteModal(true)}
                />
              )}
              keyExtractor={(item) => item._id}
            />
          </View>
        )}
        keyExtractor={(item) => item}
        showsVerticalScrollIndicator={false}
        onEndReached={() => fetchExpenses()}
        onEndReachedThreshold={0.5}
        ListFooterComponent={loading ? <ActivityIndicator size="large" /> : null}
      />
      {showDeleteModal && <DeleteModal setShow={setShowDeleteModal} handleDelete={handleDelete} />}
    </View>
  );
}