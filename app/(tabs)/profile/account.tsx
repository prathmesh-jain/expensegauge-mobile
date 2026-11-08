import { View, Text, SafeAreaView, TouchableOpacity, Modal, ActivityIndicator, Linking } from 'react-native'
import React, { useState } from 'react'
import { useRouter } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import axios from 'axios'
import { Toast } from 'toastify-react-native'
import SettingsRow from '@/components/SettingsRow'
import { useAuthStore } from '@/store/authStore'

const AccountSecurity = () => {
    const router = useRouter()
    const email = useAuthStore((state) => state.email)
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [isDeletingAccount, setIsDeletingAccount] = useState(false)

    const handleDeleteAccount = async () => {
        try {
            setIsDeletingAccount(true);
            // Call the public API endpoint to send deletion email
            const API_URL = process.env.EXPO_PUBLIC_API_URL as string;
            await axios.post(`${API_URL}/api/v1/public/request-account-deletion`, {
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

    return (
        <SafeAreaView className='dark:bg-gray-900 bg-white' style={{ flex: 1 }}>
            <View className='px-6 pt-2'>
                <SettingsRow label="Change Password" onPress={() => router.navigate('/profile/changePassword')} />
                <SettingsRow
                    label="Privacy Policy"
                    icon="external-link"
                    onPress={() => Linking.openURL(process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL || 'https://expensegauge.prathmeshjain.in/privacy')}
                />
                <SettingsRow label="Delete Account" icon="trash-2" danger onPress={() => setShowDeleteModal(true)} />
            </View>

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
        </SafeAreaView>
    )
}

export default AccountSecurity
