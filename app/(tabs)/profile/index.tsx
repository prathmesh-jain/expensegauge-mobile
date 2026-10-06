import { useAuthStore } from '@/store/authStore';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LogoutModal from './LogoutModal';
import api from '@/api/api';
import axios from 'axios';
import { Toast } from 'toastify-react-native';
import Avatar from '@/components/Avatar';
import { TextInput } from 'react-native';
import * as Device from 'expo-device';

import DateTimePicker from '@react-native-community/datetimepicker';
import { useColorScheme, Modal, Platform, ActivityIndicator } from 'react-native';
// when come back from insights to index page the total balance stats not changing and when going back to insights page it still shows graph of old data
const UserProfileScreen: React.FC = () => {
  const router = useRouter()
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.name);
  const email = useAuthStore((state) => state.email);
  const profilePicture = useAuthStore((state) => state.profilePicture);
  const setUser = useAuthStore((state) => state.setUser);
  const role = useAuthStore((state) => state.role);
  const viewMode = useAuthStore((state) => state.viewMode);
  const setViewMode = useAuthStore((state) => state.setViewMode);

  const inAdminMode = role === 'admin' && viewMode === 'admin';

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState(user || '');
  const [isSavingName, setIsSavingName] = useState(false);

  // Delete Account State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Feedback State
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [isSendingFeedback, setIsSendingFeedback] = useState(false);

  const handleSaveName = async () => {
    try {
      if (!newName.trim()) return Toast.error("Name cannot be empty");
      setIsSavingName(true);
      const res = await api.put('/user/update-profile', { name: newName });
      // Update store
      setUser(res.data.name, email!, role!, res.data.profilePicture);
      setIsEditing(false);
      Toast.success("Name updated successfully");
    } catch (error) {
      Toast.error("Failed to update name");
    } finally {
      setIsSavingName(false);
    }
  }

  const handleSwitchView = async () => {
    if (role !== 'admin') return;
    const nextMode: 'admin' | 'user' = viewMode === 'admin' ? 'user' : 'admin';
    setViewMode(nextMode);
    if (nextMode === 'admin') {
      router.navigate('/(tabs)/home/adminView');
    } else {
      router.navigate('/(tabs)/home');
    }
  }

  const handleUpgradeToAdmin = () => {
    if (role === 'admin') {
      setViewMode('admin');
      router.navigate('/(tabs)/home/adminView');
      return;
    }
    // Navigate to AdminPreview instead of directly upgrading
    router.push('/(auth)/AdminPreview');
  }

  const handleDeleteAccount = async () => {
    try {
      setIsDeletingAccount(true);
      // Call the public API endpoint to send deletion email
      const API_URL = process.env.EXPO_PUBLIC_API_URL as string;
      const res = await axios.post(`${API_URL}/api/v1/public/request-account-deletion`, {
        email: email
      });

      Toast.success("Deletion link sent to your email");
      setShowDeleteModal(false);
    } catch (error: any) {
      Toast.error(error.response?.data?.message || "Failed to send deletion email");
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleSendFeedback = async () => {
    if (!feedbackMessage.trim()) {
      Toast.error("Please enter a message");
      return;
    }
    if (feedbackMessage.length > 500) {
      Toast.error("Message must be less than 500 characters");
      return;
    }

    try {
      setIsSendingFeedback(true);
      const deviceInfo = {
        modelName: Device.modelName,
        brand: Device.brand,
        manufacturer: Device.manufacturer,
        deviceType: Device.deviceType,
        platform: Platform.OS,
        platformVersion: Platform.Version,
        ...Platform.constants,
      };

      await api.post('/user/send-feedback', {
        message: feedbackMessage,
        deviceInfo
      });

      Toast.success("Feedback sent successfully");
      setFeedbackMessage('');
      setShowFeedbackModal(false);
    } catch (error) {
      Toast.error("Failed to send feedback");
    } finally {
      setIsSendingFeedback(false);
    }
  };

  // Unified Report Modal State
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportType, setReportType] = useState('monthly');
  const [referenceDate, setReferenceDate] = useState(new Date());

  // Initialize safe dates
  const getLastWeek = () => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d;
  }
  const [customStart, setCustomStart] = useState(getLastWeek());
  const [customEnd, setCustomEnd] = useState(new Date());

  // Picker Target State
  const [showPicker, setShowPicker] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<'reference' | 'start' | 'end'>('reference');

  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const { calculatedStart, calculatedEnd, formattedRange } = useMemo(() => {
    let start = new Date();
    let end = new Date();
    let rangeStr = '';

    try {
      const d = new Date(referenceDate);

      if (reportType === 'weekly') {
        const day = d.getDay();
        const diff = d.getDate() - day;
        start = new Date(d);
        start.setDate(diff);
        start.setHours(0, 0, 0, 0);

        end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        rangeStr = `${start.toLocaleDateString()} - ${end.toLocaleDateString()} `;
      } else if (reportType === 'monthly') {
        start = new Date(d.getFullYear(), d.getMonth(), 1);
        end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
        rangeStr = d.toLocaleDateString('default', { month: 'long', year: 'numeric' });
      } else if (reportType === 'yearly') {
        start = new Date(d.getFullYear(), 0, 1);
        end = new Date(d.getFullYear(), 11, 31);
        end.setHours(23, 59, 59, 999);
        rangeStr = d.getFullYear().toString();
      } else if (reportType === 'custom') {
        start = new Date(customStart);
        end = new Date(customEnd);
        rangeStr = `${start.toLocaleDateString()} - ${end.toLocaleDateString()} `;
      }
    } catch (err) {
      console.error('[DEBUG] Calculation Error:', err);
    }

    return { calculatedStart: start, calculatedEnd: end, formattedRange: rangeStr };
  }, [reportType, referenceDate, customStart, customEnd]);

  // Admin specific state
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    if (inAdminMode && showReportModal && adminUsers.length === 0) {
      fetchAdminUsers();
    }
  }, [showReportModal, inAdminMode]);

  const fetchAdminUsers = async () => {
    try {
      setLoadingUsers(true);
      // Fetching users for report selection
      const res = await api.get('/admin/users?limit=100'); // Fetch a larger batch for selection
      setAdminUsers(res.data.users || []);
    } catch (error) {
      console.error("Failed to fetch users for report selection", error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleGenerate = async () => {
    if (reportType === 'custom' && calculatedStart > calculatedEnd) {
      Toast.error("Start date must be before end date");
      return;
    }

    if (inAdminMode && !selectedUserId) {
      Toast.error("Please select a user");
      return;
    }

    Toast.info(`Generating ${reportType} Report...`)
    setShowReportModal(false);
    try {
      await api.post('/expense/report/generate', {
        type: reportType,
        startDate: calculatedStart.toISOString(),
        endDate: calculatedEnd.toISOString(),
        targetUserId: inAdminMode ? selectedUserId : undefined
      })
      Toast.success(`Report sent to ${email} `)
    } catch (e) {
      Toast.error("Failed to generate report")
    }
  };

  return (
    <SafeAreaView className='dark:bg-gray-900 bg-white' style={{ flex: 1 }}>
      <ScrollView className="px-6 pt-10" contentContainerStyle={{ paddingBottom: 80 + insets.bottom }}>
        <View className="items-center mb-6">
          <Avatar uri={profilePicture} name={user || 'User'} size={100} />
          <View className="flex-row items-center mt-3 gap-2">
            {isEditing ? (
              <View className="flex-row items-center gap-4">
                <TextInput
                  value={newName}
                  onChangeText={setNewName}
                  editable={!isSavingName}
                  className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xl font-bold text-gray-900 dark:text-white min-w-[150px] text-center"
                />
                {isSavingName ? (
                  <ActivityIndicator size="small" color="#1e40af" />
                ) : (
                  <View className="flex-row items-center gap-3">
                    <TouchableOpacity onPress={handleSaveName}>
                      <Feather name="check" size={22} color="#16a34a" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { setIsEditing(false); setNewName(user || '') }}>
                      <Feather name="x" size={22} color="#dc2626" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ) : (
              <>
                <Text className="text-xl font-bold text-gray-900 dark:text-white">{user}</Text>
                <TouchableOpacity onPress={() => setIsEditing(true)}>
                  <Feather name="edit-2" size={16} color={isDark ? '#9ca3af' : '#4b5563'} />
                </TouchableOpacity>
              </>
            )}
          </View>
          <Text className="text-sm text-gray-500 dark:text-gray-400">{email}</Text>
        </View>

        <View className='mt-10'>
          <Text className="text-lg font-semibold text-gray-800 dark:text-white mb-3">
            Settings
          </Text>

          <View className=" p-2 mb-2">

            {role === 'admin' ? (
              <Pressable
                className="flex-row justify-between items-center border-b dark:border-gray-600 border-gray-300 dark:active:bg-gray-800 active:bg-gray-100"
                onPress={handleSwitchView}
              >
                <Text className="text-base text-gray-700 dark:text-gray-200 py-6">
                  {viewMode === 'admin' ? 'Switch to Normal User View' : 'Switch to Admin View'}
                </Text>
                <Text className="text-base text-gray-500 dark:text-gray-300 py-6 px-1">
                  <Feather name='repeat' size={15} />
                </Text>
              </Pressable>
            ) : (
              <Pressable
                className="flex-row justify-between items-center border-b dark:border-gray-600 border-gray-300 dark:active:bg-gray-800 active:bg-gray-100"
                onPress={handleUpgradeToAdmin}
              >
                <Text className="text-base text-gray-700 dark:text-gray-200 py-6">
                  Request Admin Access
                </Text>
                <View className="flex-row items-center py-6 px-1">
                  <Text className="text-base text-gray-500 dark:text-gray-300">
                    <Feather name='chevron-right' size={15} />
                  </Text>
                </View>
              </Pressable>
            )}

            <Pressable className="flex-row justify-between items-center border-b dark:border-gray-600 border-gray-300 dark:active:bg-gray-800 active:bg-gray-100" onPress={() => router.navigate('/profile/accounts' as any)}>
              <Text className="text-base text-gray-700 dark:text-gray-200 py-6">Manage Accounts</Text>
              <Text className="text-base text-gray-500 dark:text-gray-300 py-6 px-1"><Feather name='credit-card' size={15} /></Text>
            </Pressable>
            <Pressable className="flex-row justify-between items-center border-b dark:border-gray-600 border-gray-300 dark:active:bg-gray-800 active:bg-gray-100" onPress={() => setShowReportModal(true)}>
              <Text className="text-base text-gray-700 dark:text-gray-200 py-6">Download Expense Report</Text>
              <Text className="text-base text-gray-500 dark:text-gray-300 py-6 px-1"><Feather name='download' size={15} /></Text>
            </Pressable>

            <Pressable className="flex-row justify-between items-center border-b dark:border-gray-600 border-gray-300 dark:active:bg-gray-800 active:bg-gray-100" onPress={() => router.navigate('/profile/theme')}>
              <Text className="text-base text-gray-700 dark:text-gray-200 py-6">Change Theme</Text>
              <Text className="text-base text-gray-500 dark:text-gray-300 py-6 px-1"><Feather name='chevron-right' size={15} /></Text>
            </Pressable>
            <Pressable className="flex-row justify-between items-center border-b dark:border-gray-600 border-gray-300 dark:active:bg-gray-800 active:bg-gray-100" onPress={() => router.navigate('/profile/changePassword')}>
              <Text className="text-base text-gray-700 dark:text-gray-200 py-6">Change Password</Text>
              <Text className="text-base text-gray-500 dark:text-gray-300 py-6 px-1"><Feather name='chevron-right' size={15} /></Text>
            </Pressable>
            <Pressable className="flex-row justify-between items-center border-b dark:border-gray-600 border-gray-300 dark:active:bg-gray-800 active:bg-gray-100" onPress={() => setShowFeedbackModal(true)}>
              <Text className="text-base text-gray-700 dark:text-gray-200 py-6">Send Feedback</Text>
              <Text className="text-base text-gray-500 dark:text-gray-300 py-6 px-1"><Feather name='message-circle' size={15} /></Text>
            </Pressable>
            <TouchableOpacity className="py-6" onPress={() => setShowLogoutModal(true)}>
              <Text className="text-base text-red-600 dark:text-red-400 font-semibold">
                Log Out
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Delete Account Button - Small and centered at bottom */}
        <View className="mb-5 flex-row justify-between">
          <TouchableOpacity
            onPress={() => setShowDeleteModal(true)}
            className=""
          >
            <Text className="text-sm text-red-600/80 dark:text-red-200/80 font-medium">
              Delete Account
            </Text>
          </TouchableOpacity>

          {/* Privacy Policy Link - Bottom right */}
            <TouchableOpacity
              onPress={() => Linking.openURL(process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL || 'https://expensegauge.prathmeshjain.in/privacy')}
            >
              <Text className="text-xs text-gray-400 dark:text-gray-500 underline">
                Privacy Policy
              </Text>
            </TouchableOpacity>
        </View>

        {showLogoutModal && <LogoutModal show={showLogoutModal} setShow={setShowLogoutModal} />}

        <Modal
          animationType="fade"
          transparent={true}
          visible={showReportModal}
          onRequestClose={() => setShowReportModal(false)}
        >
          <View className="flex-1 justify-center items-center bg-black/50 p-4">
            <View className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-2xl p-6 shadow-xl">
              <Text className="text-xl font-bold mb-6 text-center dark:text-white">Export Expenses</Text>

              <View className="flex-row justify-between mb-6 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                {['weekly', 'monthly', 'yearly', 'custom'].map((t) => {
                  const isActive = reportType === t;
                  return (
                    <TouchableOpacity
                      key={t}
                      onPress={() => setReportType(t)}
                      style={{
                        flex: 1,
                        paddingVertical: 8,
                        borderRadius: 8,
                        backgroundColor: isActive ? (isDark ? '#4B5563' : '#FFFFFF') : 'transparent',
                        shadowColor: isActive ? '#000' : 'transparent',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: isActive ? 0.2 : 0,
                        shadowRadius: 1,
                        elevation: isActive ? 2 : 0,
                      }}
                    >
                      <Text
                        style={{
                          textAlign: 'center',
                          fontSize: 12,
                          fontWeight: '500',
                          textTransform: 'capitalize',
                          color: isActive ? (isDark ? '#FFFFFF' : '#4F46E5') : (isDark ? '#9CA3AF' : '#6B7280')
                        }}
                      >
                        {t}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {inAdminMode && (
                <View className="mb-6">
                  <Text className="text-gray-600 dark:text-gray-300 mb-2 font-medium">Select User</Text>
                  {loadingUsers ? (
                    <ActivityIndicator size="small" color="#4F46E5" />
                  ) : (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      className="flex-row gap-2"
                    >
                      {adminUsers.map((u) => {
                        const isSelected = selectedUserId === u._id;
                        return (
                          <TouchableOpacity
                            key={u._id}
                            onPress={() => setSelectedUserId(isSelected ? null : u._id)}
                            className={`px-3 py-2 rounded-xl border ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700'}`}
                          >
                            <Text className={`text-xs ${isSelected ? 'text-white font-bold' : 'text-gray-700 dark:text-gray-300'}`}>
                              {u.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                      {adminUsers.length === 0 && (
                        <Text className="text-gray-400 text-xs italic">No users found</Text>
                      )}
                    </ScrollView>
                  )}
                </View>
              )}

              {reportType === 'yearly' && (
                <View className="mb-6">
                  <Text className="text-gray-600 dark:text-gray-300 mb-3 font-medium text-center">Select Year</Text>
                  <View className="flex-row flex-wrap justify-center gap-2">
                    {[0, 1, 2, 3, 4, 5].map((i) => {
                      const yr = new Date().getFullYear() - i;
                      const isSel = referenceDate.getFullYear() === yr;
                      return (
                        <TouchableOpacity
                          key={yr}
                          onPress={() => {
                            const d = new Date(referenceDate);
                            d.setFullYear(yr);
                            setReferenceDate(d);
                          }}
                          className={`px-4 py-2 rounded-xl border ${isSel ? 'bg-indigo-600 border-indigo-600' : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700'}`}
                        >
                          <Text className={isSel ? 'text-white font-bold' : 'text-gray-700 dark:text-gray-300'}>{yr}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {reportType === 'monthly' && (
                <View className="mb-6">
                  <View className="flex-row justify-between items-center mb-4 px-2">
                    <TouchableOpacity onPress={() => {
                      const d = new Date(referenceDate);
                      d.setFullYear(d.getFullYear() - 1);
                      setReferenceDate(d);
                    }}>
                      <Feather name="chevron-left" size={20} color={isDark ? 'white' : 'gray'} />
                    </TouchableOpacity>
                    <Text className="text-lg font-bold dark:text-white">{referenceDate.getFullYear()}</Text>
                    <TouchableOpacity onPress={() => {
                      const d = new Date(referenceDate);
                      d.setFullYear(d.getFullYear() + 1);
                      setReferenceDate(d);
                    }}>
                      <Feather name="chevron-right" size={20} color={isDark ? 'white' : 'gray'} />
                    </TouchableOpacity>
                  </View>
                  <View className="flex-row flex-wrap justify-between gap-y-2">
                    {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, idx) => {
                      const isSel = referenceDate.getMonth() === idx;
                      return (
                        <TouchableOpacity
                          key={m}
                          onPress={() => {
                            const d = new Date(referenceDate);
                            d.setMonth(idx);
                            setReferenceDate(d);
                          }}
                          style={{ width: '31%' }}
                          className={`py-2 rounded-lg border ${isSel ? 'bg-indigo-600 border-indigo-600' : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700'}`}
                        >
                          <Text className={`text-center text-xs ${isSel ? 'text-white font-bold' : 'text-gray-600 dark:text-gray-400'}`}>{m}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {reportType === 'weekly' && (
                <View className="mb-6">
                  <Text className="text-gray-600 dark:text-gray-300 mb-2 font-medium">Select Week (pick any day)</Text>
                  <TouchableOpacity
                    onPress={() => { setShowPicker(true); setPickerTarget('reference'); }}
                    className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-4 rounded-xl flex-row justify-between items-center"
                  >
                    <Text className="dark:text-white text-base">
                      {formattedRange}
                    </Text>
                    <Feather name="calendar" size={18} color={isDark ? "white" : "gray"} />
                  </TouchableOpacity>
                </View>
              )}

              {reportType === 'custom' && (
                <View className="mb-6">
                  <View className="mb-4">
                    <Text className="text-gray-600 dark:text-gray-300 mb-2 font-medium">Start Date</Text>
                    <TouchableOpacity
                      onPress={() => { setShowPicker(true); setPickerTarget('start'); }}
                      className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3 rounded-xl flex-row justify-between items-center"
                    >
                      <Text className="dark:text-white">{customStart.toDateString()}</Text>
                      <Feather name="calendar" size={18} color={isDark ? "white" : "gray"} />
                    </TouchableOpacity>
                  </View>
                  <View>
                    <Text className="text-gray-600 dark:text-gray-300 mb-2 font-medium">End Date</Text>
                    <TouchableOpacity
                      onPress={() => { setShowPicker(true); setPickerTarget('end'); }}
                      className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3 rounded-xl flex-row justify-between items-center"
                    >
                      <Text className="dark:text-white">{customEnd.toDateString()}</Text>
                      <Feather name="calendar" size={18} color={isDark ? "white" : "gray"} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {showPicker && (
                <DateTimePicker
                  value={
                    pickerTarget === 'reference' ? referenceDate :
                      pickerTarget === 'start' ? customStart :
                        customEnd
                  }
                  mode="date"
                  display="default"
                  maximumDate={new Date()}
                  onChange={(event, date) => {
                    setShowPicker(Platform.OS === 'ios');
                    if (event.type === 'set' && date) {
                      if (pickerTarget === 'reference') setReferenceDate(date);
                      if (pickerTarget === 'start') setCustomStart(date);
                      if (pickerTarget === 'end') setCustomEnd(date);
                    } else if (event.type === 'dismissed') {
                      setShowPicker(false);
                    }
                  }}
                />
              )}

              <View className="flex-row gap-3">
                <TouchableOpacity onPress={() => setShowReportModal(false)} className="flex-1 bg-gray-200 dark:bg-gray-700 p-4 rounded-xl">
                  <Text className="text-center font-semibold text-gray-700 dark:text-gray-300">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleGenerate} className="flex-1 bg-indigo-600 p-4 rounded-xl">
                  <Text className="text-center font-semibold text-white">Generate PDF</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Delete Account Modal */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={showDeleteModal}
          onRequestClose={() => setShowDeleteModal(false)}
        >
          <View className="flex-1 justify-center items-center bg-black/50 p-4">
            <View className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-2xl p-6 shadow-xl">
              <View className="items-center mb-4">
                <View className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 items-center justify-center mb-3">
                  <Feather name="trash-2" size={28} color="#dc2626" />
                </View>
                <Text className="text-xl font-bold text-center dark:text-white">Delete Account</Text>
              </View>

              <View className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
                <Text className="text-red-800 dark:text-red-200 text-sm text-center">
                  This action cannot be undone. All your data including expenses, accounts, and personal information will be permanently deleted.
                </Text>
              </View>

              <Text className="text-gray-600 dark:text-gray-300 mb-6 text-center">
                A confirmation link will be sent to your email address. Click the link in the email to confirm account deletion.
              </Text>

              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={() => setShowDeleteModal(false)}
                  className="flex-1 bg-gray-200 dark:bg-gray-700 p-4 rounded-xl"
                  disabled={isDeletingAccount}
                >
                  <Text className="text-center font-semibold text-gray-700 dark:text-gray-300">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleDeleteAccount}
                  className="flex-1 bg-red-600 p-4 rounded-xl"
                  disabled={isDeletingAccount}
                >
                  {isDeletingAccount ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text className="text-center font-semibold text-white">Send Link</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Feedback Modal */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={showFeedbackModal}
          onRequestClose={() => setShowFeedbackModal(false)}
        >
          <View className="flex-1 justify-center items-center bg-black/50 p-4">
            <View className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-2xl p-6 shadow-xl">
              <Text className="text-xl font-bold mb-4 text-center dark:text-white">Send Feedback</Text>

              <Text className="text-gray-600 dark:text-gray-300 mb-2 text-sm">
                We'd love to hear from you! Please share your thoughts, suggestions, or report any issues.
              </Text>

              <TextInput
                value={feedbackMessage}
                onChangeText={setFeedbackMessage}
                placeholder="Enter your feedback..."
                placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                multiline
                numberOfLines={4}
                maxLength={500}
                editable={!isSendingFeedback}
                className="border border-gray-300 dark:border-gray-600 rounded-xl p-3 text-gray-900 dark:text-white mb-2 min-h-[100px]"
                style={{ textAlignVertical: 'top' }}
              />

              <Text className="text-gray-400 dark:text-gray-500 text-xs mb-4 text-right">
                {feedbackMessage.length}/500
              </Text>

              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={() => {
                    setShowFeedbackModal(false);
                    setFeedbackMessage('');
                  }}
                  className="flex-1 bg-gray-200 dark:bg-gray-700 p-4 rounded-xl"
                  disabled={isSendingFeedback}
                >
                  <Text className="text-center font-semibold text-gray-700 dark:text-gray-300">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSendFeedback}
                  className="flex-1 bg-indigo-600 p-4 rounded-xl"
                  disabled={isSendingFeedback}
                >
                  {isSendingFeedback ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text className="text-center font-semibold text-white">Send</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

      </ScrollView>
    </SafeAreaView>
  );
};

export default UserProfileScreen;
