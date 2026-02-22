import { View, Text, SafeAreaView, Appearance } from 'react-native'
import React, { useState } from 'react'
import { RadioButton } from 'react-native-paper';
import { Feather, FontAwesome } from '@expo/vector-icons';
import { useThemeStore } from '@/store/themeStore';


const Theme = () => {
    const{setTheme,theme}= useThemeStore()
    const [current, setCurrent] = useState(theme);
    const applyTheme = async (theme: 'light' | 'dark' | null) => {
        Appearance.setColorScheme(theme);
        setCurrent(theme)
        setTheme(theme)
    };
    return (
        <SafeAreaView className='dark:bg-gray-900 bg-white' style={{ flex: 1 }}>
            <View className='p-6'>
                <View className='flex-row items-center gap-2'>
                <RadioButton.Android
                        value=""
                        status={current === null ? 
                                'checked' : 'unchecked'}
                        onPress={() => applyTheme(null)}
                        color="#6366f1"
                    />
                    <Text className='dark:text-white text-xl'>
                    <FontAwesome name='adjust' size={15}/> Automatic
                    </Text>
                </View>
                <View className='flex-row items-center gap-2 mt-2'>
                <RadioButton.Android
                        value="dark"
                        status={current === 'dark' ? 
                                'checked' : 'unchecked'}
                        onPress={() => applyTheme('dark')}
                        color="#6366f1"
                    />
                    <Text className='dark:text-white text-xl'>
                    <Feather name='moon' size={15}/> Dark
                    </Text>
                </View>
                <View className='flex-row items-center gap-2 mt-2'>
                <RadioButton.Android
                        value="light"
                        status={current === 'light' ? 
                                'checked' : 'unchecked'}
                        onPress={() => applyTheme('light')}
                        color="#6366f1"
                    />
                    <Text className='dark:text-white text-xl'>
                        <Feather name='sun' size={15}/> Light
                    </Text>
                </View>
            </View>
        </SafeAreaView>
    )
}

export default Theme