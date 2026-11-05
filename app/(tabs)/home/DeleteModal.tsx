import { View, Text, TouchableOpacity, ActivityIndicator, Modal } from 'react-native'
import React, { useState } from 'react'
import { Feather } from '@expo/vector-icons'

const DeleteModal = ({ show, setShow, handleDelete }: { show: boolean; setShow: (show: boolean) => void; handleDelete: () => Promise<void> }) => {
    const [loading, setLoading] = useState(false);

    const handleConfirm = async () => {
        setLoading(true);
        try {
            await handleDelete();
            setShow(false);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={show}
            onRequestClose={() => setShow(false)}
        >
            <View className="flex-1 justify-center items-center bg-black/50 p-4">
                <View className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-2xl p-6 shadow-xl">
                    <View className="items-center mb-4">
                        <View className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 items-center justify-center mb-3">
                            <Feather name="trash-2" size={28} color="#dc2626" />
                        </View>
                        <Text className="text-xl font-bold text-center dark:text-white">Delete Transaction</Text>
                    </View>

                    <Text className="text-gray-600 dark:text-gray-300 mb-6 text-center">
                        Are you sure you want to delete this transaction? This action cannot be undone.
                    </Text>

                    <View className="flex-row gap-3">
                        <TouchableOpacity
                            onPress={() => setShow(false)}
                            className="flex-1 bg-gray-200 dark:bg-gray-700 p-4 rounded-xl"
                            disabled={loading}
                        >
                            <Text className="text-center font-semibold text-gray-700 dark:text-gray-300">Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={handleConfirm}
                            className="flex-1 bg-red-600 p-4 rounded-xl"
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color="white" />
                            ) : (
                                <Text className="text-center font-semibold text-white">Delete</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    )
}

export default DeleteModal