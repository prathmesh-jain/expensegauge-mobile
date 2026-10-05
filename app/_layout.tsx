import { Stack } from "expo-router";
import "../global.css";
import { useColorScheme, View, Appearance } from "react-native";
import ToastManager, { Toast } from "toastify-react-native";
import { useThemeStore } from "@/store/themeStore";
import { useEffect, useRef, useState } from "react";
import { processQueue } from "@/api/syncQueue";
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import api from "@/api/api";
import { Provider as PaperProvider } from 'react-native-paper';
import UpdateService from "@/helper/UpdateService";
import UpdatePrompt from "@/components/UpdatePrompt";
import { addNetworkListener, checkConnection } from "@/api/network";
import UserNotFoundModal from "@/components/UserNotFoundModal";
import { useAuthStore } from "@/store/authStore";
import { useExpenseStore } from "@/store/expenseStore";
import { useAdminStore } from "@/store/adminStore";
import { clearQueue } from "@/store/offlineQueue";
import AsyncStorage from '@react-native-async-storage/async-storage';

const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
if (!googleWebClientId) {
  console.warn("Missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID; Google Sign-In may not work.");
}
GoogleSignin.configure({
  webClientId: googleWebClientId ?? "",
});

export default function RootLayout() {
  const theme = useThemeStore((state) => state.theme);
  const previousConnection = useRef<boolean | null>(null);
  const [showUserNotFoundModal, setShowUserNotFoundModal] = useState(false);
  const { reset, accessToken } = useAuthStore();
  const { reset: resetExpenseStore } = useExpenseStore();
  const { reset: resetAdminStore } = useAdminStore();
  Appearance.setColorScheme(theme);
  const colorScheme = useColorScheme();
  const backcolor = colorScheme == "light" ? "white" : "#111827";
  const statusColor = colorScheme == "light" ? "dark" : "light";

  const handleUserNotFound = async () => {
    // First log out the user
    resetExpenseStore();
    resetAdminStore();
    await clearQueue();
    reset();
    // Set flag so modal shows on app restart
    await AsyncStorage.setItem('userNotFound', 'true');
    // Then show the modal
    setShowUserNotFoundModal(true);
  };

  const handleUserNotFoundOk = () => {
    setShowUserNotFoundModal(false);
    // Navigate to login screen
    // Note: User is already logged out, so they should be at login screen
  };

  useEffect(() => {
    const initializeApp = async () => {
      // Check if user was previously logged out due to account deletion
      const userNotFoundFlag = await AsyncStorage.getItem('userNotFound');
      if (userNotFoundFlag === 'true') {
        // Clear the flag
        await AsyncStorage.removeItem('userNotFound');
        // Ensure user is logged out
        resetExpenseStore();
        resetAdminStore();
        await clearQueue();
        reset();
        // Show the modal
        setShowUserNotFoundModal(true);
      }

      const notifyOfflineOnStartup = async () => {
        const isConnected = await checkConnection();
        if (!isConnected) {
          Toast.info("You are offline. Sync will happen when connection returns.");
        }
      };

      await notifyOfflineOnStartup();

      // Run immediately on startup
      processQueue(true);

      // Subscribe to network changes
      const unsubscribe = addNetworkListener(async (isConnected) => {
        if (previousConnection.current === true && !isConnected) {
          Toast.info("You are offline. Sync will happen when connection returns.");
        }

        if (previousConnection.current === false && isConnected) {
          Toast.info("Back online. Syncing pending changes.");
        }

        previousConnection.current = isConnected;

        if (isConnected) {
          await processQueue(true);
        }
      });

      // Subscribe to new queue items
      const { setOnQueueAdded } = require("@/api/api");
      setOnQueueAdded(() => {
        processQueue();
      });

      // Subscribe to user not found errors
      const { setOnUserNotFound } = require("@/api/api");
      setOnUserNotFound(handleUserNotFound);

      api.get("/health").catch((err) => {
        console.error("Error fetching profile on app start:", err.message);
      });

      UpdateService.checkForUpdates();

      return () => unsubscribe();
    };

    initializeApp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <PaperProvider>
      <View style={{ flex: 1, backgroundColor: backcolor }}>
        <Stack>
          <Stack.Screen
            name="(auth)"
            options={{ headerShown: false, statusBarStyle: statusColor }}
          />
          <Stack.Screen
            name="(tabs)"
            options={{ headerShown: false, statusBarStyle: statusColor }}
          />
          <Stack.Screen
            name="admin"
            options={{
              headerShown: false,
              statusBarStyle: statusColor,
              animation: "slide_from_right",
            }}
          />
          <Stack.Screen
            name="expenseModal/[type]"
            options={{
              headerShown: false,
              presentation: "transparentModal",
              animation: "fade_from_bottom",
              statusBarStyle: statusColor,
            }}
          />
          <Stack.Screen
            name="expenseModal/bulkAdd"
            options={{
              headerShown: false,
              animation: "slide_from_bottom",
              statusBarStyle: statusColor,
            }}
          />
        </Stack>
        <ToastManager useModal={false} theme={colorScheme} />
        <UpdatePrompt />
        <UserNotFoundModal
          show={showUserNotFoundModal}
          onOk={handleUserNotFoundOk}
        />
      </View>
    </PaperProvider>
  );
}
