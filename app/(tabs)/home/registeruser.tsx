import { useRouter } from "expo-router";
import { Text, TextInput, TouchableOpacity, View, Animated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState } from "react";
import api from "@/api/api";
import { useAdminStore } from "@/store/adminStore";

export default function Index() {

    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [assignBalance, setAssignBalance] = useState("0.00")
    const [buttonDisabled, setButtonDisabled] = useState(false)
    const [error, setError] = useState({
        nameError: '',
        emailError: '',
        passwordError: '',
        passwordvalidationError: '',
        serverError: '',
    })
    const { addUser } = useAdminStore();
    const router = useRouter();

    const [isPasswordFocused, setIsPasswordFocused] = useState(false);
    const [passwordInvalid, setPasswordInvalid] = useState(false);
    const [policyStatus, setPolicyStatus] = useState({
        length: false,
        upper: false,
        lower: false,
        number: false,
        special: false,
    });
    const [shakeAnim] = useState(new Animated.Value(0));


    const validatePasswords = () => {
        if (password && confirmPassword && password !== confirmPassword) {
            setError((prev) => ({ ...prev, passwordvalidationError: "Passwords don't match" }));
        }
        else setError((prev) => ({ ...prev, passwordvalidationError: "" }));
    }

    const validatePasswordPolicy = (pwd: string) => {
        const status = {
            length: pwd.length >= 8,
            upper: /[A-Z]/.test(pwd),
            lower: /[a-z]/.test(pwd),
            number: /[0-9]/.test(pwd),
            special: /[^A-Za-z0-9]/.test(pwd),
        };
        setPolicyStatus(status);
        return Object.values(status).every(Boolean);
    };

    const triggerShake = () => {
        shakeAnim.setValue(0);
        Animated.sequence([
            Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 6, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: -6, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
        ]).start();
    };
    const validateFields = () => {
        if (!name) {
            setError((prev) => ({ ...prev, nameError: "Please enter name" }));
            return false
        }
        else {
            setError((prev) => ({ ...prev, nameError: "" }));
        }
        if (!email) {
            setError((prev) => ({ ...prev, emailError: "Please enter email" }));
            return false
        }
        else {
            setError((prev) => ({ ...prev, emailError: "" }));
        }
        if (!password) {
            setError((prev) => ({ ...prev, passwordError: "Please enter password" }));
            return false
        }
        else {
            setError((prev) => ({ ...prev, passwordError: "" }));
        }
        if (!confirmPassword) {
            setError((prev) => ({ ...prev, passwordvalidationError: "Please confirm password" }));
            return false
        }
        else {
            setError((prev) => ({ ...prev, passwordvalidationError: "" }));
        }
        if (password && confirmPassword && password !== confirmPassword) {
            setError((prev) => ({ ...prev, passwordvalidationError: "Passwords don't match" }));
            return false
        }
        else setError((prev) => ({ ...prev, passwordvalidationError: "" }));

        if (passwordInvalid) {
            triggerShake();
            return false;
        }
        return true
    }
    const handleVerify = async () => {
        if (!validateFields()) return;
        try {
            const parsedAmount = parseFloat(assignBalance) || 0;
            setButtonDisabled(true)
            const response = await api.post(`/admin/registeruser`, { name, email, password, balance: parsedAmount })
            router.navigate('/(tabs)/home');
            addUser({
                _id: response.data.id,
                name,
                netBalance: parsedAmount,
                createdAt: response.data.createdAt,
                expenses: []
            });

            // router.navigate('/(tabs)/home');
        } catch (error: any) {
            setButtonDisabled(false)
            setError((prev) => ({ ...prev, serverError: error.response.data.message }));
        }
    }

    return (
        <SafeAreaView className="flex-1 p-6 dark:bg-gray-900 ">
            <View className="flex-[0.5] justify-center items-center">
                <Text className="text-4xl font-bold dark:text-white mb-2">ExpenseGauge</Text>
                <Text className="text-gray-400 text-center">
                    Manage your finances with ease
                </Text>
            </View>
            <Text className="text-2xl text-center font-semibold dark:text-white text-gray-800 mb-6">
                Register a New User
            </Text>
            <View className="flex gap-5 space-y-6">
                {error.serverError && <Text className="text-red-600 -mt-4 -mb-1 px-3 text-center">{error.serverError}</Text>}

                <TextInput
                    className="dark:bg-gray-800 dark:text-white bg-white p-4 rounded-lg text-lg"
                    placeholder="Full Name"
                    placeholderTextColor="#9CA3AF"
                    onChangeText={setName}
                />
                {error.nameError && <Text className="text-red-600 -mt-4 -mb-1 px-3">{error.nameError}</Text>}
                <TextInput
                    className="dark:bg-gray-800 dark:text-white bg-white p-4 rounded-lg text-lg"
                    placeholder="Email"
                    placeholderTextColor="#9CA3AF"
                    onChangeText={setEmail}
                />
                {error.emailError && <Text className="text-red-600 -mt-4 -mb-1 px-3">{error.emailError}</Text>}

                <TextInput
                    className={`dark:bg-gray-800 dark:text-white bg-white p-4 rounded-lg text-lg ${passwordInvalid ? 'border-2 border-red-500' : ''}`}
                    placeholder="Password"
                    placeholderTextColor="#9CA3AF"
                    onChangeText={(text) => {
                        setPassword(text);
                        validatePasswordPolicy(text);
                        setPasswordInvalid(false);
                    }}
                    onFocus={() => setIsPasswordFocused(true)}
                    onBlur={() => {
                        setIsPasswordFocused(false);
                        const valid = validatePasswordPolicy(password);
                        setPasswordInvalid(!valid);
                        if (!valid) triggerShake();
                    }}
                    secureTextEntry
                />
                {error.passwordError && <Text className="text-red-600 -mt-4 -mb-1 px-3">{error.passwordError}</Text>}

                {(isPasswordFocused || passwordInvalid) && (
                    <Animated.View
                        style={{
                            transform: [{ translateX: shakeAnim }],
                            borderWidth: passwordInvalid ? 2 : 0,
                            borderColor: passwordInvalid ? '#ef4444' : 'transparent',
                            borderRadius: 8,
                        }}
                        className={`bg-gray-200 dark:bg-gray-800 w-full p-3 rounded-lg`}
                    >
                        <Text className="text-gray-400 font-semibold mb-1">Password policy</Text>
                        <View>
                            <Text className={`text-sm mt-[0.5] ${policyStatus.length ? 'text-green-500' : 'text-gray-500 dark:text-gray-400'}`}>
                                &bull; Minimum 8 characters
                            </Text>
                            <Text className={`text-sm mt-[0.5] ${policyStatus.upper ? 'text-green-500' : 'text-gray-500 dark:text-gray-400'}`}>
                                &bull; At least one uppercase letter
                            </Text>
                            <Text className={`text-sm mt-[0.5] ${policyStatus.lower ? 'text-green-500' : 'text-gray-500 dark:text-gray-400'}`}>
                                &bull; At least one lowercase letter
                            </Text>
                            <Text className={`text-sm mt-[0.5] ${policyStatus.number ? 'text-green-500' : 'text-gray-500 dark:text-gray-400'}`}>
                                &bull; At least one number
                            </Text>
                            <Text className={`text-sm mt-[0.5] ${policyStatus.special ? 'text-green-500' : 'text-gray-500 dark:text-gray-400'}`}>
                                &bull; At least one special character
                            </Text>
                        </View>
                    </Animated.View>
                )}


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
                        Sign Up
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}
