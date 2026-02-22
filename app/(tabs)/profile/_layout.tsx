import { Stack } from "expo-router";
import { useColorScheme, View } from "react-native";


export default function RootLayout() {
  const colorScheme = useColorScheme()
  const backcolor = colorScheme == 'light' ? 'white' : '#111827'
  const textColor = colorScheme == 'light' ? '#111827' : 'white'
  return (
    <View style={{ flex: 1, backgroundColor: backcolor }}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="theme" options={{ headerStyle:{backgroundColor:backcolor},headerTintColor:textColor,headerTitle:"Change Theme" ,animation:'slide_from_right'}} />
        <Stack.Screen name="changePassword" options={{ headerShown: false }} />
      </Stack>
    </View>

  );
}
