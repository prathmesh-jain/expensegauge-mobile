import { Link, useRouter } from "expo-router";
import { FlatList, RefreshControl, Text, TouchableOpacity, useColorScheme, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { isExpenseInRange, useExpenseStore } from '../../../store/expenseStore'
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import ExpenseItem from "@/app/expenseModal/ExpenseItem";
import DeleteModal from "./DeleteModal";
import api from "@/api/api";
import { processQueue } from "@/api/syncQueue";
import { Dropdown, IDropdownRef } from "react-native-element-dropdown";
import { Toast } from "toastify-react-native";
import { checkConnection } from "@/api/network";
import { Transaction } from "@/types";



export default function Index() {
  const { setCachedExpenses, removeExpense, LastSyncedAt, cachedExpenses, totalBalance, selectedRange, setSelectedRange } = useExpenseStore();
  const expenses = useMemo(
    () => cachedExpenses.filter((expense) => isExpenseInRange(expense.date, selectedRange)),
    [cachedExpenses, selectedRange]
  );

  const user = useAuthStore((state) => state.name);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const ranges = [
    { label: "Today", value: "current_day" },
    { label: "Current Month", value: "current_month" },
    { label: "Last Month", value: "last_month" },
    { label: "Last 3 Months", value: "last_3_months" },
    { label: "All Time", value: "all_time" },
  ];

  const router = useRouter();
  const handleRangeChange = async (range: string) => {
    if (range === selectedRange) return;
    const isConnected = await checkConnection();
    if (!isConnected) {
      Toast.info("You are offline. Range can be changed only when back online.");
      return;
    }
    setSelectedRange(range);
  };

  const handleTransactionPress = (transaction: Transaction) => {
    setSelectedTransaction(
      selectedTransaction?._id === transaction._id ? null : transaction
    );
  }
  const handleDelete = async () => {
    if (selectedTransaction) {
      try {
        await api.delete(`/expense/${selectedTransaction._id}`)
        removeExpense(selectedTransaction)

      } catch (error) {
        console.error(error);
      }
    }
    setShowDeleteModal(false)
  }


  const fetchExpenses = async () => {
    if (refreshing) return;
    setRefreshing(true)
    setSyncMessage("Checking pending offline changes...");
    try {
      const syncResult = await processQueue(true);
      if (!syncResult.completed) {
        setSyncMessage(
          `${syncResult.pending} pending change${syncResult.pending === 1 ? "" : "s"} still syncing. Refreshing...`
        );
      } else {
        setSyncMessage("Refreshing expenses...");
      }

      const response = await api.get(`/expense/get-expense/?range=${selectedRange}&offset=0&limit=50`);
      const newExpenses = [...response.data.expenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      setCachedExpenses(newExpenses, response.data.rangeBalance ?? response.data.totalBalance ?? 0, selectedRange);
      setSyncMessage(null);
    } catch (err) {
      console.error('Failed to fetch expenses', err);
      setSyncMessage("Could not refresh. Showing cached expenses.");
    } finally {
      setRefreshing(false)
    }
  };

  useEffect(() => {
    fetchExpenses()
  }, [selectedRange])
  const colorScheme = useColorScheme();
  const dropdownRef = useRef<IDropdownRef>(null);

  const backcolor = colorScheme === "light" ? "white" : "#111827";
  const textColor = colorScheme === "light" ? "black" : "#d1d5db";

  return (
    <SafeAreaView className="flex-1 p-4 dark:bg-gray-900">
      <View className="px-2 py-2">
        <Text className="text-2xl font-bold text-gray-800 dark:text-white mb-4">Hello {user?.split(' ')[0]} 👋</Text>
      </View>
      <View className="dark:bg-indigo-600 bg-white rounded-xl p-6 mb-6 dark:border-0 border border-gray-300">
        <View className="flex-row items-center justify-between">
          <Text className="dark:text-white text-slate-800 text-lg">Total Balance</Text>
          <TouchableOpacity
            onPress={() => dropdownRef.current?.open()}
            className="self-start bg-gray-100 dark:bg-indigo-500 px-3 py-1 rounded-full"
          >
            <Dropdown
              ref={dropdownRef}
              data={ranges}
              labelField="label"
              valueField="value"
              value={selectedRange}
              onChange={(item) => handleRangeChange(item.value)}
              style={{
                minWidth: 130,
                pointerEvents: "none",
              }}
              selectedTextStyle={{
                color: textColor,
                fontSize: 13,
                fontWeight: "600",
              }}
              containerStyle={{
                backgroundColor: backcolor,
                borderRadius: 12,
                borderWidth: 0,
              }}
              itemTextStyle={{
                color: textColor,
              }}
              activeColor={backcolor}
              iconColor={textColor}
            />
          </TouchableOpacity>
        </View>
        <Text className="dark:text-white text-slate-800 text-4xl font-bold mt-2">{totalBalance?.toLocaleString('en-IN', { style: 'currency', currency: 'INR' }) ?? "0.00"}</Text>
        {LastSyncedAt && <Text className="dark:text-gray-300 text-slate-800 text-sm italic mt-1">Last Synced At {LastSyncedAt}</Text>}
        {syncMessage && (
          <Text className="dark:text-indigo-100 text-indigo-700 text-sm font-semibold mt-2">
            {syncMessage}
          </Text>
        )}
      </View>

      <View className="flex-row justify-between mb-6">
        <Link href={'/expenseModal/credit'} asChild>
          <TouchableOpacity className="bg-green-600 py-3 px-6 rounded-lg flex-1 mr-2">
            <Text className="text-white text-center">Add Credit</Text>
          </TouchableOpacity>
        </Link>
        <Link href={'/expenseModal/debit'} asChild>
          <TouchableOpacity className="bg-red-600 py-3 px-6 rounded-lg flex-1 ml-2">
            <Text className="text-white text-center">Add Debit</Text>
          </TouchableOpacity>
        </Link>
      </View>
      <View className="flex-row justify-between items-center my-4 mb-2">
        <Text className="dark:text-white text-gray-800 text-lg font-semibold">Recent Transactions</Text>
        {expenses.length > 7 && <TouchableOpacity onPress={() => router.navigate('/(tabs)/history')}>
          <Text className="dark:text-indigo-400 text-indigo-800 dark:font-normal font-semibold text-lg">View All</Text>
        </TouchableOpacity>}
      </View>

      {expenses[0] &&
        <FlatList
          className="mb-16"
          showsVerticalScrollIndicator={false}
          data={expenses.slice(0, 7)}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={fetchExpenses} />
          }
          renderItem={({ item }) => (
            <ExpenseItem
              item={item}
              selectedId={selectedTransaction?._id || null}
              type="user"
              onSelect={handleTransactionPress}
              onDeletePress={() => setShowDeleteModal(true)}
            />
          )}
          keyExtractor={item => item._id}
        />}
      {!expenses[0] &&
        <View className="flex flex-row justify-center items-center p-3">
          <Text className="text-xl dark:text-white ">No transactions to show</Text>
        </View>
      }

      {showDeleteModal && <DeleteModal setShow={setShowDeleteModal} handleDelete={handleDelete} />}

    </SafeAreaView>
  );
}
