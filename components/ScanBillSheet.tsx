import React, { useState } from 'react';
import { ActivityIndicator, Modal, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Toast } from 'toastify-react-native';
import { scanBill, type ScanSource } from '@/helper/scanBill';
import type { ParsedExpense } from '@/helper/expenseParser';

type Props = {
  visible: boolean;
  onClose: () => void;
  // Called with what was read; the caller fills its form
  onScanned: (parsed: ParsedExpense, category?: string) => void;
};

// "Take a photo / Choose from gallery", then reads the bill on the phone
export default function ScanBillSheet({ visible, onClose, onScanned }: Props) {
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';
  const [reading, setReading] = useState(false);

  const start = async (source: ScanSource) => {
    setReading(true);
    const result = await scanBill(source);
    setReading(false);
    if (result.status === 'cancelled') return;
    if (result.status === 'error') {
      Toast.error(result.message);
      return;
    }
    onClose();
    onScanned(result.parsed, result.category);
  };

  const option = (source: ScanSource, icon: 'camera' | 'image', label: string, hint: string) => (
    <TouchableOpacity onPress={() => start(source)} disabled={reading} className="flex-row items-center py-3">
      <View className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 items-center justify-center">
        <Feather name={icon} size={18} color={isDark ? '#d1d5db' : '#4b5563'} />
      </View>
      <View className="ml-3 flex-1">
        <Text className="dark:text-white text-gray-900 font-medium">{label}</Text>
        <Text className="dark:text-gray-400 text-gray-500 text-xs">{hint}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => !reading && onClose()}>
      <View className="flex-1 justify-end bg-black/50">
        <View className="dark:bg-gray-900 bg-white rounded-t-2xl p-6" style={{ paddingBottom: insets.bottom + 24 }}>
          <View className="flex-row items-center mb-2">
            <Text className="text-xl font-bold dark:text-white text-gray-900 flex-1">Scan a bill</Text>
            {!reading && (
              <TouchableOpacity onPress={onClose} hitSlop={10}>
                <Feather name="x" size={22} color={isDark ? '#d1d5db' : '#4b5563'} />
              </TouchableOpacity>
            )}
          </View>
          {reading ? (
            <View className="items-center py-8">
              <ActivityIndicator size="large" color="#6366f1" />
              <Text className="dark:text-gray-300 text-gray-600 mt-3">Reading the bill…</Text>
            </View>
          ) : (
            <>
              {option('camera', 'camera', 'Take a photo', 'Bill, receipt or invoice, flat and in good light')}
              {option('library', 'image', 'Choose from gallery', 'A photo or a UPI payment screenshot')}
              <Text className="dark:text-gray-500 text-gray-400 text-xs mt-3 leading-4">
                The image is read on your phone and isn&apos;t uploaded. You can check everything before saving.
              </Text>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
