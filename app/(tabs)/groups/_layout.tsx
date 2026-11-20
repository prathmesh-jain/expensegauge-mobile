import { Stack } from "expo-router";
import { useColorScheme, View } from "react-native";

// Keeps the list under a group opened from a link or notification, so Back works
export const unstable_settings = { initialRouteName: "index" };

export default function GroupsLayout() {
  const colorScheme = useColorScheme();
  const backcolor = colorScheme === 'light' ? 'white' : '#111827';
  return (
    <View style={{ flex: 1, backgroundColor: backcolor }}>
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="new" />
        <Stack.Screen name="join" />
        <Stack.Screen name="[id]" />
        <Stack.Screen name="expense" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="settle" />
        <Stack.Screen name="activity" />
        <Stack.Screen name="members" />
        <Stack.Screen name="summary" />
        <Stack.Screen name="payment" options={{ animation: 'slide_from_bottom' }} />
      </Stack>
    </View>
  );
}
