import React from 'react';
import { ActivityIndicator, Modal, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

type Tone = 'danger' | 'primary';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  icon?: React.ComponentProps<typeof Feather>['name'];
  tone?: Tone;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

const TONES: Record<Tone, { iconBg: string; iconColor: string; button: string }> = {
  danger: { iconBg: 'bg-red-100 dark:bg-red-900/30', iconColor: '#ef4444', button: 'bg-red-600' },
  primary: { iconBg: 'bg-indigo-100 dark:bg-indigo-900/30', iconColor: '#6366f1', button: 'bg-indigo-600' },
};

// App-themed replacement for Alert.alert confirmations
export default function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel,
  icon = 'alert-triangle',
  tone = 'primary',
  loading = false,
  onCancel,
  onConfirm,
}: Props) {
  const colors = TONES[tone];
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onCancel}>
      <View className="flex-1 justify-center items-center bg-black/50 p-4">
        <View className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-2xl p-6 shadow-xl">
          <View className="items-center mb-4">
            <View className={`w-16 h-16 rounded-full items-center justify-center mb-3 ${colors.iconBg}`}>
              <Feather name={icon} size={28} color={colors.iconColor} />
            </View>
            <Text className="text-xl font-bold text-center dark:text-white">{title}</Text>
          </View>
          <Text className="text-gray-600 dark:text-gray-300 mb-6 text-center">{message}</Text>
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={onCancel}
              disabled={loading}
              className="flex-1 bg-gray-200 dark:bg-gray-700 p-4 rounded-xl"
            >
              <Text className="text-center font-semibold text-gray-700 dark:text-gray-300">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onConfirm}
              disabled={loading}
              className={`flex-1 p-4 rounded-xl ${colors.button}`}
            >
              {loading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className="text-center font-semibold text-white">{confirmLabel}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
