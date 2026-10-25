import { View, Text, SafeAreaView, ScrollView, Pressable } from 'react-native'
import React from 'react'
import { RadioButton } from 'react-native-paper';
import { CURRENCY_OPTIONS, useCurrencyStore } from '@/store/currencyStore';


const Currency = () => {
    const { symbol, setSymbol } = useCurrencyStore()
    return (
        <SafeAreaView className='dark:bg-gray-900 bg-white' style={{ flex: 1 }}>
            <ScrollView className='p-6'>
                {CURRENCY_OPTIONS.map((option) => (
                    <Pressable key={option.symbol} className='flex-row items-center gap-2 mb-2' onPress={() => setSymbol(option.symbol)}>
                        <RadioButton.Android
                            value={option.symbol}
                            status={symbol === option.symbol ? 'checked' : 'unchecked'}
                            onPress={() => setSymbol(option.symbol)}
                            color="#6366f1"
                        />
                        <Text className='dark:text-white text-xl w-14'>{option.symbol}</Text>
                        <Text className='dark:text-gray-300 text-gray-600 text-base'>{option.label}</Text>
                    </Pressable>
                ))}
                <Text className='dark:text-gray-400 text-gray-500 text-sm mt-4'>
                    Only the symbol shown in the app changes. Amounts are not converted.
                </Text>
            </ScrollView>
        </SafeAreaView>
    )
}

export default Currency
