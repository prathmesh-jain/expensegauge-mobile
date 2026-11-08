import { View, SafeAreaView } from 'react-native'
import React from 'react'
import { useRouter } from 'expo-router'
import SettingsRow from '@/components/SettingsRow'
import { useThemeStore } from '@/store/themeStore'
import { useCurrencySymbol } from '@/store/currencyStore'

const THEME_LABELS = { light: 'Light', dark: 'Dark' } as const;

const Preferences = () => {
    const router = useRouter()
    const theme = useThemeStore((state) => state.theme)
    const currencySymbol = useCurrencySymbol()

    return (
        <SafeAreaView className='dark:bg-gray-900 bg-white' style={{ flex: 1 }}>
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
            </View>
        </SafeAreaView>
    )
}

export default Preferences
