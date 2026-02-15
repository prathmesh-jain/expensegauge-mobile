import { useAuthStore } from '@/store/authStore';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LogoutModal from './LogoutModal';
import api from '@/api/api';
import { Toast } from 'toastify-react-native';
import Avatar from '@/components/Avatar';
import { TextInput } from 'react-native';

import DateTimePicker from '@react-native-community/datetimepicker';
import { useColorScheme, Modal, Platform, ActivityIndicator } from 'react-native';

const UserProfileScreen: React.FC = () => {
  const router = useRouter()
  const user = useAuthStore((state) => state.name);
  const email = useAuthStore((state) => state.email);
  const profilePicture = useAuthStore((state) => state.profilePicture);
  const setUser = useAuthStore((state) => state.setUser);
  const role = useAuthStore((state) => state.role);
  const viewMode = useAuthStore((state) => state.viewMode);
  const setViewMode = useAuthStore((state) => state.setViewMode);
  const setTokens = useAuthStore((state) => state.setTokens);

  const inAdminMode = role === 'admin' && viewMode === 'admin';

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState(user || '');
  const [isSavingName, setIsSavingName] = useState(false);
  const [isUpgradingToAdmin, setIsUpgradingToAdmin] = useState(false);

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

  // Logging for debugging
  useEffect(() => {
  }, [showReportModal, reportType, referenceDate, pickerTarget]);

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

    setShowReportModal(false);
    try {
      Toast.info(`Generating ${reportType} Report...`)
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
      <ScrollView className="px-6 pt-10" contentContainerStyle={{ paddingBottom: 32 }}>
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

          <View className=" p-2 mb-6">

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
                disabled={isUpgradingToAdmin}
              >
                <Text className="text-base text-gray-700 dark:text-gray-200 py-6">
                  Register for Admin View
                </Text>
                <View className="flex-row items-center py-6 px-1">
                  {isUpgradingToAdmin ? (
                    <ActivityIndicator size="small" color={isDark ? '#FFFFFF' : '#111827'} />
                  ) : (
                    <Text className="text-base text-gray-500 dark:text-gray-300">
                      <Feather name='chevron-right' size={15} />
                    </Text>
                  )}
                </View>
              </Pressable>
            )}

            <Pressable
              className="flex-row justify-between items-center border-b dark:border-gray-600 border-gray-300 dark:active:bg-gray-800 active:bg-gray-100"
              onPress={() => setShowReportModal(true)}
            >
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
            <TouchableOpacity className="py-6" onPress={() => setShowLogoutModal(true)}>
              <Text className="text-base text-red-600 dark:text-red-400 font-semibold">
                Log Out
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {showLogoutModal && <LogoutModal setShow={setShowLogoutModal} />}

        {/* Unified Report Modal */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={showReportModal}
          onRequestClose={() => setShowReportModal(false)}
        >
          <View className="flex-1 justify-center items-center bg-black/50 p-4">
            <View className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-2xl p-6 shadow-xl">
              <Text className="text-xl font-bold mb-6 text-center dark:text-white">Export Expenses</Text>

              {/* Types */}
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

              {/* Admin User Selection */}
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

              {/* Dynamic Inputs */}
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

              {/* Single Picker Instance */}
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

      </ScrollView>
    </SafeAreaView>
  );
};

export default UserProfileScreen;
