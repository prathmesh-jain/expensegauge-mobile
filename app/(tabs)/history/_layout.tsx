import { Stack } from "expo-router";
import { useAuthStore } from "@/store/authStore";


export default function HistoryLayout() {
  const role = useAuthStore((state) => state.role);
  const viewMode = useAuthStore((state) => state.viewMode);

  const inAdminMode = role === "admin" && viewMode === "admin";

  return (
    <Stack
      key={inAdminMode ? "history-admin" : "history-user"}
      initialRouteName={inAdminMode ? "adminAllUsersView" : "index"}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="adminAllUsersView" />
    </Stack>
  );
}
