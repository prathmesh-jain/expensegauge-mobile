import { useAuthStore } from "@/store/authStore";
import { Redirect, Stack, useSegments } from "expo-router";
import { useColorScheme, View } from "react-native";
import ToastManager from 'toastify-react-native'


export default function RootLayout() {
  const colorScheme = useColorScheme()
  const backcolor = colorScheme == 'light' ? 'white' : '#111827'
  const {accessToken,viewMode,role} = useAuthStore();
  const segments = useSegments();
  
  const isAdminPreview = segments.join("/").includes("AdminPreview");

  if (accessToken && !isAdminPreview) {
    if (role === 'admin' && viewMode === 'admin') {
      return <Redirect href="/(tabs)/home/adminView" />;
    }
    return <Redirect href="/(tabs)/home" />;
  }
  return (
    <View style={{ flex: 1, backgroundColor: backcolor }}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="AdminPreview" options={{ headerShown: false }} />
        <Stack.Screen name="forgotCredentials" options={{ headerShown: false }} />
      </Stack>
      <ToastManager useModal={false} theme={colorScheme} />
    </View>

  );
}
