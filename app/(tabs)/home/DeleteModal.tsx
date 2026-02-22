import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native'
import React, { useState } from 'react'
import { Feather } from '@expo/vector-icons'

const DeleteModal = ({ setShow, handleDelete }: any) => {
    const [loading, setLoading] = useState(false);

    const handleConfirm = async () => {
        setLoading(true);
        try {
            await handleDelete();
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    return (
        <View className='bg-black/70 flex-row items-center justify-center w-screen h-screen absolute top-0 left-0'>
            <View className='bg-white dark:bg-gray-900 flex-col w-10/12 rounded-lg border border-gray-200 dark:border-gray-800 shadow-md'>
                <View className=''>
                    <View className='flex-row items-center px-3 border-b border-gray-200 dark:border-gray-800'>
                        <Feather name='alert-triangle' color={'red'} size={20} />
                        <Text className='dark:text-white font-semibold p-4 px-3 text-lg'>Delete Transaction</Text>
                    </View>
                </View>
                <View className='p-3 px-10'>
                    <Text className='text-gray-500 dark:text-gray-300 mb-5'>Are you sure you want to Delete?</Text>
                    <View className='flex-row gap-4 justify-end mb-2'>
                        <TouchableOpacity disabled={loading} className='border border-gray-300 dark:border-gray-600 rounded-md p-2 px-3' onPress={() => setShow(false)}>
                            <Text className='dark:text-gray-300'>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity disabled={loading} className='rounded-md p-2 px-3 bg-red-600 flex-row items-center justify-center min-w-[80px]' onPress={handleConfirm}>
                            {loading ? (
                                <ActivityIndicator size="small" color="#ffffff" />
                            ) : (
                                <Text className='text-white'>Delete</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </View>
    )
}

export default DeleteModal