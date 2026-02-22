import { Link, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { ActivityIndicator, FlatList, RefreshControl, Text, TouchableOpacity, View } from "react-native";
import { useEffect, useState } from "react";
import api from "@/api/api";
import { useAdminStore } from "@/store/adminStore";
import DeleteModal from "../(tabs)/home/DeleteModal";
import ExpenseItem from "../expenseModal/ExpenseItem";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Transaction = {
  _id: string;
  amount: number;
  date: string;
  details: string;
  type: string;
  category: string;
  isSynced: string | null;
};

export default function adminUserView() {
  const { userindex, userId } = useLocalSearchParams<Record<string, string>>()
  const { activeUser, setActiveUser, updateUserFromServer } = useAdminStore();
  const cachedUsers = useAdminStore((state) => state.cachedUsers);
  const { removeUserExpenseByAdmin } = useAdminStore()
  const insets = useSafeAreaInsets();

  // Set active user on mount or param change
  useEffect(() => {
    let foundUser = null;
    if (userId) foundUser = cachedUsers.find(u => u._id === userId) || null;
    else if (userindex) foundUser = cachedUsers[parseInt(userindex)] || null;

    // Only set if we found one or if we need to clear it (though clearing might be handled elsewhere)
    // Actually, we usually want to start with what we have.
    if (foundUser) {
      setActiveUser(foundUser);
    }
  }, [userId, userindex]);

  const user = activeUser;

  const [refreshing, setRefreshing] = useState(false)
  const [expenses, setExpenses] = useState<Transaction[]>(user?.expenses || []);
  const [initialLoading, setInitialLoading] = useState(!(user?.expenses && user.expenses.length > 0));

  useEffect(() => {
    if (user?.expenses) {
      setExpenses(user.expenses);
    }
  }, [user?.expenses]);

  const fetchExpenses = async () => {
    const targetId = userId || user?._id;
    if (!targetId || refreshing) return;
    setRefreshing(true)
    if(!expenses || expenses.length === 0) {
      setInitialLoading(true)
    }
    try {
      const response = await api.get(`/admin/expenses/${targetId}`);
      const sortedExpenses = [...response.data.expenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setExpenses(sortedExpenses);

      updateUserFromServer({ ...response.data.user, expenses: sortedExpenses });
    } catch (err) {
      console.error('Failed to fetch expenses', err);
    }
    setRefreshing(false)
    setInitialLoading(false)
  };

  useEffect(() => {
    fetchExpenses();
  }, [userId]);

  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

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
      } catch (error) {
        console.error(error);
      }
    }
    setShowDeleteModal(false)
  }

  const router = useRouter();
  const navigate = useNavigation()

  useEffect(() => {
    if (user) {
      navigate.setOptions({
        headerTitle: user.name,
      })
    }
  }, [user])

  if (!user) {
    return (
      <View className="flex-1 justify-center items-center dark:bg-gray-900">
        <ActivityIndicator size="large" />
      </View>
    )
  }

  return (
    <View className="flex-1 p-4 dark:bg-gray-900">
      <View className="dark:bg-indigo-600 bg-white rounded-xl p-6 mb-6 dark:border-0 border border-gray-300">
        <Text className="dark:text-white text-slate-800 text-lg">Total Balance</Text>
        <Text className="dark:text-white text-slate-800 text-4xl font-bold mt-2">{user.netBalance.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</Text>
      </View>

      <View className="flex-row justify-between mb-6">
        <Link href={`/expenseModal/credit?userIdAdmin=${user._id}`} asChild>
          <TouchableOpacity className="bg-green-600 py-3 px-6 rounded-lg flex-1 mr-2">
            <Text className="text-white text-center">Assign Balance</Text>
          </TouchableOpacity>
        </Link>
      </View>

      <View className="flex-row justify-between items-center my-4">
        <Text className="dark:text-white text-gray-800 text-lg font-semibold">Recent Transactions</Text>
        {expenses.length > 7 && <TouchableOpacity onPress={() => router.navigate(`/admin/adminUserHistory?userindex=${userindex}&userId=${user._id}`)}>
          <Text className="dark:text-indigo-400 text-indigo-800 dark:font-normal font-semibold text-lg">View All</Text>
        </TouchableOpacity>}
      </View>

      {initialLoading ? (
        <View className="flex-1 justify-center items-center p-3">
          <ActivityIndicator size="large" />
        </View>
      ) : expenses[0] &&
        <FlatList
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          data={expenses.slice(0, 7)}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={fetchExpenses} />
          }
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
          keyExtractor={item => item._id}
        />}
      {!initialLoading && !expenses[0] &&
        <View className="flex flex-row justify-center items-center p-3">
          <Text className="text-xl dark:text-white ">No transactions to show</Text>
        </View>
      }
      {showDeleteModal && <DeleteModal setShow={setShowDeleteModal} handleDelete={handleDelete} />}
    </View>
  );
}
