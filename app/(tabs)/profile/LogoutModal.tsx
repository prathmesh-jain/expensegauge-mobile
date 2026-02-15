import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native'
import React, { useState } from 'react'
import { Feather } from '@expo/vector-icons'
import { useAuthStore } from '@/store/authStore'
import api from '@/api/api'
import { router } from 'expo-router'
import { useExpenseStore } from '@/store/expenseStore'
import { useAdminStore } from '@/store/adminStore'
import { clearQueue, hasPendingUserMutationRequests } from '@/store/offlineQueue'

const LogoutModal = ({ setShow }: any) => {
    const { reset, refreshToken } = useAuthStore();
    const [loading, setLoading] = useState(false);
    const doLogout = async () => {
        setLoading(true);
        try {
            const response = await api.post(`/user/logout`, { refreshToken })
            const { reset: resetExpenseStore } = useExpenseStore.getState()
            const { reset: resetAdminStore } = useAdminStore.getState()
            resetExpenseStore()
            resetAdminStore()
            await clearQueue()
            reset()
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
        <View className='bg-black/70 flex-row items-center justify-center w-screen h-screen absolute top-0 left-0 -ml-6 -mt-6'>
            <View className='bg-white dark:bg-gray-900 flex-col w-10/12 rounded-lg border border-gray-200 dark:border-gray-800 shadow-md'>
                <View className=''>
                    <View className='flex-row items-center px-3 border-b border-gray-200 dark:border-gray-800'>
                        <Feather name='alert-triangle' color={'red'} size={20} />
                        <Text className='dark:text-white font-semibold p-4 px-3 text-lg'>Logout</Text>
                    </View>
                </View>
                <View className='p-3 px-10'>
                    <Text className='text-gray-500 dark:text-gray-300 mb-5'>Are you sure you want to logout?</Text>
                    <View className='flex-row gap-4 justify-end mb-2'>
                        <TouchableOpacity disabled={loading} className='border border-gray-300 dark:border-gray-600 rounded-md p-2 px-3' onPress={() => setShow(false)}>
                            <Text className='dark:text-gray-300'>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity disabled={loading} className='rounded-md p-2 px-3 bg-red-600 flex-row items-center justify-center min-w-[80px]' onPress={handleLogout}>
                            {loading ? (
                                <ActivityIndicator size="small" color="#ffffff" />
                            ) : (
                                <Text className='text-white'>Logout</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </View>
    )
}

export default LogoutModal
