import { Pressable, Text } from 'react-native'
import React from 'react'
import { Feather } from '@expo/vector-icons'

type Props = {
    label: string;
    onPress: () => void;
    // Short current value shown before the icon, e.g. "9:00 pm" or "₹"
    value?: string;
    icon?: React.ComponentProps<typeof Feather>['name'];
    danger?: boolean;
};

const SettingsRow = ({ label, onPress, value, icon = 'chevron-right', danger }: Props) => (
    <Pressable
        className="flex-row justify-between items-center border-b dark:border-gray-700 border-gray-300 dark:active:bg-gray-800 active:bg-gray-100"
        onPress={onPress}
    >
        <Text className={`text-base py-6 ${danger ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-gray-700 dark:text-gray-200'}`}>
            {label}
        </Text>
        <Text className="text-base text-gray-500 dark:text-gray-300 py-6 px-1">
            {value ? `${value} ` : ''}<Feather name={icon} size={15} />
        </Text>
    </Pressable>
)

export default SettingsRow
