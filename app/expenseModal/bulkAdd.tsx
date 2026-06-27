import React, { useState, useCallback, useMemo, useRef } from "react";
import {
  Text, TouchableOpacity, View, TextInput, ScrollView, FlatList, Alert,
  useColorScheme, Modal, Keyboard, TouchableWithoutFeedback, Platform, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Dropdown, IDropdownRef } from "react-native-element-dropdown";
import { Toast } from "toastify-react-native";
import { useExpenseStore } from "@/store/expenseStore";
import { useAccountStore, AccountSource } from "@/store/accountStore";
import { predictCategory } from "@/helper/categoryDetector";
import { addExpenseApi } from "@/api/expenseApi";
import { fetchAccountsApi, createAccountApi } from "@/api/accountApi";
import { useEffect } from "react";

// ---- Constants ----
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

type BulkTransaction = {
  _id: string;
  details: string;
  amount: number;
  category: string;
  date: Date;
  sourceId: string;
  type: string;
};

// ---- Parser ----
type ParsedLine = { details: string; amount: number };
function parseBulkText(raw: string): { entries: ParsedLine[]; usedComma: boolean } {
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  const entries: ParsedLine[] = [];
  let usedComma = false;

  for (const line of lines) {
    let details = '';
    let amountStr = '';

    if (line.includes(';')) {
      const idx = line.lastIndexOf(';');
      details = line.slice(0, idx).trim();
      amountStr = line.slice(idx + 1).trim();
    } else if (line.includes('|')) {
      const idx = line.lastIndexOf('|');
      details = line.slice(0, idx).trim();
      amountStr = line.slice(idx + 1).trim();
    } else if (line.includes(',')) {
      // Check if comma is likely a separator (not a decimal)
      const parts = line.split(',');
      if (parts.length >= 2) {
        const lastPart = parts[parts.length - 1].trim();
        const rest = parts.slice(0, -1).join(',').trim();
        // If the last part is purely numeric, treat comma as separator
        if (/^\d+(\.\d+)?$/.test(lastPart.replace(/\s/g, ''))) {
          details = rest;
          amountStr = lastPart;
          usedComma = true;
        }
      }
    }

    // Fallback: split on last whitespace gap where right side is a number
    if (!details || !amountStr) {
      const trimmed = line.trim();
      // Match: text followed by a number at the end
      const match = trimmed.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*$/);
      if (match) {
        details = match[1].trim();
        amountStr = match[2].trim();
      }
    }

    const amount = parseFloat(amountStr.replace(/[^0-9.]/g, ''));
    if (details && !isNaN(amount) && amount > 0) {
      entries.push({ details, amount });
    }
  }

  return { entries, usedComma };
}

