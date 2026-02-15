import api from '@/api/api'
import { useAuthStore } from '@/store/authStore'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { View, Text, ScrollView, Image, TouchableOpacity, useColorScheme, ActivityIndicator, Alert } from 'react-native'
import { Toast } from 'toastify-react-native'

export default function AdminPreviewScreen() {
  const router = useRouter()
  const role = useAuthStore((state) => state.role)
  const accessToken = useAuthStore((state) => state.accessToken)
  const setTokens = useAuthStore((state) => state.setTokens)
  const setUser = useAuthStore((state) => state.setUser)
  const setViewMode = useAuthStore((state) => state.setViewMode)
  const [upgrading, setUpgrading] = useState(false)
  const colorScheme=useColorScheme()

  const handleUpgrade = async () => {
    const isLoggedInNonAdmin = !!accessToken && role !== 'admin'
    if (!isLoggedInNonAdmin) {
      router.replace('/login?type=signup&role=admin')
      return
    }

    Alert.alert(
      "Confirm Registration",
      "Do you want to register as an admin and enable admin view?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Register",
          onPress: async () => {
            try {
              setUpgrading(true)
              const res = await api.post('/user/upgrade-to-admin')
              if (res.data?.accessToken && res.data?.refreshToken) {
                setTokens(res.data.accessToken, res.data.refreshToken)
              }
              if (res.data?.name && res.data?.email && res.data?.role) {
                setUser(res.data.name, res.data.email, res.data.role, res.data.profilePicture)
              }
              setViewMode('admin')
              Toast.success('Admin view enabled')
              router.replace('/(tabs)/home/adminView')
            } catch (error: any) {
              const message = error.response?.data?.message || error.message || 'Failed to enable admin view'
              Toast.error(message)
            } finally {
              setUpgrading(false)
            }
          }
        }
      ]
    )
  }
  const slides = [
    {
      title: 'Manage Users',
      image: colorScheme==='dark'?require("../../assets/images/admin_preview1.jpg"):require("../../assets/images/admin_preview1_light.jpg"),
      description: 'See and manage all registered users easily.'
    },
    {
      title: 'Register new users',
      image: colorScheme==='dark'?require("../../assets/images/admin_preview2.jpg"):require("../../assets/images/admin_preview2_light.jpg"),
      description: 'Register new users and track thier expenses'
    },
    {
      title: 'Track Expenses Globally',
      image: colorScheme==='dark'?require("../../assets/images/admin_preview3.jpg"):require("../../assets/images/admin_preview3_light.jpg"),
      description: 'Oversee all user expenses with rich analytics.'
    }
  ]
  
  return (
    <ScrollView horizontal pagingEnabled className="flex-1 bg-white dark:bg-gray-800">
      {slides.map((slide, index) => (
        <View key={index} className="w-screen items-center justify-center px-6">
          <Image source={slide.image} className="w-80 h-2/3 my-6 rounded-xl" resizeMode="stretch" />
          <Text className="text-2xl dark:text-gray-200 font-bold mb-2">{slide.title}</Text>
          <Text className="text-center dark:text-gray-200 text-gray-600">{slide.description}</Text>
        </View>
      ))}
      <View className="w-screen items-center justify-center px-6">
        <Text className="text-xl dark:text-gray-200 font-semibold mb-4">Ready to manage your app?</Text>
        <TouchableOpacity
          className="bg-indigo-600 px-6 py-3 rounded-full"
          disabled={upgrading}
          onPress={handleUpgrade}
        >
          <Text className="text-white font-semibold">
            {!!accessToken && role !== 'admin' ? 'Register for Admin View' : 'Sign Up as Admin'}
          </Text>
        </TouchableOpacity>
        {upgrading && <ActivityIndicator className="mt-4" color={colorScheme === 'dark' ? 'white' : '#111827'} />}
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-3"
        >
          <Text className="text-gray-500 dark:text-gray-200">Go Back</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}
