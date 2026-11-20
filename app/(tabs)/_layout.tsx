import { Feather } from "@expo/vector-icons";
import { Tabs, useRouter } from "expo-router";
import { AppState, Pressable, Text, useColorScheme, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "@/store/authStore";
import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import * as Notifications from "expo-notifications";
import { useLastNotificationResponse } from "@/helper/useLastNotificationResponse";
import { GROUP_ACTIVITY_TYPE, syncPushRegistration } from "@/helper/pushService";
import api from "@/api/api";
import { useEffect } from "react";
import { REMINDER_NOTIFICATION_TYPE } from "@/helper/reminderService";
import { hasUnseenActivity, useGroupStore } from "@/store/groupStore";
import { fetchGroupsApi, fetchInvitationsApi } from "@/api/groupApi";
import { Toast } from "toastify-react-native";

// The last response survives remounts, so remember which one was already handled
let handledResponseId: string | null = null;


export default function RootLayout() {
  const colorScheme = useColorScheme()
  const backcolor = colorScheme == 'light' ? 'white' : '#111827'
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const role = useAuthStore((state) => state.role);
  const viewMode = useAuthStore((state) => state.viewMode);
  const inAdminMode = role === 'admin' && viewMode === 'admin';
  const historyHref = inAdminMode
    ? '/(tabs)/history/adminAllUsersView'
    : '/(tabs)/history';

  // An invite link opened earlier (maybe before signing in) opens the join screen
  const pendingInviteCode = useGroupStore((state) => state.pendingInviteCode);
  const setPendingInviteCode = useGroupStore((state) => state.setPendingInviteCode);
  useEffect(() => {
    if (!pendingInviteCode) return;
    setPendingInviteCode(null);
    if (inAdminMode) {
      Toast.info('Switch to your personal view in Profile to join this group');
      return;
    }
    router.push({ pathname: '/(tabs)/groups/join', params: { code: pendingInviteCode } });
  }, [pendingInviteCode, inAdminMode, router, setPendingInviteCode]);

  // Groups tab badge: groups with someone else's new activity, plus invitations.
  // Refreshed when the app opens or comes back to the foreground.
  const groups = useGroupStore((state) => state.groups);
  const lastSeen = useGroupStore((state) => state.lastSeen);
  const invitationCount = useGroupStore((state) => state.invitationCount);
  const groupsBadge = groups.filter((g) => hasUnseenActivity(g, lastSeen)).length + invitationCount;
  useEffect(() => {
    if (inAdminMode) return;
    const refresh = async () => {
      const [groupsResult, invitesResult, settingsResult] = await Promise.all([
        fetchGroupsApi(),
        fetchInvitationsApi(),
        api.get('/notifications/settings').catch(() => null),
      ]);
      const store = useGroupStore.getState();
      if (groupsResult.ok) store.setGroups(groupsResult.data);
      if (invitesResult.ok) store.setInvitationCount(invitesResult.data.length);
      if (settingsResult) store.setNotificationsOn(settingsResult.data.settings.groups);
      // Only does anything if a group has notifications turned on
      syncPushRegistration();
    };
    refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    // A group push arriving while the app is open updates the badge right away
    const received = Notifications.addNotificationReceivedListener((notification) => {
      if (notification.request.content.data?.type === GROUP_ACTIVITY_TYPE) refresh();
    });
    return () => {
      subscription.remove();
      received.remove();
    };
  }, [inAdminMode]);

  // Tapping a notification (the tabs only mount when logged in, so taps that
  // opened the app before sign-in are handled right after it):
  // the daily reminder opens Add Debit, group pushes open that group.
  const lastNotificationResponse = useLastNotificationResponse();
  useEffect(() => {
    const notification = lastNotificationResponse?.notification;
    if (!notification) return;
    const data = notification.request.content.data ?? {};
    const type = data.type;
    if (type !== REMINDER_NOTIFICATION_TYPE && type !== GROUP_ACTIVITY_TYPE) return;
    if (handledResponseId === notification.request.identifier) return;
    handledResponseId = notification.request.identifier;

    if (inAdminMode) {
      if (type === GROUP_ACTIVITY_TYPE) Toast.info('Switch to your personal view in Profile to see your groups');
      return;
    }
    if (type === REMINDER_NOTIFICATION_TYPE) {
      router.push({ pathname: '/expenseModal/[type]', params: { type: 'debit' } });
    } else if (typeof data.groupId === 'string') {
      router.push({ pathname: '/(tabs)/groups/[id]', params: { id: data.groupId } });
    }
  }, [lastNotificationResponse, inAdminMode, router]);

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
        <Tabs.Screen name="groups" options={{
          title: "Groups", headerShown: false,
          // Groups belong to your personal view, like Manage Accounts
          href: inAdminMode ? null : undefined,
          tabBarBadge: groupsBadge > 0 ? (groupsBadge > 9 ? '9+' : groupsBadge) : undefined,
          tabBarBadgeStyle: { backgroundColor: '#4f46e5', color: 'white', fontSize: 10 },
          tabBarShowLabel: true,
          tabBarLabel: ({ focused, color }) => (
            <Text className="text-xs mt-1" style={{ color: focused ? '#6366f1' : color }}>Groups</Text>
          ),
          tabBarIcon: ({ focused, color }) => <Feather size={23} name="users" color={focused ? '#6366f1' : color} />,
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
