import { useRouter } from "expo-router";
import { FlatList, RefreshControl, Text, TouchableOpacity, useColorScheme, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import { Feather, FontAwesome } from '@expo/vector-icons';
import { useAuthStore } from "@/store/authStore";
import DeleteModal from "./DeleteModal";
import { useAdminStore } from "@/store/adminStore";
import api from "@/api/api";

type Transaction = {
    _id: string;
    amount: number;
    date: string;
    details: string;
    type: string;
    category: string;
    isSynced: string | null;
};
type User = {
    _id: string;
    netBalance: number;
    name: string;
    createdAt: string;
    expenses: Transaction[];
};

export default function Index() {
    const { deleteUser, setCachedUsers, totalUserBalance, cachedUsers, LastSyncedAt } = useAdminStore();
    const user = useAuthStore((state) => state.name);
    const [users, setUsers] = useState<User[]>(cachedUsers);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [refreshing, setRefreshing] = useState(false)

    const router = useRouter();

    useEffect(() => {
        setUsers(cachedUsers)
    }, [cachedUsers])

    const handleUserPress = (user: User) => {
        setSelectedUser(
            selectedUser?._id === user._id ? null : user
        );
    }
    const handleDelete = async () => {
        if (selectedUser) {
            try {
                const response = await api.delete(`/admin/delete/${selectedUser._id}`)
                setUsers(prev => prev.filter((item) => item._id !== selectedUser._id))
                deleteUser(selectedUser)

            } catch (error) {
                console.error(error);

            }
        }
        setShowDeleteModal(false)
    }
    const colorScheme = useColorScheme();
    const fetchUsers = async () => {
        if (refreshing) return;
        setRefreshing(true)
        try {
            const response = await api.get(`/admin/users/`);
            setUsers(response.data.users)
            setCachedUsers(response.data.users, response.data.totalUserBalance)
        } catch (error) {
            console.error(error);

        }
        setRefreshing(false)

    }

    useEffect(() => {
        if (users.length === 0) {
            fetchUsers()
        }
    }, [])

    return (
        <SafeAreaView className="flex-1 p-4 dark:bg-gray-900 bg-white">
            <View className="px-2 py-2 flex-row justify-between items-center mb-4">
                <Text className="text-lg font-bold text-gray-800 dark:text-white">Hello {user?.split(' ')[0]}</Text>
                <TouchableOpacity onPress={() => router.navigate('/(tabs)/home/registeruser')} className="flex-row items-center">
                    <Feather name="user-plus" size={16} color={colorScheme == 'light' ? "#3730a3" : "#818cf8"} />
                    <Text className="dark:text-indigo-400 text-indigo-800 dark:font-normal font-semibold text-lg p-2 px-2 rounded-lg">Register User</Text>
                </TouchableOpacity>
            </View>
            <View className="dark:bg-indigo-600 bg-indigo-200 rounded-xl p-6 mb-6 dark:border-0 border border-gray-300">
                <Text className="dark:text-white text-slate-800 text-lg">All Users Balance</Text>
                <Text className="dark:text-white text-slate-800 text-4xl font-bold mt-2">{totalUserBalance?.toLocaleString('en-IN', { style: 'currency', currency: 'INR' }) ?? "0.00"}</Text>
                {LastSyncedAt && <Text className="dark:text-gray-300 text-slate-800 text-sm italic mt-1">Last Synced At {LastSyncedAt}</Text>}

            </View>

            {/* List of users */}
            <View className="flex-row justify-between items-center my-4">
                <Text className="dark:text-white text-gray-800 text-lg font-semibold">List of Users</Text>
                {users.length > 7 && <TouchableOpacity onPress={() => router.navigate('/(tabs)/history/adminAllUsersView')}>
                    <Text className="dark:text-indigo-400 text-indigo-800 dark:font-normal font-semibold text-lg">View All</Text>
                </TouchableOpacity>}
            </View>

            {users[0] &&
                <FlatList
                    data={users.slice(0, 7)}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={fetchUsers} />
                    }
                    renderItem={({ item, index }) => (
                        <View className="mb-2" key={item._id}>
                            <TouchableOpacity
                                className="dark:bg-gray-800 bg-white dark:border-0 border border-gray-200 p-4 rounded-lg dark:shadow-none shadow-lg"
                                onPress={() => handleUserPress(item)}
                            >
                                <View className="flex-row justify-between">
                                    <Text className="dark:text-gray-100">{item.name} </Text>
                                    <Text className="dark:text-white">
                                        ₹{item.netBalance}
                                    </Text>
                                </View>
                                <View className="flex flex-row justify-between items-center mt-1">
                                    <Text className="dark:text-gray-400 text-gray-700 text-sm">{new Date(item.createdAt).toDateString()}</Text>
                                </View>
                            </TouchableOpacity>
                            {selectedUser?._id === item._id && (
                                <View className="flex-row">
                                    <TouchableOpacity className="dark:bg-red-600 bg-rose-300 flex-row gap-2 -mt-1 py-2 px-4 items-center justify-start w-1/2" style={{ borderBottomLeftRadius: 8, }} onPress={() => setShowDeleteModal(true)}>
                                        <FontAwesome name="trash" size={15} color={`${colorScheme == 'dark' ? 'white' : 'black'}`} />
                                        <Text className="dark:text-white text-sm font-semibold">Delete User</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity className="dark:bg-indigo-900 bg-indigo-200 flex-row gap-2 -mt-1 py-2 px-4 items-center justify-start w-1/2" style={{ borderBottomRightRadius: 8, }} onPress={() => router.navigate(`/admin/adminUserView?userindex=${index}&userId=${item._id}`)}>
                                        <FontAwesome name="eye" size={15} color={`${colorScheme == 'dark' ? 'white' : 'black'}`} />
                                        <Text className="dark:text-white text-sm font-semibold">View User</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    )}
                    keyExtractor={item => item._id}
                />}
            {!users[0] &&
                <View className="flex flex-row justify-center items-center p-3">
                    <Text className="dark:text-white ">No user registered</Text>
                </View>
            }

            {showDeleteModal && <DeleteModal setShow={setShowDeleteModal} handleDelete={handleDelete} />}
        </SafeAreaView>
    );
}
