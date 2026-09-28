import { View, Text, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { useColorScheme } from 'react-native';

interface PrivacyNoticeProps {
  visible: boolean;
  onClose: () => void;
  onAccept: () => void;
}

export default function PrivacyNotice({ visible, onClose, onAccept }: PrivacyNoticeProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
        <View className="flex-1 p-6">
          <Text className={`text-2xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Privacy Notice
          </Text>
          
          <ScrollView className="flex-1">
            <View className="space-y-4">
              <View>
                <Text className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Guest Mode
                </Text>
                <Text className={`text-base ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  When using ExpenseGauge as a guest:
                </Text>
                <View className="mt-2 space-y-2 pl-4">
                  <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    • Your expenses and data are stored locally on your device only
                  </Text>
                  <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    • No data is sent to our servers while in guest mode
                  </Text>
                  <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    • Some features like cloud analytics and reports are limited
                  </Text>
                  <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    • Data may be lost if you uninstall the app or clear app data
                  </Text>
                </View>
              </View>

              <View>
                <Text className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Creating an Account
                </Text>
                <Text className={`text-base ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  When you create an account:
                </Text>
                <View className="mt-2 space-y-2 pl-4">
                  <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    • You can choose to sync your local guest data to the cloud
                  </Text>
                  <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    • Your expenses will be stored securely on our servers
                  </Text>
                  <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    • Data is encrypted and protected with industry-standard security
                  </Text>
                  <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    • We do not sell or share your personal data with third parties
                  </Text>
                  <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    • You can access your data from any device by logging in
                  </Text>
                </View>
              </View>

              <View>
                <Text className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Data Usage
                </Text>
                <Text className={`text-base ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  We use your data to:
                </Text>
                <View className="mt-2 space-y-2 pl-4">
                  <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    • Provide expense tracking and analytics features
                  </Text>
                  <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    • Generate reports and insights
                  </Text>
                  <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    • Improve app functionality and user experience
                  </Text>
                </View>
              </View>

              <View className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <Text className={`text-sm font-semibold ${isDark ? 'text-yellow-400' : 'text-yellow-800'}`}>
                  Important:
                </Text>
                <Text className={`text-sm mt-1 ${isDark ? 'text-yellow-300' : 'text-yellow-700'}`}>
                  Guest data is stored locally and may be lost if you uninstall the app or clear app data. We recommend creating an account to ensure your data is safely backed up.
                </Text>
              </View>
            </View>
          </ScrollView>

          <View className="mt-6 space-y-3">
            <TouchableOpacity
              onPress={onAccept}
              className="bg-indigo-600 py-4 rounded-lg"
            >
              <Text className="text-white text-center font-semibold text-lg">
                I Understand
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onClose}
              className="py-3"
            >
              <Text className={`text-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Go Back
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}