import { Feather } from '@expo/vector-icons';
import { Modal, Pressable, Text, View, useColorScheme } from 'react-native';
import { useInstallHelp } from '@/helper/installApp';

const STEPS: { icon: keyof typeof Feather.glyphMap; text: string }[] = [
  { icon: 'share', text: 'Tap the Share button in Safari’s toolbar.' },
  { icon: 'plus-square', text: 'Choose “Add to Home Screen”.' },
  { icon: 'check-circle', text: 'Tap Add. ExpenseGauge opens from your home screen like an app.' },
];

/** iPhone/iPad have no install prompt; this shows the Add to Home Screen steps. */
export default function InstallHelpModal() {
  const visible = useInstallHelp((state) => state.visible);
  const setVisible = useInstallHelp((state) => state.setVisible);
  const isDark = useColorScheme() === 'dark';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
      <Pressable onPress={() => setVisible(false)} className="flex-1 bg-black/50 items-center justify-center p-6">
        <Pressable className="w-full rounded-2xl bg-white dark:bg-gray-900 p-6" style={{ maxWidth: 400 }}>
          <Text className="text-xl font-bold dark:text-white text-gray-900">Add to Home Screen</Text>
          <Text className="text-sm dark:text-gray-400 text-gray-500 mt-1">
            Install ExpenseGauge on this device in three steps.
          </Text>
          <View className="mt-5 gap-4">
            {STEPS.map((step, index) => (
              <View key={step.icon} className="flex-row items-center gap-3">
                <View className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-500/20 items-center justify-center">
                  <Feather name={step.icon} size={17} color={isDark ? '#a5b4fc' : '#4f46e5'} />
                </View>
                <Text className="flex-1 text-[15px] dark:text-gray-200 text-gray-700">
                  {index + 1}. {step.text}
                </Text>
              </View>
            ))}
          </View>
          <Pressable onPress={() => setVisible(false)} className="mt-6 bg-indigo-600 rounded-lg py-3">
            <Text className="text-white text-center font-semibold">Got it</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
