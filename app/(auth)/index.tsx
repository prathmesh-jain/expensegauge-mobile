import { useRouter } from "expo-router";
import { TouchableOpacity, Text, View, Image, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Index() {
  const router = useRouter()
  const colorScheme= useColorScheme();
  
  return (
    <SafeAreaView className="flex-1 dark:bg-gray-900 p-6">
      <View className="flex-1 justify-center items-center mb-12">
        {colorScheme=='dark'?
        <Image source={require('../../assets/images/icon1.png')} className="h-48 mb-10" resizeMode="contain"/>
        :
        <Image source={require('../../assets/images/iconLight.png')} className="h-48 mb-10" resizeMode="contain"/>
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
      </View>
    </SafeAreaView>
  );
}
