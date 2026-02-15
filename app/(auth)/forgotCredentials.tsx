import React, { useState } from 'react';
import { SafeAreaView, Text, TextInput, TouchableOpacity, View, Animated, Alert } from 'react-native';
import { useRouter } from 'expo-router'; // Removed useLocalSearchParams
import api from '@/api/api';

export default function ForgotCredentials() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1); // For forgot password: 1 (request OTP), 2 (reset password)
    const [error, setError] = useState({
        emailError: '',
        otpError: '',
        passwordError: '',
        confirmPasswordError: '',
        serverError: '',
    });

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

    // Removed handleForgotUsername function

    const handleRequestPasswordResetOTP = async () => {
        setError({ emailError: '', otpError: '', passwordError: '', confirmPasswordError: '', serverError: '' }); // Removed usernameError
        // if (!username) { // Removed username validation
        //     setError((prev) => ({ ...prev, usernameError: 'Please enter your username.' }));
        //     return;
        // }
        if (!email) {
            setError((prev) => ({ ...prev, emailError: 'Please enter your email.' }));
            return;
        }
        setLoading(true);
        try {
            const response = await api.post('/user/forgotPassword/requestOtp', { email }); // Removed username
            Alert.alert('Success', response.data.message);
            setStep(2);
        } catch (err: any) {
            setError((prev) => ({ ...prev, serverError: err.response?.data?.message || 'An unexpected error occurred.' }));
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async () => {
        setError({ emailError: '', otpError: '', passwordError: '', confirmPasswordError: '', serverError: '' }); // Removed usernameError
        if (!otp) {
            setError((prev) => ({ ...prev, otpError: 'Please enter the OTP.' }));
            return;
        }
        if (!newPassword) {
            setError((prev) => ({ ...prev, passwordError: 'Please enter a new password.' }));
            return;
        }
        if (newPassword !== confirmPassword) {
            setError((prev) => ({ ...prev, confirmPasswordError: 'Passwords do not match.' }));
            return;
        }
        if (passwordInvalid) {
            triggerShake();
            return;
        }

        setLoading(true);
        try {
            const response = await api.post('/user/forgotPassword/reset', { email, otp, newPassword }); // Removed username
            Alert.alert('Success', response.data.message);
            setEmail('');
            // setUsername(''); // Removed setUsername
            setOtp('');
            setNewPassword('');
            setConfirmPassword('');
            setStep(1); // Reset to step 1 for next use
            router.back();
        } catch (err: any) {
            setError((prev) => ({ ...prev, serverError: err.response?.data?.message || 'An unexpected error occurred.' }));
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 p-6 dark:bg-gray-900 justify-center">
            <Text className="text-3xl text-center font-bold dark:text-white text-gray-800 mb-8">
                Reset Password
            </Text>

            {/* Removed tab selection UI */}
            {/* <View className="flex-row justify-center mb-8">
                <TouchableOpacity
                    onPress={() => { setActiveTab('username'); setStep(1); setError({ emailError: '', usernameError: '', otpError: '', passwordError: '', confirmPasswordError: '', serverError: '' }); }}
                    className={`py-3 px-6 rounded-l-lg ${activeTab === 'username' ? 'bg-indigo-600' : 'bg-gray-700'}`}
                >
                    <Text className="text-white font-semibold">Forgot Username</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => { setActiveTab('password'); setStep(1); setError({ emailError: '', usernameError: '', otpError: '', passwordError: '', confirmPasswordError: '', serverError: '' }); }}
                    className={`py-3 px-6 rounded-r-lg ${activeTab === 'password' ? 'bg-indigo-600' : 'bg-gray-700'}`}
                >
                    <Text className="text-white font-semibold">Forgot Password</Text>
                </TouchableOpacity>
            </View> */}

            <View className="flex gap-5 space-y-4">
                {error.serverError && <Text className="text-red-600 -mt-2 mb-2 px-3 text-center">{error.serverError}</Text>}

                {/* Removed Forgot Username Section */}
                {/* {activeTab === 'username' ? (
                    <>
                        <TextInput
                            className="dark:bg-gray-800 bg-white dark:text-white p-4 rounded-lg text-lg"
                            placeholder="Enter your email"
                            placeholderTextColor="#9CA3AF"
                            onChangeText={setEmail}
                            value={email}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                        {error.emailError && <Text className="text-red-600 -mt-2 px-3">{error.emailError}</Text>}

                        <TouchableOpacity
                            disabled={loading}
                            className="bg-indigo-600 disabled:bg-indigo-400 py-4 rounded-lg"
                            onPress={handleForgotUsername}
                        >
                            <Text className="text-white text-center text-lg font-semibold">
                                {loading ? 'Sending...' : 'Get Username'}
                            </Text>
                        </TouchableOpacity>
                    </>
                ) : ( */}
                    {/* Forgot Password Section */}
                    <>
                        {step === 1 ? (
                            // Step 1: Request OTP
                            <>
                                {/* Removed username input */}
                                {/* <TextInput
                                    className="dark:bg-gray-800 bg-white dark:text-white p-4 rounded-lg text-lg"
                                    placeholder="Enter your username"
                                    placeholderTextColor="#9CA3AF"
                                    onChangeText={setUsername}
                                    value={username}
                                    autoCapitalize="none"
                                />
                                {error.usernameError && <Text className="text-red-600 -mt-2 px-3">{error.usernameError}</Text>} */}

                                <TextInput
                                    className="dark:bg-gray-800 bg-white dark:text-white p-4 rounded-lg text-lg"
                                    placeholder="Enter your email"
                                    placeholderTextColor="#9CA3AF"
                                    onChangeText={setEmail}
                                    value={email}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                />
                                {error.emailError && <Text className="text-red-600 -mt-2 px-3">{error.emailError}</Text>}

                                <TouchableOpacity
                                    disabled={loading}
                                    className="bg-indigo-600 disabled:bg-indigo-400 py-4 rounded-lg"
                                    onPress={handleRequestPasswordResetOTP}
                                >
                                    <Text className="text-white text-center text-lg font-semibold">
                                        {loading ? 'Sending OTP...' : 'Request OTP'}
                                    </Text>
                                </TouchableOpacity>
                            </>
                        ) : (
                            // Step 2: Reset Password
                            <>
                                <TextInput
                                    className="dark:bg-gray-800 bg-white dark:text-white p-4 rounded-lg text-lg"
                                    placeholder="Enter OTP"
                                    placeholderTextColor="#9CA3AF"
                                    onChangeText={setOtp}
                                    value={otp}
                                    keyboardType="numeric"
                                />
                                {error.otpError && <Text className="text-red-600 -mt-2 px-3">{error.otpError}</Text>}

                                <TextInput
                                    className={`dark:bg-gray-800 bg-white dark:text-white p-4 rounded-lg text-lg ${passwordInvalid ? 'border-2 border-red-500' : ''}`}
                                    placeholder="New Password"
                                    placeholderTextColor="#9CA3AF"
                                    onChangeText={(text) => {
                                        setNewPassword(text);
                                        validatePasswordPolicy(text);
                                        setPasswordInvalid(false);
                                    }}
                                    onFocus={() => setIsPasswordFocused(true)}
                                    onBlur={() => {
                                        setIsPasswordFocused(false);
                                        const valid = validatePasswordPolicy(newPassword);
                                        setPasswordInvalid(!valid);
                                        if (!valid) triggerShake();
                                    }}
                                    value={newPassword}
                                    secureTextEntry
                                />
                                {error.passwordError && <Text className="text-red-600 -mt-2 px-3">{error.passwordError}</Text>}
                                {(isPasswordFocused || passwordInvalid) && (
                                    <Animated.View
                                        style={{
                                            transform: [{ translateX: shakeAnim }],
                                            borderWidth: passwordInvalid ? 2 : 0,
                                            borderColor: passwordInvalid ? '#ef4444' : 'transparent',
                                            borderRadius: 8,
                                        }}
                                        className={`bg-gray-200 dark:bg-gray-800 w-full mb-4 p-3 rounded-lg`}
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
                                    className="dark:bg-gray-800 bg-white dark:text-white p-4 rounded-lg text-lg"
                                    placeholder="Confirm New Password"
                                    placeholderTextColor="#9CA3AF"
                                    onChangeText={setConfirmPassword}
                                    value={confirmPassword}
                                    secureTextEntry
                                />
                                {error.confirmPasswordError && <Text className="text-red-600 -mt-2 px-3">{error.confirmPasswordError}</Text>}

                                <TouchableOpacity
                                    disabled={loading}
                                    className="bg-indigo-600 disabled:bg-indigo-400 py-4 rounded-lg"
                                    onPress={handleResetPassword}
                                >
                                    <Text className="text-white text-center text-lg font-semibold">
                                        {loading ? 'Resetting...' : 'Reset Password'}
                                    </Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </>
                {/* ) */}
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="mt-4 p-4 bg-gray-700 rounded-xl"
                >
                    <Text className="text-white text-center font-semibold">
                        Back to Login
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}