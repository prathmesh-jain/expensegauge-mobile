import { View, Text, FlatList, Dimensions, useColorScheme, RefreshControl } from 'react-native';
import { useEffect, useState, useRef } from 'react';
import { ScrollView } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import api from '@/api/api';
import { ActivityIndicator } from 'react-native-paper';
import { useLocalSearchParams } from 'expo-router';
import { useAdminStore } from '@/store/adminStore';
import ExpenseItem from '../expenseModal/ExpenseItem';
import DeleteModal from '../(tabs)/home/DeleteModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Transaction = {
  _id: string;
  amount: number;
  date: string;
  details: string;
  type: string;
  category: string;
  isSynced: string | null;
}
type User = {
  _id: string;
  netBalance: number;
  name: string;
  createdAt: string;
  expenses: Transaction[];
};

const screenWidth = Dimensions.get('window').width;

export default function TransactionHistory() {
  const { userindex, userId } = useLocalSearchParams<Record<string, string>>()
  const { activeUser, setActiveUser, statsCache, setStatsCache, updateUserFromServer } = useAdminStore();
  const cachedUsers = useAdminStore((state) => state.cachedUsers);
  const { removeUserExpenseByAdmin } = useAdminStore();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    let foundUser = null;
    if (userId) foundUser = cachedUsers.find(u => u._id === userId) || null;
    else if (userindex) foundUser = cachedUsers[parseInt(userindex)] || null;

    if (foundUser) {
      setActiveUser(foundUser);
    }
  }, [userId, userindex]);

  const user = activeUser;
  const [expenses, setExpenses] = useState<Transaction[]>(user?.expenses || []);

  useEffect(() => {
    if (!user?.expenses) return;
    setExpenses((prev) => {
      const merged = [...user.expenses, ...prev];
      const unique = merged.filter((item, index, self) =>
        index === self.findIndex((t) => t._id === item._id)
      );
      return [...unique].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    });
  }, [user?.expenses]);

  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Stats State for Admin
  const [stats, setStats] = useState<any>((userId && statsCache[userId]) || { labels: [], datasets: [] });
  const [statsLoading, setStatsLoading] = useState(!userId || !statsCache[userId]?.labels?.length);

  const fetchExpenses = async (isRefresh = false) => {
    const targetId = userId || user?._id;
    if (!targetId || loading || (!isRefresh && !hasMore)) return;

    setLoading(true);
    if (isRefresh) setRefreshing(true);

    try {
      const limit = 10;
      const currentOffset = isRefresh ? 0 : offset;
      const response = await api.get(`/admin/expenses/${targetId}/?offset=${currentOffset}&limit=${limit}`);

      setExpenses(prev => {
        const fetched = response.data.expenses;
        const merged = isRefresh || currentOffset === 0 ? fetched : [...prev, ...fetched];
        // Deduplicate
        const unique = merged.filter((item: Transaction, index: number, self: Transaction[]) =>
          index === self.findIndex((t: Transaction) => t._id === item._id)
        );
        return [...unique].sort((a: Transaction, b: Transaction) => new Date(b.date).getTime() - new Date(a.date).getTime());
      });

      updateUserFromServer({ ...response.data.user });

      setOffset(isRefresh ? limit : currentOffset + limit);
      setHasMore(response.data.hasMore);
    } catch (err) {
      console.error('Failed to fetch expenses', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    fetchStats();
    fetchExpenses(true);
  };

  useEffect(() => {
    fetchExpenses();
    fetchStats();
  }, [userId]);

  const fetchStats = async () => {
    if (!userId) return;
    try {
      // Use POST as per admin route for stats: router.post('/stats/user', getMonthlyStats)
      const res = await api.post('/admin/stats/user', { userId });
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
      if (userId) setStatsCache(userId, processedStats);
    } catch (e) {
      console.error("Error fetching stats", e);
    } finally {
      setStatsLoading(false);
    }
  }

  const handleTransactionPress = (transaction: Transaction) => {
    setSelectedTransaction(
      selectedTransaction?._id === transaction._id ? null : transaction
    );
  }
  const handleDelete = async () => {
    if (selectedTransaction && user) {
      try {
        await api.delete(`/admin/expense/${user._id}/${selectedTransaction._id}`)
        setExpenses(prev => prev.filter((item) => item._id !== selectedTransaction._id))
        removeUserExpenseByAdmin(user._id, selectedTransaction)
        fetchStats(); // Update stats
      } catch (error) {
        console.error(error);
      }
    }
    setShowDeleteModal(false)
  }

  const getMonthlyData = () => {
    const monthlyData: { [key: string]: Transaction[] } = {};
    // Sort Newest First (Desc) - backend does too, but expenses here comes from Store/Local
    const sorted = [...expenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    sorted.forEach((transaction: Transaction) => {
      const date = new Date(transaction.date);
      const monthYear = `${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`;
      if (!monthlyData[monthYear]) {
        monthlyData[monthYear] = [];
      }
      monthlyData[monthYear].push(transaction); // Already sorted, so pushing is fine
    });
    return monthlyData;
  };

  const monthlyData = getMonthlyData();

  const tooltipTimeout = useRef<any>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    value: number;
    visible: boolean;
    type: 'Debit' | 'Credit';
  } | null>(null);
  const colorScheme = useColorScheme()


  const chartConfig = {
    backgroundGradientFrom: '#1E293B',
    backgroundGradientTo: '#1E293B',
    decimalPlaces: 0,
    color: (opacity = 1) => `${colorScheme == 'dark' ? `rgba(255, 255, 255, ${opacity})` : `rgba(0, 0, 0, ${opacity})`}`,
    labelColor: (opacity = 1) => `${colorScheme == 'dark' ? `rgba(255, 255, 255, ${opacity})` : `rgba(0, 0, 0, ${opacity})`}`,
    propsForDots: {
      r: '5',
      strokeWidth: '1',
      stroke: '#ffa726',
    },
  };

  const chartWidth = Math.max(screenWidth * 0.9, (stats.labels.length - 1) * (screenWidth * 0.3));


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
        data={Object.keys(monthlyData)}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: insets.bottom + 20 }}
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
              data={monthlyData[monthYear]}
              renderItem={({ item }) => (
                <ExpenseItem
                  item={item}
                  selectedId={selectedTransaction?._id || null}
                  type="admin"
                  onSelect={handleTransactionPress}
                  onDeletePress={() => setShowDeleteModal(true)
                  }
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