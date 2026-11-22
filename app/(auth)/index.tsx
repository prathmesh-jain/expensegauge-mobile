import { useRouter } from "expo-router";
import { TouchableOpacity, Text, View, Image, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useIsDesktop } from "@/helper/useIsDesktop";
import { INSTALL_LABELS, useInstallApp } from "@/helper/installApp";
import { Feather } from "@expo/vector-icons";

export default function Index() {
  const router = useRouter()
  const colorScheme= useColorScheme();
  const isDesktop = useIsDesktop();
  const { mode: installMode, install } = useInstallApp();

  // Desktop: the brand panel beside this column already shows the logo
  if (isDesktop) {
    return (
      <View className="flex-1 dark:bg-gray-900 bg-white justify-center" style={{ paddingHorizontal: 56 }}>
        <Text className="text-3xl font-bold dark:text-white text-gray-900">Welcome</Text>
        <Text className="dark:text-gray-400 text-gray-500 text-base mt-2 mb-10">
          Sign in to your account, or create one for free.
        </Text>
        <TouchableOpacity
          className="bg-indigo-600 py-4 rounded-lg mb-4"
          onPress={() => router.navigate('/login?type=login&role=user')}
        >
          <Text className="text-white text-center text-lg font-semibold">Login</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="border border-indigo-600 py-4 rounded-lg"
          onPress={() => router.navigate('/login?type=signup&role=user')}
        >
          <Text className="text-indigo-600 dark:text-indigo-400 text-center text-lg font-semibold">Sign Up</Text>
        </TouchableOpacity>
        {installMode && (
          <TouchableOpacity onPress={install} className="flex-row items-center justify-center gap-2 mt-6">
            <Feather name="download" size={16} color="#6366f1" />
            <Text className="text-indigo-600 dark:text-indigo-400 font-medium">{INSTALL_LABELS[installMode]}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 dark:bg-gray-900" style={{ padding: 24 }}>
      <View className="flex-1 justify-center items-center mb-12">
        {colorScheme=='dark'?
        <Image source={require('../../assets/images/icon1.png')} className="mb-10" style={{ width: 240, height: 192 }} resizeMode="contain"/>
        :
        <Image source={require('../../assets/images/iconLight.png')} className="mb-10" style={{ width: 240, height: 192 }} resizeMode="contain"/>
        }
        <Text className="text-4xl font-bold dark:text-white mb-2">ExpenseGauge</Text>
        <Text className="dark:text-gray-300 text-center text-sm">
          Manage your finances with ease
        </Text>
      </View>

      <View className="mb-10">
        <TouchableOpacity
          className="bg-indigo-600 py-4 rounded-lg mb-4"
          onPress={() => router.navigate('/login?type=login&role=user')}
        >
          <Text className="text-white text-center text-lg font-semibold">
            Login
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="border border-indigo-600 py-4 rounded-lg"
          onPress={() => router.navigate('/login?type=signup&role=user')}
        >
          <Text className="text-indigo-600 text-center text-lg font-semibold">
            Sign Up
          </Text>
        </TouchableOpacity>
          {installMode && (
            <TouchableOpacity onPress={install} className="flex-row items-center justify-center gap-2 mt-5">
              <Feather name="download" size={16} color="#6366f1" />
              <Text className="text-indigo-600 dark:text-indigo-400 font-medium">{INSTALL_LABELS[installMode]}</Text>
            </TouchableOpacity>
          )}
      </View>
    </SafeAreaView>
  );
}
