import { Feather } from "@expo/vector-icons";
import { Tabs, useRouter } from "expo-router";
import { Pressable, Text, useColorScheme, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "@/store/authStore";
import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { useLastNotificationResponse } from "expo-notifications";
import { useEffect } from "react";
import { REMINDER_NOTIFICATION_TYPE } from "@/helper/reminderService";

// The last response survives remounts, so remember which one was already handled
let handledResponseId: string | null = null;


export default function RootLayout() {
  const colorScheme = useColorScheme()
  const backcolor = colorScheme == 'light' ? 'white' : '#111827'
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const role = useAuthStore((state) => state.role);
  const viewMode = useAuthStore((state) => state.viewMode);
  const historyHref = role === 'admin' && viewMode === 'admin'
    ? '/(tabs)/history/adminAllUsersView'
    : '/(tabs)/history';

  // Tapping the daily reminder opens Add Debit (the tabs only mount when logged in)
  const lastNotificationResponse = useLastNotificationResponse();
  useEffect(() => {
    const notification = lastNotificationResponse?.notification;
    if (!notification || notification.request.content.data?.type !== REMINDER_NOTIFICATION_TYPE) return;
    if (handledResponseId === notification.request.identifier) return;
    handledResponseId = notification.request.identifier;
    if (role === 'admin' && viewMode === 'admin') return;
    router.push({ pathname: '/expenseModal/[type]', params: { type: 'debit' } });
  }, [lastNotificationResponse, role, viewMode, router]);

  return (
    <View style={{ flex: 1, backgroundColor: '#111827' }}>
      <Tabs screenOptions={{
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: backcolor,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom,
          position: "absolute",
          borderTopWidth: 0.3,
          borderColor: '#4f46e5'
        },
        tabBarActiveTintColor: 'white'
      }}>
        <Tabs.Screen name="home" options={{
          title: 'Home',
          headerShown: false,
          tabBarShowLabel: true,
          tabBarLabel: ({ focused, color }) => (
            <Text className="text-xs mt-1" style={{ color: focused ? '#6366f1' : color }}>Home</Text>
          ),
          tabBarIcon: ({ focused, color }) => <Feather size={23} name="home" color={focused ? '#6366f1' : color} />,
        }} />
        <Tabs.Screen name="history" options={{
          title: "History", headerShown: false,
          tabBarShowLabel: true,
          tabBarLabel: ({ focused, color }) => (
            <Text className="text-xs mt-1" style={{ color: focused ? '#6366f1' : color }}>Insights</Text>
          ),
          tabBarIcon: ({ focused, color }) => <Feather size={23} name="bar-chart-2" color={focused ? '#6366f1' : color} />,
          tabBarButton: (props: BottomTabBarButtonProps) => (
            <Pressable
              accessibilityLabel={props.accessibilityLabel}
              accessibilityState={props.accessibilityState}
              testID={props.testID}
              style={props.style}
              onPress={() => {
                router.navigate(historyHref);
              }}
            >
              {props.children}
            </Pressable>
          ),
        }} />
        <Tabs.Screen name="profile" options={{
          title: "Profile", headerShown: false,
          tabBarShowLabel: true,
          tabBarLabel: ({ focused, color }) => (
            <Text className="text-xs mt-1" style={{ color: focused ? '#6366f1' : color }}>Profile</Text>
          ),
          tabBarIcon: ({ focused, color }) => <Feather size={23} name="user" color={focused ? '#6366f1' : color} />,
        }} />
      </Tabs>
    </View>

  );
}
