import { useRouter } from "expo-router"; // Removed useLocalSearchParams
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState } from "react";
import api from "@/api/api";
import { useAdminStore } from "@/store/adminStore";

export default function Index() {

    const [oldPassword, setOldPassword] = useState("")
    const [newPassword, setNewPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [buttonDisabled, setButtonDisabled] = useState(false)
    const [error, setError] = useState({
        oldPasswordError: '',
        passwordError: '',
        passwordvalidationError: '',
        serverError: '',
    })
    const { addUser } = useAdminStore();
    const router = useRouter();

    const validatePasswords = () => {
        if (newPassword && confirmPassword && newPassword !== confirmPassword) {
            setError((prev) => ({ ...prev, passwordvalidationError: "Passwords don't match" }));
        }
        else setError((prev) => ({ ...prev, passwordvalidationError: "" }));
    }
    const validateFields = () => {
        if (!oldPassword) {
            setError((prev) => ({ ...prev, oldPasswordError: "Please enter your old password" }));
            return false
        }
        else {
            setError((prev) => ({ ...prev, oldPasswordError: "" })); // Changed usernameError to oldPasswordError for consistency
        }
        if (!newPassword) {
            setError((prev) => ({ ...prev, passwordError: "Please enter new password" }));
            return false
        }
        else {
            setError((prev) => ({ ...prev, passwordError: "" }));
        }
        if (!confirmPassword) {
            setError((prev) => ({ ...prev, passwordvalidationError: "Please confirm the new password" }));
            return false
        }
        else {
            setError((prev) => ({ ...prev, passwordvalidationError: "" }));
        }
        if (newPassword && confirmPassword && newPassword !== confirmPassword) {
            setError((prev) => ({ ...prev, passwordvalidationError: "Passwords don't match" }));
            return false
        }
        else setError((prev) => ({ ...prev, passwordvalidationError: "" }));
        return true
    }
    const handleVerify = async () => {
        if (!validateFields()) return;
        try {
            
            setButtonDisabled(true)
            const response = await api.post(`/user/changePassword`, { oldPassword, newPassword })
            router.navigate('/(tabs)/profile');
            
        } catch (error: any) {
            
            setButtonDisabled(false)
            setError((prev) => ({ ...prev, serverError: error.response.data.message }));
        }
    }

    return (
        <SafeAreaView className="flex-1 p-6 dark:bg-gray-900 justify-center">
            <Text className="text-2xl text-center font-semibold dark:text-white text-gray-800 mb-6">
                Change Password
            </Text>
            <View className="flex gap-5 space-y-6">
                {error.serverError && <Text className="text-red-600 -mt-4 -mb-1 px-3 text-center">{error.serverError}</Text>}


                <TextInput
                    className="dark:bg-gray-800 dark:text-white bg-white p-4 rounded-lg text-lg"
                    placeholder="Old Password"
                    placeholderTextColor="#9CA3AF"
                    onChangeText={setOldPassword}
                    secureTextEntry
                />
                {error.oldPasswordError && <Text className="text-red-600 -mt-4 -mb-1 px-3">{error.oldPasswordError}</Text>}
                
                <TextInput
                    className="dark:bg-gray-800 dark:text-white bg-white p-4 rounded-lg text-lg"
                    placeholder="New Password"
                    placeholderTextColor="#9CA3AF"
                    onChangeText={setNewPassword}
                    onBlur={validatePasswords}
                    secureTextEntry
                />
                {error.passwordError && <Text className="text-red-600 -mt-4 -mb-1 px-3">{error.passwordError}</Text>}


                <TextInput
                    className="dark:bg-gray-800 dark:text-white bg-white p-4 rounded-lg text-lg"
                    placeholder="Confirm Password"
                    placeholderTextColor="#9CA3AF"
                    onBlur={validatePasswords}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                />
                {error.passwordvalidationError && <Text className="text-red-600 -mt-4 -mb-1 px-3">{error.passwordvalidationError}</Text>}

                <TouchableOpacity disabled={buttonDisabled} className="bg-indigo-600 disabled:bg-indigo-400 py-4 rounded-lg" onPress={handleVerify}>
                    <Text className="text-white text-center text-lg font-semibold">
                        Confirm
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}