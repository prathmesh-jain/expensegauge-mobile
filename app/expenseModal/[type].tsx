import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Text,
  TouchableOpacity,
  View,
  TextInput,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
  useColorScheme,
  Modal,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Dropdown, IDropdownRef } from "react-native-element-dropdown";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Toast } from "toastify-react-native";
import { useExpenseStore } from "@/store/expenseStore";
import { useAdminStore } from "@/store/adminStore";
import { predictCategory } from "@/helper/categoryDetector";
import {
  addExpenseApi,
  editExpenseApi,
  editUserExpenseAdminApi,
  assignBalanceApi,
} from "@/api/expenseApi";
import { useAccountStore, AccountSource } from "@/store/accountStore";
import { fetchAccountsApi, createAccountApi } from "@/api/accountApi";

// ------------------ Constants ------------------
const categories = [
  { label: "Groceries", value: "Groceries" },
  { label: "Healthcare", value: "Healthcare" },
  { label: "Food & Dining", value: "Food & Dining" },
  { label: "Bills & Utilities", value: "Bills & Utilities" },
  { label: "Entertainment", value: "Entertainment" },
  { label: "Transport", value: "Transport" },
  { label: "Education", value: "Education" },
  { label: "Shopping", value: "Shopping" },
  { label: "Other", value: "Other" },
];

const ACCOUNT_TYPES: { label: string; value: AccountSource['type'] }[] = [
  { label: "Bank", value: "bank" },
  { label: "Cash", value: "cash" },
  { label: "Wallet", value: "wallet" },
  { label: "Credit Card", value: "credit_card" },
  { label: "Business", value: "business" },
];

const ADD_NEW_VALUE = "__add_new__";

const createLocalId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

