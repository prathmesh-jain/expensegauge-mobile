import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Modal, useColorScheme, ActivityIndicator, Keyboard,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Toast } from 'toastify-react-native';
import { useAccountStore, AccountSource } from '@/store/accountStore';
import {
  fetchAccountsApi,
  createAccountApi,
  updateAccountApi,
  setDefaultAccountApi,
  deleteAccountApi,
} from '@/api/accountApi';

const ACCOUNT_TYPES: { label: string; value: AccountSource['type']; icon: string }[] = [
  { label: "Bank", value: "bank", icon: "credit-card" },
  { label: "Cash", value: "cash", icon: "dollar-sign" },
  { label: "Wallet", value: "wallet", icon: "pocket" },
  { label: "Credit Card", value: "credit_card", icon: "credit-card" },
  { label: "Business", value: "business", icon: "briefcase" },
];

const typeIcon = (type: AccountSource['type']) => {
  const found = ACCOUNT_TYPES.find((t) => t.value === type);
  return (found?.icon as any) || 'credit-card';
};

const typeLabel = (type: AccountSource['type']) =>
  ACCOUNT_TYPES.find((t) => t.value === type)?.label || type;

const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function AccountSettings() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { accounts, setAccounts, addAccount, updateAccount, removeAccount, setDefaultAccount } = useAccountStore();

  const [loading, setLoading] = useState(false);
  const [containerPadding, setContainerPadding] = useState(0);

  // Edit/Add modal state
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<AccountSource | null>(null);
  const [modalName, setModalName] = useState('');
  const [modalType, setModalType] = useState<AccountSource['type']>('bank');
  const [modalBalance, setModalBalance] = useState('0');
  const [saving, setSaving] = useState(false);

  // Delete transfer modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AccountSource | null>(null);
  const [selectedTransferId, setSelectedTransferId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    setLoading(true);
    const fetched = await fetchAccountsApi();
    setAccounts(fetched);
    setLoading(false);
  };

  const openAddModal = () => {
    setEditTarget(null);
    setModalName('');
    setModalType('bank');
    setModalBalance('0');
    setShowModal(true);
  };

  const openEditModal = (account: AccountSource) => {
    if (account.isSystem) {
      Toast.error('System account cannot be edited');
      return;
    }
    setEditTarget(account);
    setModalName(account.name);
    setModalType(account.type);
    // No balance fields in edit mode
    setShowModal(true);
  };

  const handleSave = async () => {
    const trimmedName = modalName.trim();
    if (!trimmedName) {
      Toast.error('Account name is required');
      return;
    }

    // Client-side duplicate check using normalized name
    const normalizedName = trimmedName.toLowerCase().replace(/\s+/g, ' ');
    const isDuplicate = accounts.some((a) => {
      if (editTarget && a._id === editTarget._id) return false; // Skip self when editing
      return a.normalizedName === normalizedName;
    });
    if (isDuplicate) {
      Toast.error('An account with this name already exists');
      return;
    }

    setSaving(true);
    try {
      if (editTarget) {
        const updated = await updateAccountApi(editTarget._id, { name: trimmedName, type: modalType });
        if (updated) {
          updateAccount(updated);
          Toast.success('Account updated');
        } else {
          Toast.error('Failed to update account');
        }
      } else {
        const created = await createAccountApi({
          name: trimmedName,
          type: modalType,
          openingBalance: parseFloat(modalBalance) || 0,
        });
        if (created) {
          addAccount(created);
          Toast.success('Account added');
        } else {
          Toast.error('Failed to create account');
        }
      }
      setShowModal(false);
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (account: AccountSource) => {
    if (account.isDefault) return;
    const updated = await setDefaultAccountApi(account._id);
    if (updated) {
      setDefaultAccount(account._id);
      Toast.success(`${account.name} is now the default account`);
    } else {
      Toast.error('Failed to set default account');
    }
  };

  const openDeleteModal = (account: AccountSource) => {
    if (account.isSystem) {
      Toast.error('System account cannot be deleted');
      return;
    }
    if (account.isDefault) {
      Toast.error('Set another account as default before deleting this one');
      return;
    }
    setDeleteTarget(account);
    // Pre-select the default account as transfer target
    const def = accounts.find((a) => a.isDefault);
    setSelectedTransferId(def?._id || null);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget || !selectedTransferId) return;
    setDeleting(true);
    try {
      const result = await deleteAccountApi(deleteTarget._id, selectedTransferId);
      if (result.success) {
        removeAccount(deleteTarget._id);
        Toast.success(result.message || 'Account deleted');
        setShowDeleteModal(false);
        setDeleteTarget(null);
      } else {
        Toast.error(result.message || 'Failed to delete account');
      }
    } finally {
      setDeleting(false);
    }
  };
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

  // Other accounts that can receive the transfer (excluding the one being deleted)
  const transferOptions = accounts.filter((a) => a._id !== deleteTarget?._id);
  
  // Always show the default primary account as first option
  const defaultAccount = accounts.find((a) => a.isDefault);
  const showDefaultOption = defaultAccount && defaultAccount._id !== deleteTarget?._id;

  return (
    <SafeAreaView className="flex-1 dark:bg-gray-900 bg-white">
      {/* Header */}
      <View className="flex-row items-center px-5 pt-4 pb-2">
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <Feather name="arrow-left" size={22} color={isDark ? 'white' : '#111827'} />
        </TouchableOpacity>
        <Text className="text-xl font-bold dark:text-white text-gray-900 flex-1">Accounts</Text>
        <TouchableOpacity onPress={openAddModal} className="bg-indigo-600 px-3 py-2 rounded-full flex-row items-center gap-1">
          <Feather name="plus" size={16} color="white" />
          <Text className="text-white text-sm font-semibold ml-1">Add</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      ) : (
        <ScrollView className="flex-1 px-5 pt-4" contentContainerStyle={{ paddingBottom: 40 }}>
          {accounts.length === 0 && (
            <View className="items-center py-12">
              <Feather name="inbox" size={48} color="#9ca3af" />
              <Text className="dark:text-gray-400 text-gray-500 text-base mt-4">No accounts yet</Text>
              <TouchableOpacity onPress={openAddModal} className="mt-4 bg-indigo-600 px-6 py-3 rounded-xl">
                <Text className="text-white font-semibold">Add Your First Account</Text>
              </TouchableOpacity>
            </View>
          )}

          {accounts.map((account) => (
            <TouchableOpacity
              key={account._id}
              onPress={() => !account.isSystem && openEditModal(account)}
              activeOpacity={account.isSystem ? 1 : 0.8}
              className={`rounded-2xl p-4 mb-3 border ${
                account.isSystem 
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700'
                  : 'dark:bg-gray-800 bg-gray-50 border dark:border-gray-700 border-gray-200'
              }`}
            >
              <View className="flex-row items-center">
                {/* Icon */}
                <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
                  account.isSystem 
                    ? 'bg-blue-500' 
                    : account.isDefault 
                      ? 'bg-indigo-100 dark:bg-indigo-900' 
                      : 'bg-gray-200 dark:bg-gray-700'
                }`}>
                  <Feather 
                    name={account.isSystem ? 'home' : typeIcon(account.type)} 
                    size={18} 
                    color={account.isSystem ? 'white' : (account.isDefault ? '#6366f1' : (isDark ? '#9ca3af' : '#6b7280'))} 
                  />
                </View>

                {/* Info */}
                <View className="flex-1">
                  <View className="flex-row items-center gap-2">
                    <Text className={`font-semibold text-base ${
                      account.isSystem 
                        ? 'text-blue-700 dark:text-blue-300' 
                        : 'dark:text-white text-gray-900'
                    }`}>
                      {account.name}
                    </Text>
                    {account.isSystem && (
                      <View className="bg-blue-500 px-2 py-0.5 rounded-full">
                        <Text className="text-white text-xs font-bold">System</Text>
                      </View>
                    )}
                    {account.isDefault && !account.isSystem && (
                      <View className="bg-indigo-100 dark:bg-indigo-900 px-2 py-0.5 rounded-full">
                        <Text className="text-indigo-600 dark:text-indigo-300 text-xs font-bold">Default</Text>
                      </View>
                    )}
                  </View>
                  <Text className="dark:text-gray-400 text-gray-500 text-xs mt-0.5 capitalize">
                    {account.isSystem ? 'Primary Account' : typeLabel(account.type)}
                  </Text>
                  <Text className={`text-sm font-medium mt-1 ${
                    account.isSystem 
                      ? 'text-blue-700 dark:text-blue-300' 
                      : 'dark:text-gray-300 text-gray-700'
                  }`}>
                    Balance: {account.currentBalance?.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                  </Text>
                  {/* Don't show transaction count and last used for system accounts */}
                  {!account.isSystem && (
                    <View className="flex-row items-center gap-3 mt-1">
                      {account.transactionCount > 0 && (
                        <Text className="dark:text-gray-400 text-gray-500 text-xs">
                          Transactions: {account.transactionCount}
                        </Text>
                      )}
                      {account.lastUsed && formatDate(account.lastUsed) && (
                        <Text className="dark:text-gray-400 text-gray-500 text-xs">
                          Last Used: {formatDate(account.lastUsed)}
                        </Text>
                      )}
                    </View>
                  )}
                </View>

                {/* Actions - Hidden for system accounts */}
                {!account.isSystem && (
                  <View className="flex-row gap-3 items-center">
                    {!account.isDefault && (
                      <TouchableOpacity onPress={() => handleSetDefault(account)} hitSlop={8}>
                        <Feather name="star" size={18} color={isDark ? '#9ca3af' : '#6b7280'} />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => openEditModal(account)} hitSlop={8}>
                      <Feather name="edit-2" size={18} color={isDark ? '#9ca3af' : '#6b7280'} />
                    </TouchableOpacity>
                    {!account.isDefault && (
                      <TouchableOpacity onPress={() => openDeleteModal(account)} hitSlop={8}>
                        <Feather name="trash-2" size={18} color="#ef4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))}

          <Text className="dark:text-gray-500 text-gray-400 text-xs text-center mt-4">
            The default account is used automatically when adding transactions.
          </Text>
        </ScrollView>
      )}

      {/* Add / Edit Modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <View className="flex-1 justify-end bg-black/50" style={{paddingBottom:containerPadding}}>
          <View className="dark:bg-gray-900 bg-white rounded-t-2xl p-6">
            <Text className="text-xl font-bold dark:text-white text-gray-900 mb-5">
              {editTarget ? 'Edit Account' : 'New Account'}
            </Text>

            <Text className="dark:text-gray-300 text-gray-600 mb-1">Account Name</Text>
            <TextInput
              className="dark:bg-gray-800 bg-gray-100 rounded-lg p-3 dark:text-white text-gray-900 text-base mb-4"
              placeholder="e.g. HDFC Savings"
              placeholderTextColor="#9ca3af"
              value={modalName}
              onChangeText={setModalName}
            />

            <Text className="dark:text-gray-300 text-gray-600 mb-2">Account Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
              <View className="flex-row gap-2">
                {ACCOUNT_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t.value}
                    onPress={() => setModalType(t.value)}
                    className={`px-4 py-2 rounded-full border ${modalType === t.value
                      ? 'bg-indigo-600 border-indigo-600'
                      : 'bg-transparent border-gray-400 dark:border-gray-600'
                      }`}
                  >
                    <Text className={modalType === t.value ? 'text-white font-bold' : 'dark:text-gray-300 text-gray-700'}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Opening balance only for NEW accounts */}
            {!editTarget && (
              <>
                <Text className="dark:text-gray-300 text-gray-600 mb-1">Opening Balance (₹)</Text>
                <TextInput
                  className="dark:bg-gray-800 bg-gray-100 rounded-lg p-3 dark:text-white text-gray-900 text-base mb-6"
                  placeholder="0"
                  placeholderTextColor="#9ca3af"
                  keyboardType="number-pad"
                  value={modalBalance}
                  onChangeText={setModalBalance}
                />
              </>
            )}

            <View className="flex-row gap-3 mt-2">
              <TouchableOpacity
                onPress={() => setShowModal(false)}
                className="flex-1 bg-gray-200 dark:bg-gray-700 p-4 rounded-xl"
              >
                <Text className="text-center font-semibold text-gray-700 dark:text-gray-300">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                disabled={saving}
                className="flex-1 bg-indigo-600 p-4 rounded-xl"
              >
                {saving
                  ? <ActivityIndicator color="white" />
                  : <Text className="text-center font-semibold text-white">{editTarget ? 'Save' : 'Add Account'}</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete with Transfer Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="dark:bg-gray-900 bg-white rounded-t-2xl p-6">
            <Text className="text-xl font-bold dark:text-white text-gray-900 mb-2">Delete Account</Text>
            <Text className="dark:text-gray-300 text-gray-600 mb-4">
              Transfer expenses from "{deleteTarget?.name}" to which account?
            </Text>

            {/* Move to Default Account Option */}
            {showDefaultOption && (
              <TouchableOpacity
                onPress={() => setSelectedTransferId(defaultAccount._id)}
                className={`flex-row items-center p-3 rounded-xl mb-3 border-2 ${
                  selectedTransferId === defaultAccount._id
                    ? 'bg-blue-50 dark:bg-blue-900/40 border-blue-400 dark:border-blue-600'
                    : 'dark:bg-blue-900/20 bg-blue-50 border-blue-200 dark:border-blue-700'
                }`}
              >
                <View className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${
                  selectedTransferId === defaultAccount._id ? 'bg-blue-600' : 'bg-blue-500'
                }`}>
                  <Feather name="home" size={14} color="white" />
                </View>
                <View className="flex-1">
                  <Text className={`font-semibold ${
                    selectedTransferId === defaultAccount._id 
                      ? 'text-blue-600 dark:text-blue-300' 
                      : 'dark:text-blue-300 text-blue-700'
                  }`}>
                    Move to Default Account
                  </Text>
                  <Text className="dark:text-blue-400 text-blue-600 text-xs">
                    Transfer all expenses to {defaultAccount.name}
                  </Text>
                </View>
                {selectedTransferId === defaultAccount._id && (
                  <Feather name="check-circle" size={20} color="#3b82f6" />
                )}
              </TouchableOpacity>
            )}

            {/* Other Account Options */}
            <Text className="dark:text-gray-400 text-gray-500 text-sm mb-2 mt-3">
              Or select another account:
            </Text>

            {transferOptions.map((acc) => (
              <TouchableOpacity
                key={acc._id}
                onPress={() => setSelectedTransferId(acc._id)}
                className={`flex-row items-center p-3 rounded-xl mb-2 border ${selectedTransferId === acc._id
                  ? 'bg-indigo-50 dark:bg-indigo-900/40 border-indigo-400 dark:border-indigo-600'
                  : 'dark:bg-gray-800 bg-gray-50 border-gray-200 dark:border-gray-700'
                  }`}
              >
                <View className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${selectedTransferId === acc._id ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'}`}>
                  <Feather name={typeIcon(acc.type)} size={14} color={selectedTransferId === acc._id ? 'white' : (isDark ? '#9ca3af' : '#6b7280')} />
                </View>
                <View className="flex-1">
                  <Text className={`font-semibold ${selectedTransferId === acc._id ? 'text-indigo-600 dark:text-indigo-300' : 'dark:text-white text-gray-900'}`}>
                    {acc.name}{acc.isDefault ? ' (Default)' : ''}
                  </Text>
                  <Text className="dark:text-gray-400 text-gray-500 text-xs">
                    Balance: {acc.currentBalance?.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                  </Text>
                </View>
                {selectedTransferId === acc._id && (
                  <Feather name="check-circle" size={20} color="#6366f1" />
                )}
              </TouchableOpacity>
            ))}

            <View className="flex-row gap-3 mt-4">
              <TouchableOpacity
                onPress={() => { setShowDeleteModal(false); setDeleteTarget(null); }}
                className="flex-1 bg-gray-200 dark:bg-gray-700 p-4 rounded-xl"
              >
                <Text className="text-center font-semibold text-gray-700 dark:text-gray-300">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDelete}
                disabled={deleting || !selectedTransferId}
                className={`flex-1 p-4 rounded-xl ${selectedTransferId ? 'bg-red-600' : 'bg-red-300 dark:bg-red-900'}`}
              >
                {deleting
                  ? <ActivityIndicator color="white" />
                  : <Text className="text-center font-semibold text-white">Delete & Transfer</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
