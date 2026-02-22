import { Stack } from "expo-router";
import { useColorScheme, View } from "react-native";


export default function AdminLayout() {
  const colorScheme = useColorScheme()
  const backcolor = colorScheme == 'light' ? 'white' : '#111827'
  const textcolor = colorScheme == 'light' ? '#111827' : 'white'
  return (
    <View style={{ flex: 1, backgroundColor: backcolor }}>
      <Stack>
        <Stack.Screen name="adminUserView" options={{ headerShown: true,headerStyle:{backgroundColor:backcolor},headerTintColor:textcolor,headerTitle: '' }} />
        <Stack.Screen name="adminUserHistory" options={{ headerShown: true,headerStyle:{backgroundColor:backcolor},headerTintColor:textcolor,headerTitle: '' }} />
      </Stack>
    </View>
  );
}
