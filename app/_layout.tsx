import { Stack } from "expo-router";
import "../global.css";
import { useColorScheme, View, Appearance } from "react-native";
import ToastManager from "toastify-react-native";
import { useThemeStore } from "@/store/themeStore";
import { useEffect } from "react";
import NetInfo from "@react-native-community/netinfo";
import { processQueue } from "@/api/syncQueue";
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import api from "@/api/api";

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
    // 1️⃣ Run immediately on startup
    processQueue();

    // 2️⃣ Subscribe to network changes
    const unsubscribe = NetInfo.addEventListener(async (state) => {
      if (state.isConnected) {
        await processQueue();
      }
    });

    // 3️⃣ Subscribe to new queue items
    const { setOnQueueAdded } = require("@/api/api");
    setOnQueueAdded(() => {
      processQueue();
    });

    api.get("/health").catch((err) => {
      console.error("Error fetching profile on app start:", err.message);
    });

    return () => unsubscribe();
  }, []);

  return (
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
    </View>
  );
}
