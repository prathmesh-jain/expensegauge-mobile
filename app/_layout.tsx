import { Stack } from "expo-router";
import { applyColorScheme } from "@/helper/applyColorScheme";
import "../global.css";
import { Platform, useColorScheme, View } from "react-native";
import ToastManager, { Toast } from "toastify-react-native";
import { useThemeStore } from "@/store/themeStore";
import { useEffect, useRef, useState } from "react";
import { processQueue } from "@/api/syncQueue";
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import api from "@/api/api";
import { Provider as PaperProvider } from 'react-native-paper';
import UpdateService from "@/helper/UpdateService";
import UpdatePrompt from "@/components/UpdatePrompt";
import ReminderPromptModal from "@/components/ReminderPromptModal";
import GroupNotifyPromptModal from "@/components/GroupNotifyPromptModal";
import { addNetworkListener, checkConnection } from "@/api/network";
import UserNotFoundModal from "@/components/UserNotFoundModal";
import InstallHelpModal from "@/components/InstallHelpModal";
import { useAuthStore } from "@/store/authStore";
import { useExpenseStore } from "@/store/expenseStore";
import { useAdminStore } from "@/store/adminStore";
import { useGroupStore } from "@/store/groupStore";
import { clearQueue } from "@/store/offlineQueue";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { startDailyReminderSync } from "@/helper/reminderService";
import { useIsDesktop } from "@/helper/useIsDesktop";

// Widest the phone layout gets in a mid-size browser window; desktop-width
// windows use the full width (sidebar and split screens, see useIsDesktop)
const WEB_MAX_WIDTH = 640;

const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
if (!googleWebClientId) {
  console.warn("Missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID; Google Sign-In may not work.");
}
// The native SDK; the browser uses Google Identity Services (GoogleSignInButton.web.tsx)
if (Platform.OS !== "web") {
  GoogleSignin.configure({
    webClientId: googleWebClientId ?? "",
  });
}

export default function RootLayout() {
  const theme = useThemeStore((state) => state.theme);
  const previousConnection = useRef<boolean | null>(null);
  const [showUserNotFoundModal, setShowUserNotFoundModal] = useState(false);
  const { logout, accessToken } = useAuthStore();
  const { reset: resetExpenseStore } = useExpenseStore();
  const { reset: resetAdminStore } = useAdminStore();
  applyColorScheme(theme);
  const colorScheme = useColorScheme();
  const backcolor = colorScheme == "light" ? "white" : "#111827";
  const statusColor = colorScheme == "light" ? "dark" : "light";
  const webFrameColor = colorScheme == "light" ? "#e5e7eb" : "#030712";
  const isDesktop = useIsDesktop();
  const capWidth = Platform.OS === "web" && !isDesktop;
  // Full-page screens outside the tabs (bulk add, admin) in a centered column on desktop
  const desktopColumn = isDesktop ? { width: "100%" as const, maxWidth: 820, alignSelf: "center" as const } : undefined;

  const handleUserNotFound = async () => {
    // First log out the user
    resetExpenseStore();
    resetAdminStore();
    useGroupStore.getState().reset();
    await clearQueue();
    await logout();
    // Set flag so modal shows on app restart
    await AsyncStorage.setItem('userNotFound', 'true');
    // Then show the modal
    setShowUserNotFoundModal(true);
  };

  const handleUserNotFoundOk = () => {
    setShowUserNotFoundModal(false);
    // Navigate to login screen
    router.replace('/');
  };

  useEffect(() => startDailyReminderSync(), []);

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
        useGroupStore.getState().reset();
        await clearQueue();
        await logout();
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
      <View style={{ flex: 1, backgroundColor: capWidth ? webFrameColor : backcolor }}>
        {/* In a mid-size browser window, keep the phone layout in a centered column */}
        <View style={{ flex: 1, width: "100%", maxWidth: capWidth ? WEB_MAX_WIDTH : undefined, alignSelf: "center", backgroundColor: backcolor }}>
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
              contentStyle: desktopColumn,
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
            name="invite/[code]"
            options={{ headerShown: false, animation: "none" }}
          />
          <Stack.Screen
            name="expenseModal/bulkAdd"
            options={{
              headerShown: false,
              contentStyle: desktopColumn,
              animation: "slide_from_bottom",
              statusBarStyle: statusColor,
            }}
          />
        </Stack>
        </View>
        <ToastManager useModal={false} theme={colorScheme} />
        <UpdatePrompt />
        <ReminderPromptModal />
        <GroupNotifyPromptModal />
        <InstallHelpModal />
        <UserNotFoundModal
          show={showUserNotFoundModal}
          onOk={handleUserNotFoundOk}
        />
      </View>
    </PaperProvider>
  );
}
