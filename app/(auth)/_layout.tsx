import { useAuthStore } from "@/store/authStore";
import { Redirect, Stack, useSegments } from "expo-router";
import { Platform, useColorScheme, View } from "react-native";
import ToastManager from 'toastify-react-native'
import { useIsDesktop } from "@/helper/useIsDesktop";
import AuthBrandPanel from "@/components/web/AuthBrandPanel";
import ThemeToggle from "@/components/web/ThemeToggle";


export default function RootLayout() {
  const colorScheme = useColorScheme()
  const backcolor = colorScheme == 'light' ? 'white' : '#111827'
  const {accessToken,viewMode,role} = useAuthStore();
  const segments = useSegments();
  const isDesktop = useIsDesktop();
  
  const isAdminPreview = segments.join("/").includes("AdminPreview");

  if (accessToken && !isAdminPreview) {
    if (role === 'admin' && viewMode === 'admin') {
      return <Redirect href="/(tabs)/home/adminView" />;
    }
    return <Redirect href="/(tabs)/home" />;
  }
  const stack = (
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="AdminPreview" options={{ headerShown: false }} />
        <Stack.Screen name="forgotCredentials" options={{ headerShown: false }} />
      </Stack>
  );

  // Desktop browser: brand panel on the left, the page in a column on the right
  if (isDesktop) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: backcolor }}>
        <AuthBrandPanel />
        <View style={{ flex: 1, backgroundColor: backcolor, alignItems: 'center' }}>
          <View style={{ flex: 1, width: '100%', maxWidth: 480 }}>{stack}</View>
          <View style={{ position: 'absolute', top: 24, right: 24 }}><ThemeToggle /></View>
        </View>
        <ToastManager useModal={false} theme={colorScheme} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: backcolor }}>
      {stack}
      {Platform.OS === 'web' && <View style={{ position: 'absolute', top: 16, right: 16 }}><ThemeToggle /></View>}
      <ToastManager useModal={false} theme={colorScheme} />
    </View>
  );
}
