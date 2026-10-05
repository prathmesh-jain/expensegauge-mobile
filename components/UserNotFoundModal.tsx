import { View, Text, TouchableOpacity, Modal } from 'react-native'
import React from 'react'
import { Feather } from '@expo/vector-icons'
import { useColorScheme } from 'react-native'

const UserNotFoundModal = ({ show, onOk }: { show: boolean; onOk: () => void }) => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={show}
            onRequestClose={() => {}} // Prevent back button dismissal
        >
            <View className="flex-1 justify-center items-center bg-black/50 p-4">
                <View className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-2xl p-6 shadow-xl">
                    <View className="items-center mb-4">
                        <View className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 items-center justify-center mb-3">
                            <Feather name="user-x" size={28} color="#dc2626" />
                        </View>
                        <Text className="text-xl font-bold text-center dark:text-white">Account Not Found</Text>
                    </View>

                    <View className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
                        <Text className="text-red-800 dark:text-red-200 text-sm text-center">
                            Your account could not be found. It may have been deleted. You will be logged out now.
                        </Text>
                    </View>

                    <Text className="text-gray-600 dark:text-gray-300 mb-6 text-center">
                        Please sign in again if you believe this is an error.
                    </Text>

                    <TouchableOpacity
                        onPress={onOk}
                        className="bg-red-600 p-4 rounded-xl"
                    >
                        <Text className="text-center font-semibold text-white">OK</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    )
}

export default UserNotFoundModal
