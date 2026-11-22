import { useAuthStore } from "@/store/authStore";
import { Redirect, Stack, useSegments } from "expo-router";
import { useColorScheme, View } from "react-native";
import ToastManager from 'toastify-react-native'
import { useIsDesktop } from "@/helper/useIsDesktop";
import AuthBrandPanel from "@/components/web/AuthBrandPanel";


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
        <View style={{ width: 520, backgroundColor: backcolor }}>{stack}</View>
        <ToastManager useModal={false} theme={colorScheme} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: backcolor }}>
      {stack}
      <ToastManager useModal={false} theme={colorScheme} />
    </View>
  );
}
