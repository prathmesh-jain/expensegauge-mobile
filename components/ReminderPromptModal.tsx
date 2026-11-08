import { View, Text, TouchableOpacity, Modal } from 'react-native'
import React from 'react'
import { Feather } from '@expo/vector-icons'
import { Toast } from 'toastify-react-native'
import { formatReminderTime, useReminderStore } from '@/store/reminderStore'
import { requestNotificationPermission } from '@/helper/reminderService'

const ReminderPromptModal = () => {
    const { promptVisible, hour, minute, setPromptVisible, setEnabled } = useReminderStore();

    const turnOn = async () => {
        // Close first so the system permission dialog isn't stacked on top of this one
        setPromptVisible(false);
        if (await requestNotificationPermission()) {
            setEnabled(true);
            Toast.success('Daily reminder turned on');
        } else {
            Toast.info('Notifications are off. You can turn the reminder on later in Profile.');
        }
    };

    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={promptVisible}
            onRequestClose={() => setPromptVisible(false)}
        >
            <View className="flex-1 justify-center items-center bg-black/50 p-4">
                <View className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-2xl p-6 shadow-xl">
                    <View className="items-center mb-4">
                        <View className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900/30 items-center justify-center mb-3">
                            <Feather name="bell" size={28} color="#6366f1" />
                        </View>
                        <Text className="text-xl font-bold text-center dark:text-white">Never miss an expense</Text>
                    </View>

                    <Text className="text-gray-600 dark:text-gray-300 mb-2 text-center">
                        Get a gentle reminder at {formatReminderTime(hour, minute)} each day to add your expenses.
                    </Text>
                    <Text className="text-gray-400 dark:text-gray-400 text-sm mb-6 text-center">
                        Skipped on days you&apos;ve already added one. You can change the time in Profile.
                    </Text>

                    <View className="flex-row gap-3">
                        <TouchableOpacity
                            onPress={() => setPromptVisible(false)}
                            className="flex-1 bg-gray-200 dark:bg-gray-700 p-4 rounded-xl"
                        >
                            <Text className="text-center font-semibold text-gray-700 dark:text-gray-300">Not now</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={turnOn}
                            className="flex-1 bg-indigo-600 p-4 rounded-xl"
                        >
                            <Text className="text-center font-semibold text-white">Turn on</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    )
}

export default ReminderPromptModal
