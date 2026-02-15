import { View, Text, FlatList, Dimensions, useColorScheme, TouchableOpacity } from 'react-native';
import { useEffect, useState } from 'react';
import { LineChart } from 'react-native-chart-kit';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '@/api/api';
import { ActivityIndicator } from 'react-native-paper';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import DeleteModal from '../home/DeleteModal';
import { useAdminStore } from '@/store/adminStore';

type Transaction = {
  _id: string;
  amount: number;
  date: string; // e.g., "Sun Apr 06 2025"
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

export default function TransactionHistory() {
  const { deleteUser, setCachedUsers, totalUserBalance, cachedUsers, LastSyncedAt } = useAdminStore();

  const [users, setUsers] = useState<User[]>(cachedUsers);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(cachedUsers.length === 0);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const router = useRouter()

  useEffect(() => {
    if (cachedUsers.length > 0) {
      setUsers(cachedUsers);
      setInitialLoading(false);
    }
  }, [cachedUsers]);

  // Process transactions for monthly segregation and graph data
  const getMonthlyData = () => {
    const monthlyData: { [key: string]: User[] } = {};
    users.slice().reverse().forEach((user: User) => {
      const date = new Date(user.createdAt);
      const monthYear = `${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`;
      if (!monthlyData[monthYear]) {
        monthlyData[monthYear] = [];
      }
      monthlyData[monthYear].push(user);
    });
    return monthlyData;
  };

  const monthlyData = getMonthlyData();

  const fetchUsers = async () => {

    if (loading || !hasMore) return;

    setLoading(true);
    try {
      const limit = 10;
      const response = await api.get(`/admin/users/?offset=${offset}&limit=${limit}`);

      setUsers(prev => {
        const merged = [...prev, ...response.data.users];
        const unique = merged.filter((u, idx, self) => idx === self.findIndex((x) => x._id === u._id));
        return unique.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      });
      setCachedUsers(response.data.users, response.data.totalUserBalance);
      setOffset(prev => prev + limit);
      setHasMore(response.data.hasMore);
    } catch (err) {
      console.error('Failed to fetch users', err);
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    if (users.length < 10) {
      fetchUsers()
    }
  }, []);

  const handleUserPress = (user: User) => {
    setSelectedUser(
      selectedUser?._id === user._id ? null : user
    );
  }
  const handleDelete = async () => {
    if (selectedUser) {
      try {
        const response = await api.delete(`/admin/delete/${selectedUser._id}`)
        setUsers(prev => prev.filter((item) => item._id !== selectedUser._id))
        deleteUser(selectedUser)

      } catch (error) {
        console.error(error);

      }
    }
    setShowDeleteModal(false)
  }
  const colorScheme = useColorScheme()
  return (
    <SafeAreaView className="flex-1 dark:bg-gray-900 p-5 pb-20">

      {/* Users List */}
      {initialLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" />
        </View>
      ) : users.length > 0 ?
        <FlatList
          data={Object.keys(monthlyData).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())}
          renderItem={({ item: monthYear }) => (
            <View className="mb-6">
              <View className='flex-row items-center'>
                <Text className="dark:text-white text-lg font-semibold mb-2 pr-3">{monthYear}</Text>
                <Text className='bg-gray-500 h-[0.01px] w-full'></Text>
              </View>
              <FlatList
                data={monthlyData[monthYear]}
                renderItem={({ item }) => (
                  <View className="mb-3" key={item._id}>
                    <TouchableOpacity
                      className="dark:bg-gray-800 bg-white dark:border-0 border border-gray-200 p-4 rounded-lg dark:shadow-none shadow-lg"
                      onPress={() => handleUserPress(item)}
                    >
                      <View className="flex-row justify-between">
                        <Text className="dark:text-gray-100">{item.name} </Text>
                        <Text className="dark:text-white">
                          ₹{item.netBalance}
                        </Text>
                      </View>
                      <View className="flex flex-row justify-between items-center mt-1">
                        <Text className="dark:text-gray-400 text-gray-700 text-sm">{new Date(item.createdAt).toDateString()}</Text>
                      </View>
                    </TouchableOpacity>

                    {selectedUser?._id === item._id && (
                      <View className="flex-row">
                        <TouchableOpacity className="dark:bg-red-600 bg-red-300 flex-row gap-2 -mt-1 py-2 px-4 items-center justify-start w-1/2" style={{ borderBottomLeftRadius: 8, }} onPress={() => setShowDeleteModal(true)}>
                          <FontAwesome name="trash" size={15} color={`${colorScheme == 'dark' ? 'white' : 'black'}`} />
                          <Text className="dark:text-white text-sm font-semibold">Delete User</Text>
                        </TouchableOpacity>
                        <TouchableOpacity className="dark:bg-indigo-900 bg-indigo-300 flex-row gap-2 -mt-1 py-2 px-4 items-center justify-start w-1/2" style={{ borderBottomRightRadius: 8, }} onPress={() => router.push(`/admin/adminUserView?userId=${item._id}`)}>
                          <FontAwesome name="eye" size={15} color={`${colorScheme == 'dark' ? 'white' : 'black'}`} />
                          <Text className="dark:text-white text-sm font-semibold">View User</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}
                keyExtractor={(item) => item._id}
              />
            </View>
          )}
          keyExtractor={(item) => item}
          showsVerticalScrollIndicator={false}
          onEndReached={fetchUsers}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loading ? <ActivityIndicator size="large" /> : null}
        />
        :
        <Text className="text-gray-600 dark:text-gray-300 font-semibold text-center py-5 text-lg">No data available</Text>
      }
      {showDeleteModal && <DeleteModal setShow={setShowDeleteModal} handleDelete={handleDelete} />}
    </SafeAreaView>
  );
}