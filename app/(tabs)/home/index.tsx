import { Link, useRouter } from "expo-router";
import { FlatList, RefreshControl, ScrollView, Text, TouchableOpacity, useColorScheme, View } from "react-native";
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
import { useAccountStore } from "@/store/accountStore";
import { fetchAccountsApi } from "@/api/accountApi";

export default function Index() {
  const { setCachedExpenses, removeExpense, LastSyncedAt, cachedExpenses, totalBalance, selectedRange, setSelectedRange } = useExpenseStore();
  const { accounts, setAccounts, selectedAccountId, setSelectedAccountId } = useAccountStore();

  const expenses = useMemo(() => {
    let list = cachedExpenses.filter((expense) => isExpenseInRange(expense.date, selectedRange));
    if (selectedAccountId) {
      list = list.filter((expense) => expense.sourceId === selectedAccountId);
    }
    return list;
  }, [cachedExpenses, selectedRange, selectedAccountId]);

  const user = useAuthStore((state) => state.name);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [accountBalance, setAccountBalance] = useState<number | null>(null);

  const ranges = [
    { label: "Today", value: "current_day" },
    { label: "Current Month", value: "current_month" },
    { label: "Last Month", value: "last_month" },
    { label: "Last 3 Months", value: "last_3_months" },
    { label: "All Time", value: "all_time" },
  ];

  const router = useRouter();

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
    setAccountBalance(null);
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

      const accountParam = selectedAccountId ? `&sourceId=${selectedAccountId}` : '';
      const response = await api.get(`/expense/get-expense/?range=${selectedRange}&offset=0&limit=50${accountParam}`);
      const newExpenses = [...response.data.expenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      setAccountBalance(response.data.accountBalance ?? null);
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
  }, [selectedRange, selectedAccountId])

  // Load accounts on mount
  useEffect(() => {
    if (accounts.length === 0) {
      fetchAccountsApi().then((fetched) => {
        if (fetched.length > 0) setAccounts(fetched);
      });
    }
  }, []);

  const colorScheme = useColorScheme();
  const dropdownRef = useRef<IDropdownRef>(null);

  const backcolor = colorScheme === "light" ? "white" : "#111827";
  const textColor = colorScheme === "light" ? "black" : "#d1d5db";

  // Build account filter chips: "All" + each account
  const accountChips = [
    { _id: null, name: "All Accounts", isDefault: false },
    ...accounts,
  ];

  const showAccountNames = !selectedAccountId && accounts.length > 1;

  // Use account's currentBalance from API when a specific account is selected; otherwise totalBalance
  const displayedBalance = accountBalance !== null ? accountBalance : totalBalance;

  const getAccountName = (sourceId?: string | null) => {
    if (!sourceId) return '';
    const acc = accounts.find((a) => a._id === sourceId);
    return acc?.name || '';
  };
  return (
    <SafeAreaView className="flex-1 p-4 dark:bg-gray-900">
      <View className="px-2 py-2">
        <Text className="text-2xl font-bold text-gray-800 dark:text-white mb-4">Hello {user?.split(' ')[0]} 👋</Text>
      </View>

      {/* Account Filter Chips — shown when user has at least one account */}
      {accounts.length > 1 && (
        <View className="mb-3">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 4, gap: 8 }}>
            {accountChips.map((acc) => {
              const isSelected = acc._id === selectedAccountId;
              return (
                <TouchableOpacity
                  key={acc._id ?? "all"}
                  onPress={() => setSelectedAccountId(acc._id)}
                  className={`px-4 py-2 rounded-full border ${isSelected
                    ? 'bg-indigo-600 border-indigo-600'
                    : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600'
                    }`}
                >
                  <Text className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                    {acc.name}{acc.isDefault && !acc._id ? '' : acc.isDefault ? ' ★' : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Balance + Range Filter */}
      <View className="dark:bg-indigo-600 bg-white rounded-xl p-6 mb-6 dark:border-0 border border-gray-300">
        <View className="flex-row items-center justify-between">
          <Text className="dark:text-white text-slate-800 text-lg">
            {selectedAccountId
              ? (accounts.find((a) => a._id === selectedAccountId)?.name ?? "Balance")
              : "Total Balance"}
          </Text>
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
              onChange={(item) => setSelectedRange(item.value)}
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
        <Text className="dark:text-white text-slate-800 text-4xl font-bold mt-2">{displayedBalance?.toLocaleString('en-IN', { style: 'currency', currency: 'INR' }) ?? "0.00"}</Text>
        {LastSyncedAt && <Text className="dark:text-gray-300 text-slate-800 text-sm italic mt-1">Last Synced At {LastSyncedAt}</Text>}
        {syncMessage && (
          <Text className="dark:text-indigo-100 text-indigo-700 text-sm font-semibold mt-2">
            {syncMessage}
          </Text>
        )}
      </View>

      <View className="flex-row justify-between mb-6">
        <Link href={{ pathname: '/expenseModal/[type]', params: { type: 'credit', preselectedSourceId: selectedAccountId || '' } }} asChild>
          <TouchableOpacity className="bg-green-600 py-3 px-6 rounded-lg flex-1 mr-2">
            <Text className="text-white text-center">Add Credit</Text>
          </TouchableOpacity>
        </Link>
        <Link href={{ pathname: '/expenseModal/[type]', params: { type: 'debit', preselectedSourceId: selectedAccountId || '' } }} asChild>
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
              showAccountName={showAccountNames}
              accountName={getAccountName(item.sourceId)}
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
