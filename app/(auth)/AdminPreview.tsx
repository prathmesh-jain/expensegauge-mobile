import api from '@/api/api'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { View, Text, ScrollView, Image, TouchableOpacity, useColorScheme, ActivityIndicator, Alert } from 'react-native'
import { Toast } from 'toastify-react-native'

export default function AdminPreviewScreen() {
  const router = useRouter()
  const [upgrading, setUpgrading] = useState(false)
  const colorScheme=useColorScheme()

  const handleUpgrade = async () => {
    Alert.alert(
      "Request Admin Access",
      "Do you want to request admin access? Your request will be reviewed and if approved, you'll be granted access within 24-48 hours.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Request Access",
          onPress: async () => {
            try {
              setUpgrading(true)
              const res = await api.post('/user/upgrade-to-admin')
              Toast.success(res.data.message || 'Admin access request submitted successfully')
              router.back()
            } catch (error: any) {
              const message = error.response?.data?.message || error.message || 'Failed to submit admin access request'
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
      title: 'Track Expenses Globally',
      image: colorScheme==='dark'?require("../../assets/images/admin-dark-1.jpg"):require("../../assets/images/admin-light-1.jpg"),
      description: 'Oversee all user expenses with rich analytics.'
    },
    {
      title: 'Register new users',
      image: colorScheme==='dark'?require("../../assets/images/admin-dark-2.jpg"):require("../../assets/images/admin-light-2.jpg"),
      description: 'Register new users and track thier expenses'
    },
    {
      title: 'Manage Users',
      image: colorScheme==='dark'?require("../../assets/images/admin-dark-3.jpg"):require("../../assets/images/admin-light-3.jpg"),
      description: 'See and manage all registered users easily.'
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
            Request Admin Access
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
