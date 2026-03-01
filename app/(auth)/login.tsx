import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { Text, TextInput, TouchableOpacity, View, Animated, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState } from "react";
import api from "@/api/api";
import { useAuthStore } from "@/store/authStore";
import LoaderModal from "../expenseModal/LoaderModal";
import GoogleAuthButton from "./GoogleAuthButton";



export default function Login() {

  const [loading, setLoading] = useState(false);
  const { type, role } = useLocalSearchParams<Record<string, string>>();
  const isLogin = type === 'login';
  const [name, setName] = useState("")
  const [email, setEmail] = useState("") // Changed from username to email
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [buttonDisabled, setButtonDisabled] = useState(false)
  const [error, setError] = useState({
    nameError: '',
    emailError: '', // Changed from usernameError to emailError
    passwordError: '',
    passwordvalidationError: '',
    serverError: '',
  })
  const { setTokens, setUser } = useAuthStore();
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
  const validateFields = () => {
    if (!isLogin) {
      if (!name) {
        setError((prev) => ({ ...prev, nameError: "Please enter name" }));
        return false
      }
      else {
        setError((prev) => ({ ...prev, nameError: "" }));
      }
      if (password !== confirmPassword) return false;
    }
    if (!email) { // Changed from username to email
      setError((prev) => ({ ...prev, emailError: "Please enter email" })); // Changed from usernameError to emailError
      return false
    }
    else {
      setError((prev) => ({ ...prev, emailError: "" })); // Changed from usernameError to emailError
    }
    if (!password) {
      setError((prev) => ({ ...prev, passwordError: "Please enter password" }));
      return false
    }
    else {
      setError((prev) => ({ ...prev, passwordError: "" }));
    }
    if (passwordInvalid) {
      triggerShake();
      return false;
    }
    return true
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
  const handleVerify = async () => {
    setLoading(true);
    if (!validateFields()) {
      setLoading(false);
      return;
    }
    try {
      setButtonDisabled(true);
      if (isLogin) {
        const response = await api.post(`/user/login`, { email, password }) // Changed from username to email
        setTokens(response.data.accessToken, response.data.refreshToken);
        setUser(response.data.name, response.data.email, response.data.role, response.data.profilePicture); // Changed username to email
        if (response.data.role === 'admin') {
          router.replace("/(tabs)/home/adminView");
        } else {
          router.replace("/(tabs)/home");
        }
      }
      else {
        const response = await api.post(`/user/signup`, { name, email, password, role: role }) // Changed from username to email
        setTokens(response.data.accessToken, response.data.refreshToken);
        setUser(name, email, role, response.data.profilePicture); // Changed username to email
        if (response.data.role === 'admin') {
          router.replace("/(tabs)/home/adminView");
        } else {
          router.replace("/(tabs)/home");
        }
      }
    } catch (error: any) {
      console.error("error : ", error);
      const message = error.response?.data?.message || error.message || "An unexpected error occurred";
      setError((prev) => ({ ...prev, serverError: message }));
    }
    finally {
      setLoading(false);
      setButtonDisabled(false)
    }
  }


  return (
    <SafeAreaView className="flex-1 dark:bg-gray-900 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: `center` }}
          keyboardShouldPersistTaps="handled"
        >
          <Text className="text-2xl text-center font-bold dark:text-white text-gray-800 mb-6">
            {isLogin ? 'Welcome Back' : `Create Account ${role === 'admin' ? "as Admin" : ""}`}
          </Text>
          <View className="flex gap-5 space-y-6">
            {error.serverError && <Text className="text-red-600 -mt-4 -mb-1 px-3 text-center">{error.serverError}</Text>}

            {!isLogin &&
              <>
                <TextInput
                  className="dark:bg-gray-800 bg-white dark:text-white p-4 rounded-lg text-lg"
                  placeholder="Full Name"
                  placeholderTextColor="#9CA3AF"
                  onChangeText={setName}
                />
                {error.nameError && <Text className="text-red-600 -mt-4 -mb-1 px-3">{error.nameError}</Text>}
              </>
            }
            <TextInput
              className="dark:bg-gray-800 bg-white dark:text-white p-4 rounded-lg text-lg"
              placeholder="Email"
              placeholderTextColor="#9CA3AF"
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {error.emailError && <Text className="text-red-600 -mt-4 -mb-1 px-3">{error.emailError}</Text>}

            <TextInput
              className={`dark:bg-gray-800 bg-white dark:text-white p-4 rounded-lg text-lg ${passwordInvalid ? 'border-2 border-red-500' : ''}`}
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
            {!isLogin && (isPasswordFocused || passwordInvalid) && (
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

            {!isLogin && <TextInput
              className="dark:bg-gray-800 bg-white dark:text-white p-4 rounded-lg text-lg"
              placeholder="Confirm Password"
              placeholderTextColor="#9CA3AF"
              onBlur={validatePasswords}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />}
            {error.passwordvalidationError && <Text className="text-red-600 -mt-4 -mb-1 px-3">{error.passwordvalidationError}</Text>}
            <View className="flex-row justify-end -mt-2">
              <Link href={{
                pathname: `/forgotCredentials`,
              }} asChild>
                <TouchableOpacity>
                  <Text className="text-indigo-400 text-sm">Forgot Password?</Text>
                </TouchableOpacity>
              </Link>
            </View>

            <TouchableOpacity disabled={buttonDisabled} className="bg-indigo-600 disabled:bg-indigo-300 py-4 rounded-lg"
              onPress={handleVerify}>
              <Text className="text-white text-center text-lg font-semibold">
                {isLogin ? 'Login' : `Sign Up ${role == 'admin' ? "as Admin" : ""}`}
              </Text>
            </TouchableOpacity>

            <GoogleAuthButton setStatus={setLoading} role={role} />
            {!isLogin && role !== 'admin' &&
              <TouchableOpacity
                onPress={() => router.navigate('/AdminPreview')}
                className="mt-4 p-4 bg-gray-700 rounded-xl"
              >
                <Text className="text-white text-center font-semibold">
                  👨‍💼 Try Admin View
                </Text>
              </TouchableOpacity>}
          </View>
          <LoaderModal
            visible={loading}
            message={isLogin ? "Logging you in..." : "Creating your account..."}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView >
  );
}