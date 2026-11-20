import { View, Text, Switch, Pressable, Linking, AppState, Platform } from 'react-native'
import React, { useCallback, useEffect, useState } from 'react'
import { Feather } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@/components/DateTimePicker';
import { Toast } from 'toastify-react-native';
import { formatReminderTime, useReminderStore } from '@/store/reminderStore';
import { hasNotificationPermission, requestNotificationPermission } from '@/helper/reminderService';


const Reminder = () => {
    const { enabled, hour, minute, setEnabled, setTime, setPromptHandled } = useReminderStore()
    const [permissionGranted, setPermissionGranted] = useState(true)
    const [showPicker, setShowPicker] = useState(false)

    const refreshPermission = useCallback(() => {
        hasNotificationPermission().then(setPermissionGranted)
    }, [])

    // Re-check when coming back from system settings
    useEffect(() => {
        refreshPermission()
        const sub = AppState.addEventListener('change', (status) => {
            if (status === 'active') refreshPermission()
        })
        return () => sub.remove()
    }, [refreshPermission])

    const toggleReminder = async (value: boolean) => {
        setPromptHandled()
        if (!value) {
            setEnabled(false)
            return
        }
        const granted = await requestNotificationPermission()
        setPermissionGranted(granted)
        if (granted) {
            setEnabled(true)
        } else {
            Toast.info('Allow notifications in Settings to get reminders')
        }
    }

    const onTimeChange = (event: DateTimePickerEvent, date?: Date) => {
        setShowPicker(Platform.OS === 'ios')
        if (event.type === 'set' && date) {
            setTime(date.getHours(), date.getMinutes())
        }
    }

    const isActive = enabled && permissionGranted

    return (
        <View className='dark:bg-gray-900 bg-white' style={{ flex: 1 }}>
            <View className='p-6'>
                <View className='flex-row items-center justify-between py-4 border-b dark:border-gray-600 border-gray-300'>
                    <View className='flex-1 pr-4'>
                        <Text className='dark:text-white text-gray-800 text-lg'>Remind me daily</Text>
                        <Text className='dark:text-gray-400 text-gray-500 text-sm mt-1'>
                            Skipped on days you&apos;ve already added an expense.
                        </Text>
                    </View>
                    <Switch
                        value={isActive}
                        onValueChange={toggleReminder}
                        trackColor={{ true: '#6366f1' }}
                        thumbColor={isActive ? '#ffffff' : undefined}
                    />
                </View>

                <Pressable
                    className='flex-row items-center justify-between py-5 border-b dark:border-gray-600 border-gray-300 dark:active:bg-gray-800 active:bg-gray-100'
                    onPress={() => setShowPicker(true)}
                    disabled={!isActive}
                    style={{ opacity: isActive ? 1 : 0.5 }}
                >
                    <Text className='dark:text-white text-gray-800 text-lg'>Time</Text>
                    <Text className='dark:text-gray-300 text-gray-600 text-lg'>
                        {formatReminderTime(hour, minute)} <Feather name='chevron-right' size={15} />
                    </Text>
                </Pressable>

                {enabled && !permissionGranted && (
                    <View className='mt-6 p-4 rounded-lg dark:bg-gray-800 bg-gray-100'>
                        <Text className='dark:text-gray-200 text-gray-700'>
                            Notifications are turned off for ExpenseGauge, so reminders can&apos;t be shown.
                        </Text>
                        <Pressable onPress={() => Linking.openSettings()} className='mt-3'>
                            <Text className='text-indigo-500 font-semibold'>Open Settings</Text>
                        </Pressable>
                    </View>
                )}

                {showPicker && (
                    <DateTimePicker
                        value={new Date(2000, 0, 1, hour, minute)}
                        mode='time'
                        onChange={onTimeChange}
                    />
                )}
            </View>
        </View>
    )
}

export default Reminder
