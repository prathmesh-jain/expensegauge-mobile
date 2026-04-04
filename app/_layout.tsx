import { Stack } from "expo-router";
import "../global.css";
import { useColorScheme, View, Appearance } from "react-native";
import ToastManager, { Toast } from "toastify-react-native";
import { useThemeStore } from "@/store/themeStore";
import { useEffect } from "react";
import { processQueue } from "@/api/syncQueue";
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import api from "@/api/api";
import { Provider as PaperProvider } from 'react-native-paper';
import UpdateService from "@/helper/UpdateService";
import UpdatePrompt from "@/components/UpdatePrompt";
import { addNetworkListener, checkConnection } from "@/api/network";

const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
if (!googleWebClientId) {
  console.warn("Missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID; Google Sign-In may not work.");
}
GoogleSignin.configure({
  webClientId: googleWebClientId ?? "",
});

export default function RootLayout() {
  const theme = useThemeStore((state) => state.theme);
  Appearance.setColorScheme(theme);
  const colorScheme = useColorScheme();
  const backcolor = colorScheme == "light" ? "white" : "#111827";
  const statusColor = colorScheme == "light" ? "dark" : "light";

  useEffect(() => {
    const notifyOfflineOnStartup = async () => {
      const isConnected = await checkConnection();
      if (!isConnected) {
        Toast.info("You are offline. Sync will happen when connection returns.");
      }
    };

    notifyOfflineOnStartup();

    // Run immediately on startup
    processQueue(true);

    // Subscribe to network changes
    const unsubscribe = addNetworkListener(async (isConnected) => {
      if (isConnected) {
        await processQueue(true);
      }
    });

    // Subscribe to new queue items
    const { setOnQueueAdded } = require("@/api/api");
    setOnQueueAdded(() => {
      processQueue();
    });

    api.get("/health").catch((err) => {
      console.error("Error fetching profile on app start:", err.message);
    });

    UpdateService.checkForUpdates();

    return () => unsubscribe();
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
        </Stack>
        <ToastManager useModal={false} theme={colorScheme} />
        <UpdatePrompt />
      </View>
    </PaperProvider>
  );
}
