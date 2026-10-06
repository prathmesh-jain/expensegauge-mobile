import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Modal } from 'react-native'
import React, { useState } from 'react'
import { Feather } from '@expo/vector-icons'
import { useAuthStore } from '@/store/authStore'
import { useAccountStore } from '@/store/accountStore'
import api from '@/api/api'
import { router } from 'expo-router'
import { useExpenseStore } from '@/store/expenseStore'
import { useAdminStore } from '@/store/adminStore'
import { clearQueue, hasPendingUserMutationRequests } from '@/store/offlineQueue'
import { useColorScheme } from 'react-native'

const LogoutModal = ({ show, setShow }: { show: boolean; setShow: (show: boolean) => void }) => {
    const { logout, refreshToken } = useAuthStore();
    const [loading, setLoading] = useState(false);
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    const doLogout = async () => {
        setLoading(true);
        try {
            // Try to call logout API, but proceed even if it fails
            try {
                await api.post(`/user/logout`, { refreshToken });
            } catch (apiError) {
                console.error('Logout API failed, proceeding with local logout:', apiError);
            }

            const { reset: resetExpenseStore } = useExpenseStore.getState()
            const { reset: resetAdminStore } = useAdminStore.getState()
            const { reset: resetAccountStore } = useAccountStore.getState()
            resetExpenseStore()
            resetAdminStore()
            resetAccountStore()
            await clearQueue()
            await logout()
            setShow(false)
            router.replace('/')
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    const handleLogout = async () => {
        try {
            const hasPending = await hasPendingUserMutationRequests();
            if (hasPending) {
                Alert.alert(
                    'Pending requests',
                    'There are some pending offline requests. Logging out now may discard them. Do you still want to logout?',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Logout', style: 'destructive', onPress: () => { void doLogout(); } },
                    ]
                );
                return;
            }
        } catch (e) {
            console.error(e);
        }

        await doLogout();
    };

    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={show}
            onRequestClose={() => setShow(false)}
        >
            <View className="flex-1 justify-center items-center bg-black/50 p-4">
                <View className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-2xl p-6 shadow-xl">
                    <View className="items-center mb-4">
                        <View className="w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-900/30 items-center justify-center mb-3">
                            <Feather name="log-out" size={28} color="#f97316" />
                        </View>
                        <Text className="text-xl font-bold text-center dark:text-white">Logout</Text>
                    </View>

                    <Text className="text-gray-600 dark:text-gray-300 mb-6 text-center">
                        Are you sure you want to logout? You'll need to sign in again to access your account.
                    </Text>

                    <View className="flex-row gap-3">
                        <TouchableOpacity
                            onPress={() => setShow(false)}
                            className="flex-1 bg-gray-200 dark:bg-gray-700 p-4 rounded-xl"
                            disabled={loading}
                        >
                            <Text className="text-center font-semibold text-gray-700 dark:text-gray-300">Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={handleLogout}
                            className="flex-1 bg-orange-600 p-4 rounded-xl"
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color="white" />
                            ) : (
                                <Text className="text-center font-semibold text-white">Logout</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    )
}

export default LogoutModal