// ---- Component ----
export default function BulkAddPage() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { addExpense, markAsSynced } = useExpenseStore();
  const { accounts, setAccounts, addAccount, getDefaultAccount } = useAccountStore();
  const { type: paramType, preselectedSourceId } = useLocalSearchParams<Record<string, string>>();

  const [txType] = useState<string>(paramType || 'debit');
  const [date, setDate] = useState(new Date());
  const [sourceId, setSourceId] = useState<string>(preselectedSourceId || getDefaultAccount()?._id || '');
  const [rawText, setRawText] = useState('');
  const [transactions, setTransactions] = useState<BulkTransaction[]>([]);
  const [mode, setMode] = useState<'input' | 'review'>('input');
  const [saving, setSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Edit modal state
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ details: '', amount: '', category: '', date: new Date(), sourceId: '' });
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);
  const editAccountRef = useRef<IDropdownRef>(null);
  const accountDropdownRef = useRef<IDropdownRef>(null);
  const editCategoryRef = useRef<IDropdownRef>(null);
  const [containerPadding, setContainerPadding] = useState(0);

  // Quick add state for review mode
  const [quickDetails, setQuickDetails] = useState('');
  const [quickAmount, setQuickAmount] = useState('');

  // New account modal
  const [showNewAccountModal, setShowNewAccountModal] = useState(false);
  const [newAccName, setNewAccName] = useState('');
  const [newAccType, setNewAccType] = useState<AccountSource['type']>('bank');
  const [newAccBalance, setNewAccBalance] = useState('0');
  const [savingAccount, setSavingAccount] = useState(false);

  // Load accounts on mount
  useEffect(() => {
    if (accounts.length === 0) {
      fetchAccountsApi().then((fetched) => {
        if (fetched.length > 0) setAccounts(fetched);
      });
    }
  }, []);

  // Keyboard padding (Android)
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => setContainerPadding(e.endCoordinates.height));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setContainerPadding(0));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const accountItems = useMemo(() => {
    const items: { label: string; value: string; sublabel?: string }[] = accounts.map((a) => ({
      label: a.isDefault ? `${a.name} (Default)` : a.name,
      value: a._id,
      sublabel: a.type,
    }));
    items.push({ label: '+ Add New Account', value: ADD_NEW_VALUE });
    return items;
  }, [accounts]);

  const backcolor = isDark ? '#111827' : 'white';
  const textColor = isDark ? '#d1d5db' : 'black';

  // ---- Analyze ----
  const handleAnalyze = () => {
    if (!rawText.trim()) {
      Toast.error('Please enter or paste some transactions');
      return;
    }
    const { entries, usedComma } = parseBulkText(rawText);
    if (entries.length === 0) {
      Toast.error('Could not parse any transactions. Check the format.');
      return;
    }
    if (usedComma) {
      Toast.info('Some entries used "," as separator. Please review parsed transactions.');
    }

    const parsed: BulkTransaction[] = entries.map((e) => ({
      _id: createLocalId(),
      details: e.details,
      amount: e.amount,
      category: txType === 'credit' ? 'Income' : (predictCategory(e.details) || 'Other'),
      date,
      sourceId: sourceId || getDefaultAccount()?._id || '',
      type: txType,
    }));

    setTransactions(parsed);
    setMode('review');
  };

  // ---- Edit ----
  const openEdit = (idx: number) => {
    const tx = transactions[idx];
    setEditIdx(idx);
    setEditForm({ details: tx.details, amount: String(tx.amount), category: tx.category, date: tx.date, sourceId: tx.sourceId });
  };

  const saveEdit = () => {
    if (editIdx === null) return;
    const amount = parseFloat(editForm.amount);
    if (!editForm.details.trim() || isNaN(amount) || amount <= 0) {
      Toast.error('Invalid details or amount');
      return;
    }
    setTransactions((prev) =>
      prev.map((tx, i) =>
        i === editIdx ? { ...tx, details: editForm.details.trim(), amount, category: editForm.category || tx.category, date: editForm.date, sourceId: editForm.sourceId || tx.sourceId } : tx
      )
    );
    setEditIdx(null);
  };

  const handleEditAccountChange = (val: string) => {
    if (val === ADD_NEW_VALUE) {
      setShowNewAccountModal(true);
    } else {
      setEditForm((p) => ({ ...p, sourceId: val }));
    }
  };

  // ---- Quick Add ----
  const handleQuickAdd = () => {
    const amount = parseFloat(quickAmount);
    if (!quickDetails.trim() || isNaN(amount) || amount <= 0) {
      Toast.error('Enter details and a valid amount');
      return;
    }
    const newTx: BulkTransaction = {
      _id: createLocalId(),
      details: quickDetails.trim(),
      amount,
      category: txType === 'credit' ? 'Income' : (predictCategory(quickDetails.trim()) || 'Other'),
      date,
      sourceId: sourceId || getDefaultAccount()?._id || '',
      type: txType,
    };
    setTransactions((prev) => [...prev, newTx]);
    setQuickDetails('');
    setQuickAmount('');
    Toast.success('Transaction added');
  };

  const deleteTx = (idx: number) => {
    const tx = transactions[idx];
    Alert.alert(
      'Delete Transaction',
      `Remove "${tx.details}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => setTransactions((prev) => prev.filter((_, i) => i !== idx)) },
      ]
    );
  };

  // ---- Save ----
  const handleSave = async () => {
    if (transactions.length === 0) {
      Toast.error('No transactions to save');
      return;
    }
    setSaving(true);
    let savedCount = 0;

    for (const tx of transactions) {
      const transactionData = {
        _id: tx._id,
        type: tx.type,
        details: tx.details,
        amount: tx.amount,
        category: tx.category,
        date: tx.date.toDateString(),
        createdAt: new Date().toISOString(),
        isSynced: false,
        clientId: createLocalId(),
        sourceId: tx.sourceId || getDefaultAccount()?._id || null,
      };

      try {
        addExpense(transactionData as any);
        const newId = await addExpenseApi(transactionData as any);
        if (newId) markAsSynced(transactionData._id, newId);
        savedCount++;
      } catch (err) {
        console.error('Failed to queue transaction:', err);
      }
    }

    setSaving(false);
    Toast.success(`${savedCount} transaction${savedCount === 1 ? '' : 's'} queued for sync`);
    router.back(); // close bulkAdd
    router.back(); // close [type] modal, back to home
  };

  // ---- New Account ----
  const handleSaveNewAccount = async () => {
    const trimmed = newAccName.trim();
    if (!trimmed) { Toast.error('Account name is required'); return; }
    setSavingAccount(true);
    try {
      const created = await createAccountApi({ name: trimmed, type: newAccType, openingBalance: parseFloat(newAccBalance) || 0 } as any);
      if (created) {
        addAccount(created);
        setSourceId(created._id);
        Toast.success('Account added');
      } else {
        Toast.error('Failed to create account');
      }
    } finally {
      setSavingAccount(false);
      setShowNewAccountModal(false);
      setNewAccName('');
      setNewAccType('bank');
      setNewAccBalance('0');
    }
  };

  const handleAccountChange = (val: string) => {
    if (val === ADD_NEW_VALUE) {
      setShowNewAccountModal(true);
    } else {
      setSourceId(val);
    }
  };

  // ---- Summary ----
  const total = useMemo(() => transactions.reduce((sum, tx) => sum + tx.amount, 0), [transactions]);
  const editAccountItems = useMemo(() => {
    const items: { label: string; value: string; sublabel?: string }[] = accounts.map((a) => ({
      label: a.isDefault ? `${a.name} (Default)` : a.name,
      value: a._id,
      sublabel: a.type,
    }));
    items.push({ label: '+ Add New Account', value: ADD_NEW_VALUE });
    return items;
  }, [accounts]);

  const getAccountName = (sid: string) => accounts.find((a) => a._id === sid)?.name || 'Default Account';
  const showAccountNames = accounts.length > 1
  // ---- Render ----
  return (
    <SafeAreaView className="flex-1 dark:bg-gray-900 bg-white">
      {/* Header */}
      <View className="flex-row items-center px-5 pt-4 pb-2">
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <Feather name="arrow-left" size={22} color={isDark ? 'white' : '#111827'} />
        </TouchableOpacity>
        <Text className="text-xl font-bold dark:text-white text-gray-900 flex-1">
          Bulk {txType === 'credit' ? 'Credit' : 'Debit'}
        </Text>
        <View className={`px-3 py-1 rounded-full ${txType === 'credit' ? 'bg-green-100 dark:bg-green-900/40' : 'bg-red-100 dark:bg-red-900/40'}`}>
          <Text className={`text-xs font-bold ${txType === 'credit' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {txType === 'credit' ? 'Credit' : 'Debit'}
          </Text>
        </View>
      </View>

      {mode === 'input' ? (
        /* =================== INPUT MODE =================== */
        <View className="flex-1 px-5" style={{ paddingBottom: containerPadding }}>
          {/* Account + Date row */}
          <View className="flex-row gap-3 mt-3 mb-3">
            {/* Account Dropdown */}
            {showAccountNames && <TouchableOpacity
              onPress={() => { Keyboard.dismiss(); setTimeout(() => accountDropdownRef.current?.open(), 100); }}
              className="flex-1 dark:bg-gray-800 bg-gray-100 rounded-lg h-12"
            >
              <Dropdown
                ref={accountDropdownRef}
                data={accountItems}
                labelField="label"
                valueField="value"
                value={sourceId || null}
                placeholder="Select Account"
                onChange={handleAccountChange}
                style={{ backgroundColor: 'transparent', borderRadius: 8, padding: 10, height: '100%', pointerEvents: 'none' }}
                containerStyle={{ backgroundColor: backcolor, marginBottom: 30, borderWidth: 0, elevation: 20 }}
                selectedTextStyle={{ color: textColor, fontSize: 13 }}
                itemTextStyle={{ color: textColor }}
                placeholderStyle={{ color: '#9ca3af' }}
                activeColor={backcolor}
                iconColor={textColor}
                renderItem={(item: any) => (
                  <View style={{ padding: 14, borderBottomWidth: 0.5, borderBottomColor: isDark ? '#374151' : '#e5e7eb' }}>
                    <Text style={{ color: item.value === ADD_NEW_VALUE ? '#6366f1' : textColor, fontWeight: item.value === ADD_NEW_VALUE ? '700' : '400', fontSize: 15 }}>
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
            </TouchableOpacity>}

            {/* Date Picker */}
            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              className="dark:bg-gray-800 bg-gray-100 rounded-lg h-12 flex-row items-center px-3"
            >
              <Feather name="calendar" size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
              <Text className="dark:text-gray-300 text-gray-700 text-sm ml-2">{date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</Text>
              {showDatePicker && (
                <DateTimePicker
                  value={date}
                  mode="date"
                  is24Hour
                  onChange={(_: DateTimePickerEvent, d?: Date) => { setShowDatePicker(false); if (d) setDate(d); }}
                />
              )}
            </TouchableOpacity>
          </View>

          {/* Textarea */}
          <TextInput
            className="flex-1 dark:bg-gray-800 bg-gray-100 rounded-xl p-4 dark:text-white text-gray-900 text-base"
            placeholder={`Groceries ; 1200\nBus Ticket ; 30\nLunch ; 250\nCoffee ; 80\n\nYou can also use:\nElectricity Bill | 1800\nInternet Recharge , 799\nFood  200`}
            placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
            multiline
            textAlignVertical="top"
            value={rawText}
            onChangeText={setRawText}
            style={{ minHeight: 200 }}
          />

          {/* Buttons */}
          <View className="flex-row gap-3 mt-4 mb-4">
            <TouchableOpacity
              onPress={() => router.back()}
              className="flex-1 bg-gray-200 dark:bg-gray-700 p-4 rounded-xl"
            >
              <Text className="text-center font-semibold text-gray-700 dark:text-gray-300">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleAnalyze}
              className="flex-[2] bg-indigo-600 p-4 rounded-xl flex-row items-center justify-center gap-2"
            >
              <Feather name="search" size={18} color="white" />
              <Text className="text-center font-semibold text-white">Analyze</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* =================== REVIEW MODE =================== */
        <View className="flex-1">
          {/* Transaction List */}
          <FlatList
            className="flex-1 px-5"
            data={transactions}
            keyExtractor={(_, i) => String(i)}
            showsVerticalScrollIndicator={false}
            renderItem={({ item, index }) => (
              <View className="dark:bg-gray-800 bg-gray-50 rounded-xl p-4 mb-2 border dark:border-gray-700 border-gray-200">
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 pr-4">
                    <Text className="dark:text-white text-gray-900 font-semibold text-lg" numberOfLines={1}>
                      {item.details}
                    </Text>
                    <View className="flex-row items-center mt-1.5 gap-2 flex-wrap">
                      <View className="bg-indigo-100 dark:bg-indigo-900/50 px-2.5 py-0.5 rounded-full">
                        <Text className="text-indigo-600 dark:text-indigo-300 text-xs font-medium">{item.category}</Text>
                      </View>
                      {showAccountNames && <Text className="text-gray-500 dark:text-gray-400 text-xs">
                        {getAccountName(item.sourceId)}
                      </Text>}
                      <Text className="text-gray-500 dark:text-gray-400 text-xs">
                        {item.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </Text>
                    </View>
                  </View>
                  <View className="items-end">
                    <Text className={txType === 'credit' ? 'text-green-500 font-bold text-lg' : 'text-red-500 font-bold text-lg'}>
                      {txType === 'credit' ? '+' : '-'}₹{item.amount.toLocaleString('en-IN')}
                    </Text>
                  </View>
                </View>
                <View className="flex-row justify-end gap-2 mt-3 pt-3 border-t dark:border-gray-700 border-gray-200">
                  <TouchableOpacity
                    onPress={() => openEdit(index)}
                    className="flex-row items-center px-3 py-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/40"
                  >
                    <Feather name="edit-3" size={13} color="#6366f1" />
                    <Text className="text-indigo-600 dark:text-indigo-300 text-xs font-semibold ml-1">Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => deleteTx(index)}
                    className="flex-row items-center px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/40"
                  >
                    <Feather name="trash-2" size={13} color="#ef4444" />
                    <Text className="text-red-500 text-xs font-semibold ml-1">Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            ListFooterComponent={
              /* ---- Inline Quick Add ---- */
              transactions.length > 0 ? (
                <View className="dark:bg-gray-800 bg-gray-50 rounded-xl p-3 mb-3 border dark:border-gray-700 border-gray-200">
                  <View className="flex-row gap-2">
                    <TextInput
                      className="flex-1 dark:bg-gray-700 bg-white rounded-lg px-3 py-2.5 dark:text-white text-gray-900 text-sm border dark:border-gray-600 border-gray-300"
                      placeholder="Add more..."
                      placeholderTextColor="#9ca3af"
                      value={quickDetails}
                      onChangeText={setQuickDetails}
                      returnKeyType="done"
                      onSubmitEditing={handleQuickAdd}
                    />
                    <TextInput
                      className="w-24 dark:bg-gray-700 bg-white rounded-lg px-3 py-2.5 dark:text-white text-gray-900 text-sm border dark:border-gray-600 border-gray-300"
                      placeholder="₹"
                      placeholderTextColor="#9ca3af"
                      keyboardType="number-pad"
                      value={quickAmount}
                      onChangeText={setQuickAmount}
                      onSubmitEditing={handleQuickAdd}
                    />
                    <TouchableOpacity
                      onPress={handleQuickAdd}
                      className="bg-indigo-600 rounded-lg px-4 justify-center"
                    >
                      <Feather name="plus" size={20} color="white" />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View className="flex-1 items-center justify-center py-10">
                <Text className="text-gray-400 dark:text-gray-500">No transactions left. Go back and re-analyze.</Text>
              </View>
            }
          />

          {/* Summary + Save */}
          <View className="dark:bg-gray-800 bg-gray-100 px-5 py-4 border-t dark:border-gray-700 border-gray-200" style={{ paddingBottom: Math.max(containerPadding, 16) }}>
            <View className="flex-row justify-between items-center mb-3">
              <Text className="dark:text-gray-300 text-gray-600 font-medium">
                Total {txType === 'credit' ? 'Credit' : 'Debit'}:
              </Text>
              <Text className={`font-bold text-lg ${txType === 'credit' ? 'text-green-500' : 'text-red-500'}`}>
                ₹{total.toLocaleString('en-IN')}
              </Text>
            </View>
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => { setMode('input'); }}
                className="flex-1 bg-gray-200 dark:bg-gray-700 p-4 rounded-xl"
              >
                <Text className="text-center font-semibold text-gray-700 dark:text-gray-300">Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                disabled={saving || transactions.length === 0}
                className={`flex-[2] p-4 rounded-xl ${saving || transactions.length === 0 ? 'bg-indigo-400' : 'bg-indigo-600'}`}
              >
                {saving ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-center font-semibold text-white">
                    Save {transactions.length} Transaction{transactions.length === 1 ? '' : 's'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ---- Edit Transaction Modal ---- */}
      <Modal visible={editIdx !== null} transparent animationType="slide" onRequestClose={() => setEditIdx(null)}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View className="flex-1 justify-end bg-black/50" style={{ paddingBottom: containerPadding }}>
            <View className="dark:bg-gray-900 bg-white rounded-t-2xl p-6">
              <Text className="text-xl font-bold dark:text-white text-gray-900 mb-4">Edit Transaction</Text>

              <Text className="dark:text-gray-300 text-gray-600 mb-1">Details</Text>
              <TextInput
                className="dark:bg-gray-800 bg-gray-100 rounded-lg p-3 dark:text-white text-gray-900 text-base mb-3"
                value={editForm.details}
                onChangeText={(v) => setEditForm((p) => ({ ...p, details: v }))}
              />

              <Text className="dark:text-gray-300 text-gray-600 mb-1">Amount (₹)</Text>
              <TextInput
                className="dark:bg-gray-800 bg-gray-100 rounded-lg p-3 dark:text-white text-gray-900 text-base mb-3"
                keyboardType="number-pad"
                value={editForm.amount}
                onChangeText={(v) => setEditForm((p) => ({ ...p, amount: v }))}
              />

              <Text className="dark:text-gray-300 text-gray-600 mb-1">Category</Text>
              <TouchableOpacity
                onPress={() => { Keyboard.dismiss(); setTimeout(() => editCategoryRef.current?.open(), 100); }}
                className="dark:bg-gray-800 bg-gray-100 rounded-lg h-12 mb-3"
              >
                <Dropdown
                  ref={editCategoryRef}
                  data={categories}
                  labelField="label"
                  valueField="value"
                  value={editForm.category}
                  onChange={(item) => setEditForm((p) => ({ ...p, category: item.value }))}
                  dropdownPosition="top"
                  style={{ backgroundColor: 'transparent', borderRadius: 8, padding: 10, height: '100%', pointerEvents: 'none' }}
                  containerStyle={{ backgroundColor: backcolor, marginBottom: 30, borderWidth: 0, elevation: 20 }}
                  selectedTextStyle={{ color: textColor }}
                  itemTextStyle={{ color: textColor }}
                  activeColor={backcolor}
                  iconColor={textColor}
                />
              </TouchableOpacity>

              {showAccountNames && <><Text className="dark:text-gray-300 text-gray-600 mb-1">Account</Text>
                <TouchableOpacity
                  onPress={() => { Keyboard.dismiss(); setTimeout(() => editAccountRef.current?.open(), 100); }}
                  className="dark:bg-gray-800 bg-gray-100 rounded-lg h-12 mb-3"
                >
                  <Dropdown
                    ref={editAccountRef}
                    data={editAccountItems}
                    labelField="label"
                    valueField="value"
                    value={editForm.sourceId || null}
                    placeholder="Select Account"
                    onChange={handleEditAccountChange}
                    dropdownPosition="top"
                    style={{ backgroundColor: 'transparent', borderRadius: 8, padding: 10, height: '100%', pointerEvents: 'none' }}
                    containerStyle={{ backgroundColor: backcolor, marginBottom: 30, borderWidth: 0, elevation: 20 }}
                    selectedTextStyle={{ color: textColor, fontSize: 13 }}
                    itemTextStyle={{ color: textColor }}
                    placeholderStyle={{ color: '#9ca3af' }}
                    activeColor={backcolor}
                    iconColor={textColor}
                    renderItem={(item: any) => (
                      <View style={{ padding: 14, borderBottomWidth: 0.5, borderBottomColor: isDark ? '#374151' : '#e5e7eb' }}>
                        <Text style={{ color: item.value === ADD_NEW_VALUE ? '#6366f1' : textColor, fontWeight: item.value === ADD_NEW_VALUE ? '700' : '400', fontSize: 15 }}>
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
                </TouchableOpacity></>}

              <Text className="dark:text-gray-300 text-gray-600 mb-1">Date</Text>
              <TouchableOpacity
                onPress={() => setShowEditDatePicker(true)}
                className="dark:bg-gray-800 bg-gray-100 rounded-lg h-12 mb-4 flex-row items-center px-3"
              >
                <Feather name="calendar" size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
                <Text className="dark:text-gray-300 text-gray-700 text-sm ml-2">{editForm.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                {showEditDatePicker && (
                  <DateTimePicker
                    value={editForm.date}
                    mode="date"
                    is24Hour
                    onChange={(_: DateTimePickerEvent, d?: Date) => { setShowEditDatePicker(false); if (d) setEditForm((p) => ({ ...p, date: d })); }}
                  />
                )}
              </TouchableOpacity>

              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={() => setEditIdx(null)}
                  className="flex-1 bg-gray-200 dark:bg-gray-700 p-4 rounded-xl"
                >
                  <Text className="text-center font-semibold text-gray-700 dark:text-gray-300">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={saveEdit} className="flex-1 bg-indigo-600 p-4 rounded-xl">
                  <Text className="text-center font-semibold text-white">Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ---- Add New Account Modal ---- */}
      <Modal visible={showNewAccountModal} transparent animationType="slide" onRequestClose={() => setShowNewAccountModal(false)}>
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
                    className={`px-4 py-2 rounded-full border ${newAccType === t.value ? 'bg-indigo-600 border-indigo-600' : 'bg-transparent border-gray-400 dark:border-gray-600'}`}
                  >
                    <Text className={newAccType === t.value ? 'text-white font-bold' : 'dark:text-gray-300 text-gray-700'}>{t.label}</Text>
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
              <TouchableOpacity onPress={() => setShowNewAccountModal(false)} className="flex-1 bg-gray-200 dark:bg-gray-700 p-4 rounded-xl">
                <Text className="text-center font-semibold text-gray-700 dark:text-gray-300">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveNewAccount} disabled={savingAccount} className="flex-1 bg-indigo-600 p-4 rounded-xl">
                {savingAccount ? <ActivityIndicator color="white" /> : <Text className="text-center font-semibold text-white">Add Account</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
