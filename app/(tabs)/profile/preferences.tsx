import { View, Text, Switch } from 'react-native'
import React, { useEffect, useState } from 'react'
import { useRouter } from 'expo-router'
import { Toast } from 'toastify-react-native'
import SettingsRow from '@/components/SettingsRow'
import { useThemeStore } from '@/store/themeStore'
import { useCurrencySymbol } from '@/store/currencyStore'
import { useAuthStore } from '@/store/authStore'
import { useGroupStore } from '@/store/groupStore'
import api from '@/api/api'
import { supportsNotifications } from '@/helper/reminderService'

const THEME_LABELS = { light: 'Light', dark: 'Dark' } as const;

const Preferences = () => {
    const router = useRouter()
    const theme = useThemeStore((state) => state.theme)
    const currencySymbol = useCurrencySymbol()
    const inAdminMode = useAuthStore((state) => state.role === 'admin' && state.viewMode === 'admin')

    // Account-wide: turning it off mutes every group. Turning it back on only
    // restores each group's own setting; groups are switched on one by one.
    const notificationsOn = useGroupStore((state) => state.notificationsOn)
    const setNotificationsOn = useGroupStore((state) => state.setNotificationsOn)
    const [loaded, setLoaded] = useState(false)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (inAdminMode) return
        api.get('/notifications/settings')
            .then((res) => {
                setNotificationsOn(res.data.settings.groups)
                setLoaded(true)
            })
            .catch(() => setLoaded(false))
    }, [inAdminMode, setNotificationsOn])

    const toggle = async (value: boolean) => {
        setSaving(true)
        try {
            const res = await api.patch('/notifications/settings', { groups: value }, { headers: { 'x-online-only': '1' } })
            setNotificationsOn(res.data.settings.groups)
        } catch {
            Toast.error("Couldn't save. Check your connection and try again.")
        } finally {
            setSaving(false)
        }
    }

    return (
        <View className='dark:bg-gray-900 bg-white' style={{ flex: 1 }}>
            <View className='px-6 pt-2'>
                <SettingsRow
                    label="Theme"
                    value={theme ? THEME_LABELS[theme] : 'Automatic'}
                    onPress={() => router.navigate('/profile/theme')}
                />
                <SettingsRow
                    label="Currency Symbol"
                    value={currencySymbol}
                    onPress={() => router.navigate('/profile/currency' as any)}
                />
                {!inAdminMode && supportsNotifications && (
                    <View className="flex-row justify-between items-center border-b dark:border-gray-700 border-gray-300 py-4">
                        <View className="flex-1 pr-4">
                            <Text className="text-base text-gray-700 dark:text-gray-200">Group notifications</Text>
                            <Text className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                {!loaded
                                    ? 'Connect to the internet to change this'
                                    : notificationsOn
                                        ? 'Turn off to mute all groups. Choose which groups notify you in each group\'s settings.'
                                        : 'All groups are muted.'}
                            </Text>
                        </View>
                        <Switch
                            value={notificationsOn}
                            disabled={!loaded || saving}
                            onValueChange={toggle}
                            trackColor={{ false: '#9ca3af', true: '#818cf8' }}
                            thumbColor={notificationsOn ? '#4f46e5' : '#f4f4f5'}
                        />
                    </View>
                )}
            </View>
        </View>
    )
}

export default Preferences
