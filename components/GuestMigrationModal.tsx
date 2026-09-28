import { View, Text, TouchableOpacity, Modal, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { useColorScheme } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { hasUnsyncedData, migrateGuestDataToAccount } from '@/utils/guestMigrationService';
import { useAuthStore } from '@/store/authStore';

interface GuestMigrationModalProps {
  visible: boolean;
  onClose: () => void;
  onSkip: () => void;
  onMigrate: () => void;
}

interface MigrationResult {
  success: boolean;
  accountsMigrated: number;
  expensesMigrated: number;
  accountsFailed: number;
  expensesFailed: number;
  allSuccessful: boolean;
}

export default function GuestMigrationModal({ visible, onClose, onSkip, onMigrate }: GuestMigrationModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { exitGuestMode } = useAuthStore();
  const [migrating, setMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState({ current: 0, total: 0, stage: '' });
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  const [hasData, setHasData] = useState<{ hasExpenses: boolean; hasAccounts: boolean; expenseCount: number; accountCount: number } | null>(null);
  const timeoutRef = useRef<number | null>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (visible) {
      setHasData(null);
      setMigrationResult(null);
      setMigrating(false);
      setMigrationProgress({ current: 0, total: 0, stage: '' });
    }

    // Cleanup timeout on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [visible]);

  // Check for data when modal opens
  useEffect(() => {
    if (!visible) return;

    let cancelled = false;

    const loadData = async () => {
      try {
        const data = await hasUnsyncedData();

        if (!cancelled) {
          setHasData(data);
        }
      } catch (error) {
        if (!cancelled) {
          setHasData({
            hasExpenses: false,
            hasAccounts: false,
            expenseCount: 0,
            accountCount: 0,
          });
        }
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [visible]);

  const handleMigrate = async () => {
    setMigrating(true);
    setMigrationProgress({ current: 0, total: hasData?.expenseCount || 0, stage: 'Starting migration...' });
    try {
      const result = await migrateGuestDataToAccount({
        onProgress: (current, total, stage) => {
          setMigrationProgress({ current, total, stage });
        }
      });

      setMigrationResult(result);

      // Only exit guest mode if ALL records migrated successfully
      if (result.allSuccessful && (result.accountsMigrated > 0 || result.expensesMigrated > 0)) {
        exitGuestMode();
        timeoutRef.current = setTimeout(() => {
          onMigrate();
        }, 1500);
      }
      // Don't exit guest mode on partial failure - user can retry
    } catch (error) {
      console.error('Migration failed:', error);
      Alert.alert(
        'Migration failed',
        'You can continue without migrating your data, or try again later.'
      );
      // Don't exit guest mode on failure
    } finally {
      setMigrating(false);
    }
  };

  const handleSkip = () => {
    exitGuestMode();
    onSkip();
  };

  if (!hasData && visible) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-white'} p-6 justify-center items-center`}>
          <ActivityIndicator size="large" color={isDark ? '#fff' : '#000'} />
          <Text className={`mt-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Checking for local data...</Text>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
        <View className="flex-1 p-6">
          <Text className={`text-2xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Sync Your Data
          </Text>
          
          <ScrollView className="flex-1">
            {migrationResult ? (
              <View className="space-y-4">
                {migrationResult.allSuccessful ? (
                  <View className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                    <Text className={`text-lg font-semibold text-green-800 dark:text-green-400`}>
                      Migration Complete!
                    </Text>
                    <Text className={`text-green-700 dark:text-green-300 mt-2`}>
                      Successfully migrated:
                    </Text>
                    <Text className={`text-green-700 dark:text-green-300`}>
                      • {migrationResult.accountsMigrated} account(s)
                    </Text>
                    <Text className={`text-green-700 dark:text-green-300`}>
                      • {migrationResult.expensesMigrated} expense(s)
                    </Text>
                  </View>
                ) : (
                  <View className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                    <Text className={`text-lg font-semibold text-yellow-800 dark:text-yellow-400`}>
                      Partial Migration Complete
                    </Text>
                    <Text className={`text-yellow-700 dark:text-yellow-300 mt-2`}>
                      Successfully migrated:
                    </Text>
                    <Text className={`text-yellow-700 dark:text-yellow-300`}>
                      • {migrationResult.accountsMigrated} account(s)
                    </Text>
                    <Text className={`text-yellow-700 dark:text-yellow-300`}>
                      • {migrationResult.expensesMigrated} expense(s)
                    </Text>
                    {(migrationResult.accountsFailed > 0 || migrationResult.expensesFailed > 0) && (
                      <View className="mt-3 pt-3 border-t border-yellow-300 dark:border-yellow-700">
                        <Text className={`text-red-700 dark:text-red-300 text-sm`}>
                          Failed to migrate:
                        </Text>
                        {migrationResult.accountsFailed > 0 && (
                          <Text className={`text-red-700 dark:text-red-300 text-sm`}>
                            • {migrationResult.accountsFailed} account(s)
                          </Text>
                        )}
                        {migrationResult.expensesFailed > 0 && (
                          <Text className={`text-red-700 dark:text-red-300 text-sm`}>
                            • {migrationResult.expensesFailed} expense(s)
                          </Text>
                        )}
                        <Text className={`text-yellow-700 dark:text-yellow-300 text-sm mt-2`}>
                          Failed items remain in local storage. You can retry migration later.
                        </Text>
                      </View>
                    )}
                  </View>
                )}
                <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {migrationResult.allSuccessful
                    ? 'Your local data has been synced to your account. You can now access it from any device.'
                    : 'Some data could not be migrated. Your remaining local data is still available in guest mode.'}
                </Text>
              </View>
            ) : (
              <View className="space-y-4">
                {hasData?.hasExpenses || hasData?.hasAccounts ? (
                  <>
                    <Text className={`text-base ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      We found local data from your guest session:
                    </Text>

                    {hasData?.hasExpenses && (
                      <View className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                        <Text className={`text-sm ${isDark ? 'text-blue-300' : 'text-blue-800'}`}>
                          • {hasData.expenseCount} expense(s)
                        </Text>
                      </View>
                    )}

                    {hasData?.hasAccounts && (
                      <View className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                        <Text className={`text-sm ${isDark ? 'text-blue-300' : 'text-blue-800'}`}>
                          • {hasData.accountCount} account(s)
                        </Text>
                      </View>
                    )}
                    
                    <Text className={`text-base ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Would you like to sync this data to your new account?
                    </Text>
                    
                    <View className="space-y-3 mt-4">
                      <TouchableOpacity
                        onPress={handleMigrate}
                        disabled={migrating}
                        className="bg-indigo-600 py-4 rounded-lg"
                      >
                        {migrating ? (
                          <View className="flex-row justify-center items-center">
                            <ActivityIndicator color="#fff" />
                            <Text className="text-white font-semibold ml-2">
                              {migrationProgress.stage} ({migrationProgress.current}/{migrationProgress.total})
                            </Text>
                          </View>
                        ) : (
                          <Text className="text-white text-center font-semibold text-lg">
                            Sync Data to Account
                          </Text>
                        )}
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        onPress={handleSkip}
                        disabled={migrating}
                        className="py-3"
                      >
                        <Text className={`text-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          Skip and Continue
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <View className="space-y-4">
                    <Text className={`text-base ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      No local data found from your guest session.
                    </Text>
                    <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      You can continue with your new account.
                    </Text>
                    
                    <TouchableOpacity
                      onPress={handleSkip}
                      className="bg-indigo-600 py-4 rounded-lg mt-4"
                    >
                      <Text className="text-white text-center font-semibold text-lg">
                        Continue
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </ScrollView>

          {!migrationResult && (
            <TouchableOpacity
              onPress={onClose}
              className="py-3 mt-4"
            >
              <Text className={`text-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Cancel
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}