import { Stack } from "expo-router";
import { useColorScheme, View } from "react-native";


export default function RootLayout() {
  const colorScheme = useColorScheme()
  const backcolor = colorScheme == 'light' ? 'white' : '#111827'
  return (
    <View style={{ flex: 1, backgroundColor: backcolor }}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="adminView" options={{ headerShown: false }} />
        <Stack.Screen name="registeruser" options={{ headerShown: false }} />
      </Stack>
    </View>

  );
}