// ------------------ Component ------------------
const ExpenseForm = () => {
  const { _id, type, userIdAdmin, ...params } = useLocalSearchParams<Record<string, string>>();
  const router = useRouter();
  const colorScheme = useColorScheme();

  const { addExpense, editExpense, markAsSynced } = useExpenseStore();
  const { assignBalance, editUserExpenseByAdmin, markAsSyncedAdmin } = useAdminStore();
  const { accounts, setAccounts, addAccount, getDefaultAccount } = useAccountStore();

  const dropdownRef = useRef<IDropdownRef>(null);
  const accountDropdownRef = useRef<IDropdownRef>(null);
  const timeoutRef = useRef<number | null>(null);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [containerPadding, setContainerPadding] = useState(0);

  // Unified form state
  const [form, setForm] = useState({
    amount: "",
    details: "",
    category: "",
    date: new Date(),
    sourceId: "" as string,
  });

  const updateForm = (field: keyof typeof form, value: any) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // New account modal state
  const [showNewAccountModal, setShowNewAccountModal] = useState(false);
  const [newAccName, setNewAccName] = useState("");
  const [newAccType, setNewAccType] = useState<AccountSource['type']>("bank");
  const [newAccBalance, setNewAccBalance] = useState("0");
  const [savingAccount, setSavingAccount] = useState(false);

  // Build dropdown items for accounts
  const accountItems = [
    ...accounts.map((a) => ({
      label: a.isDefault ? `${a.name} (Default)` : a.name,
      value: a._id,
      sublabel: a.type,
    })),
    { label: "+ Add New Account", value: ADD_NEW_VALUE, sublabel: "" },
  ];

  // Load accounts on mount
  useEffect(() => {
    if (accounts.length === 0) {
      fetchAccountsApi().then((fetched) => {
        if (fetched.length > 0) setAccounts(fetched);
      });
    }
  }, []);

  // Set default sourceId when accounts are available (use preselectedSourceId if provided)
  useEffect(() => {
    if (!form.sourceId && accounts.length > 0) {
      const preselected = (params as any).preselectedSourceId;
      if (preselected) {
        updateForm("sourceId", preselected);
      } else {
        const def = getDefaultAccount();
        if (def) updateForm("sourceId", def._id);
      }
    }
  }, [accounts]);

  // ------------------ Lifecycle ------------------
  useEffect(() => {
    if (_id) {
      setForm({
        amount: params.amount || "",
        details: params.details || "",
        category: params.category || "",
        date: new Date(params.date),
        sourceId: params.sourceId || "",
      });
    }
  }, [_id]);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setContainerPadding(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setContainerPadding(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // ------------------ Handlers ------------------
  const handleCategoryDetect = () => {
    const detected = predictCategory(form.details);
    if (detected) updateForm("category", detected);
    return detected || "";
  };

  const handleAccountChange = (value: string) => {
    if (value === ADD_NEW_VALUE) {
      setShowNewAccountModal(true);
      return;
    }
    updateForm("sourceId", value);
  };

  const handleSaveNewAccount = async () => {
    const trimmed = newAccName.trim();
    if (!trimmed) {
      Toast.error("Account name is required");
      return;
    }
    // Client-side duplicate check using normalized name
    const normalized = trimmed.toLowerCase().replace(/\s+/g, ' ');
    if (accounts.some((a) => a.normalizedName === normalized)) {
      Toast.error("An account with this name already exists");
      return;
    }
    setSavingAccount(true);
    try {
      const created = await createAccountApi({
        name: trimmed,
        type: newAccType,
        openingBalance: parseFloat(newAccBalance) || 0,
      });
      if (created) {
        addAccount(created);
        updateForm("sourceId", created._id);
        Toast.success("Account added");
      } else {
        Toast.error("Failed to create account");
      }
    } finally {
      setSavingAccount(false);
      setShowNewAccountModal(false);
      setNewAccName("");
      setNewAccType("bank");
      setNewAccBalance("0");
    }
  };

  const buildTransaction = useCallback(
    (overrides = {}) => {
      const transactionId = _id || createLocalId();
      return {
        _id: transactionId,
        type,
        details: form.details,
        amount: parseFloat(form.amount),
        category: form.category,
        date: form.date.toDateString(),
        createdAt: new Date().toISOString(),
        isSynced: false,
        clientId: createLocalId(),
        sourceId: form.sourceId || getDefaultAccount()?._id || null,
        ...overrides,
      };
    },
    [_id, type, form]
  );

  // ------------------ Submit Logic ------------------
  const handleAdminSubmit = () => {
    if (!form.details || !form.amount) {
      Toast.error("Please enter details and amount");
      return;
    }

    const isRedundant = _id &&
      form.details === (params.details || "") &&
      parseFloat(form.amount) === parseFloat(params.amount || "0") &&
      form.category === (params.category || "") &&
      form.date.toDateString() === new Date(params.date || "").toDateString();

    if (isRedundant) {
      router.back();
      return;
    }

    const transactionData = buildTransaction();
    try {
      if (_id) {
        editUserExpenseByAdmin(userIdAdmin, transactionData);
        editUserExpenseAdminApi(userIdAdmin, transactionData).then(() => {
          markAsSyncedAdmin(_id, _id, userIdAdmin);
        });
      } else {
        const assignData = { ...transactionData, type: 'assign', category: 'Added by Admin' };
        assignBalance(userIdAdmin, assignData);
        assignBalanceApi(
          userIdAdmin,
          form.details,
          form.date.toDateString(),
          parseFloat(form.amount),
          transactionData._id
        ).then((newId) => {
          if (newId) markAsSyncedAdmin(transactionData._id, newId, userIdAdmin);
        });
      }
      Toast.success("Request processed");
      router.back();
    } catch (error) {
      Toast.error("Something went wrong");
    }
  };

  const handleUserSubmit = () => {
    if (!form.details || !form.amount) {
      Toast.error("Please enter details and amount");
      return;
    }
    const detectedCat = !form.category ? handleCategoryDetect() : form.category;

    const isRedundant = _id &&
      form.details === (params.details || "") &&
      parseFloat(form.amount) === parseFloat(params.amount || "0") &&
      detectedCat === (params.category || "") &&
      form.date.toDateString() === new Date(params.date || "").toDateString();

    if (isRedundant) {
      router.back();
      return;
    }

    try {
      const transactionData = buildTransaction({ category: detectedCat });
      if (_id) {
        editExpense(transactionData);
        editExpenseApi(transactionData).then(() => {
          markAsSynced(_id, _id);
        });
      } else {
        addExpense(transactionData);
        addExpenseApi(transactionData).then((newId) => {
          if (newId) markAsSynced(transactionData._id, newId);
        });
      }
      Toast.success("Request processed");
      router.back();
    } catch (error) {
      Toast.error("Something went wrong");
    }
  };

  const handleSubmit = () => (userIdAdmin ? handleAdminSubmit() : handleUserSubmit());

  // ------------------ Render ------------------
  const backcolor = colorScheme === "light" ? "white" : "#111827";
  const textColor = colorScheme === "light" ? "black" : "#d1d5db";

  return (
    <SafeAreaView className="flex-1 bg-slate-700/60 justify-end">
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View className="dark:bg-gray-900 bg-white w-full rounded-lg p-5 items-center" style={{ paddingBottom: containerPadding }}>
          <View className="mb-6 relative w-full">
            <Text className="text-center text-xl dark:text-gray-200">
              Enter the {type} details
            </Text>
            <Link href={"../"} asChild>
              <Feather name="x" size={25} color={textColor} className="absolute right-0 top-0" />
            </Link>
          </View>

          {/* Bulk Add Link — only for regular user credit/debit */}
          {!userIdAdmin && !_id && (
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/expenseModal/bulkAdd' as any, params: { type, preselectedSourceId: form.sourceId || '' } })}
              className="flex-row items-center justify-center mb-4 py-2 px-4 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700 w-full"
            >
              <Feather name="layers" size={16} color="#6366f1" />
              <Text className="text-indigo-600 dark:text-indigo-300 font-semibold text-sm ml-2">
                Bulk {type === 'credit' ? 'Credit' : 'Debit'}
              </Text>
              <Feather name="chevron-right" size={14} color="#6366f1" style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          )}

          {/* Details */}
          <TextInput
            className="w-full h-16 rounded-lg dark:bg-gray-900 bg-white placeholder:text-gray-400 dark:placeholder:text-gray-300 dark:text-gray-100 text-xl p-4"
            placeholder="Enter details"
            value={form.details}
            onChangeText={(v) => updateForm("details", v)}
            onBlur={handleCategoryDetect}
          />

          {/* Amount */}
          <TextInput
            className="dark:bg-gray-900 bg-white placeholder:text-gray-400 dark:placeholder:text-gray-300 dark:text-gray-200 h-16 p-3 rounded-lg text-xl w-full mt-3"
            placeholder="₹ Amount"
            keyboardType="number-pad"
            value={form.amount}
            onChangeText={(v) => updateForm("amount", v)}
          />

          {/* Category Dropdown (for debit) */}
          {type === "debit" && (
            <TouchableOpacity
              onPress={() => {
                Keyboard.dismiss();
                timeoutRef.current = setTimeout(() => dropdownRef.current?.open(), 100);
              }}
              className="dark:bg-gray-900 bg-white rounded-lg h-16 w-full mt-3"
            >
              <Dropdown
                ref={dropdownRef}
                data={categories}
                labelField="label"
                valueField="value"
                value={form.category}
                onChange={(item) => updateForm("category", item.value)}
                dropdownPosition="top"
                style={{
                  backgroundColor: backcolor,
                  borderRadius: 8,
                  padding: 10,
                  height: "100%",
                  pointerEvents: "none",
                }}
                containerStyle={{
                  backgroundColor: backcolor,
                  marginBottom: 30,
                  borderWidth: 0,
                  elevation: 20,
                }}
                selectedTextStyle={{ color: textColor }}
                itemTextStyle={{ color: textColor }}
                placeholderStyle={{ color: "#d1d5db" }}
                activeColor={backcolor}
                iconColor={textColor}
              />
            </TouchableOpacity>
          )}

          {/* Account Selector — only shown for non-admin user transactions */}
          {!userIdAdmin && accounts.length>1 && (
            <TouchableOpacity
              onPress={() => {
                Keyboard.dismiss();
                setTimeout(() => accountDropdownRef.current?.open(), 100);
              }}
              className="dark:bg-gray-900 bg-white rounded-lg h-16 w-full mt-3"
            >
              <Dropdown
                ref={accountDropdownRef}
                data={accountItems}
                labelField="label"
                valueField="value"
                value={form.sourceId || null}
                placeholder="Select Account"
                onChange={(item) => handleAccountChange(item.value)}
                dropdownPosition="top"
                style={{
                  backgroundColor: backcolor,
                  borderRadius: 8,
                  padding: 10,
                  height: "100%",
                  pointerEvents: "none",
                }}
                containerStyle={{
                  backgroundColor: backcolor,
                  marginBottom: 30,
                  borderWidth: 0,
                  elevation: 20,
                }}
                selectedTextStyle={{ color: textColor }}
                itemTextStyle={{ color: textColor }}
                placeholderStyle={{ color: "#d1d5db" }}
                activeColor={backcolor}
                iconColor={textColor}
                renderItem={(item) => (
                  <View style={{ padding: 14, borderBottomWidth: 0.5, borderBottomColor: colorScheme === 'dark' ? '#374151' : '#e5e7eb' }}>
                    <Text style={{
                      color: item.value === ADD_NEW_VALUE ? '#6366f1' : textColor,
                      fontWeight: item.value === ADD_NEW_VALUE ? '700' : '400',
                      fontSize: 15,
                    }}>
                      {item.label}
                    </Text>
                    {item.sublabel ? (
                      <Text style={{ color: '#9ca3af', fontSize: 12, marginTop: 2, textTransform: 'capitalize' }}>
                        {item.sublabel.replace('_', ' ')}
                      </Text>
                    ) : null}
                  </View>
                )}
              />
            </TouchableOpacity>
          )}

          {/* Date Picker */}
          <TouchableOpacity
            onPress={() => setShowDatePicker(true)}
            className="dark:bg-gray-900 bg-white h-16 p-2 rounded-lg w-full flex-row items-center justify-between mt-3"
          >
            <Text className="dark:text-gray-300 p-1 text-xl">{form.date.toDateString()}</Text>
            {showDatePicker && (
              <DateTimePicker
                value={form.date}
                mode="date"
                is24Hour
                onChange={(e: DateTimePickerEvent, selectedDate: any) => {
                  setShowDatePicker(false);
                  if (selectedDate) updateForm("date", selectedDate);
                }}
              />
            )}
            <Feather name="calendar" size={22} color={textColor} />
          </TouchableOpacity>

          {/* Submit */}
          <View className="flex flex-row mt-10 mb-5">
            <TouchableOpacity
              className="bg-green-500 w-1/3 h-12 rounded-lg justify-center"
              onPress={handleSubmit}
            >
              <Text className="text-center text-xl text-gray-950 font-semibold">Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableWithoutFeedback>

      {/* Add New Account Modal */}
      <Modal
        visible={showNewAccountModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNewAccountModal(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="dark:bg-gray-900 bg-white rounded-t-2xl p-6">
            <Text className="text-xl font-bold dark:text-white text-gray-900 mb-5">Add New Account</Text>

            <Text className="dark:text-gray-300 text-gray-600 mb-1">Account Name</Text>
            <TextInput
              className="dark:bg-gray-800 bg-gray-100 rounded-lg p-3 dark:text-white text-gray-900 text-base mb-4"
              placeholder="e.g. HDFC Savings"
              placeholderTextColor="#9ca3af"
              value={newAccName}
              onChangeText={setNewAccName}
            />

            <Text className="dark:text-gray-300 text-gray-600 mb-1">Account Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
              <View className="flex-row gap-2">
                {ACCOUNT_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t.value}
                    onPress={() => setNewAccType(t.value)}
                    className={`px-4 py-2 rounded-full border ${newAccType === t.value
                      ? 'bg-indigo-600 border-indigo-600'
                      : 'bg-transparent border-gray-400 dark:border-gray-600'
                      }`}
                  >
                    <Text className={newAccType === t.value ? 'text-white font-bold' : 'dark:text-gray-300 text-gray-700'}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text className="dark:text-gray-300 text-gray-600 mb-1">Opening Balance (₹)</Text>
            <TextInput
              className="dark:bg-gray-800 bg-gray-100 rounded-lg p-3 dark:text-white text-gray-900 text-base mb-6"
              placeholder="0"
              placeholderTextColor="#9ca3af"
              keyboardType="number-pad"
              value={newAccBalance}
              onChangeText={setNewAccBalance}
            />

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setShowNewAccountModal(false)}
                className="flex-1 bg-gray-200 dark:bg-gray-700 p-4 rounded-xl"
              >
                <Text className="text-center font-semibold text-gray-700 dark:text-gray-300">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveNewAccount}
                disabled={savingAccount}
                className="flex-1 bg-indigo-600 p-4 rounded-xl"
              >
                {savingAccount
                  ? <ActivityIndicator color="white" />
                  : <Text className="text-center font-semibold text-white">Add Account</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default ExpenseForm;
