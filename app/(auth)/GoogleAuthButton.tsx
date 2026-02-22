import { TouchableOpacity, Text, Image } from "react-native";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import api from "@/api/api";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "expo-router";

export default function GoogleAuthButton({ setStatus, role }: { setStatus: (loading: boolean) => void, role?: string }) {
  const router = useRouter();
  const { setTokens, setUser } = useAuthStore();

  const signInWithGoogle = async () => {
    try {
      setStatus(true);
      // Ensure Google Play Services is available
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      // Force Google to show account chooser every time
      await GoogleSignin.signOut();

      // Trigger Google Sign-In native UI
      const userInfo = await GoogleSignin.signIn();
      // Retrieve tokens which contains idToken
      const { idToken } = await GoogleSignin.getTokens();

      if (!idToken) {
        throw new Error("No idToken received from Google");
      }

      // Send to your backend
      const res = await api.post("/user/google-login", { idToken, role: role ?? "user" });

      setTokens(res.data.accessToken, res.data.refreshToken);
      setUser(res.data.name, res.data.email, res.data.role ?? "user", res.data.profilePicture);

      router.replace("/(tabs)/home");
    } catch (error: any) {
      console.error("Google Sign-In Error:", error);
      // Optional: Add a toast or alert here for user feedback
      if (error.code !== 'SIGN_IN_CANCELLED' && error.code !== 'SIGN_IN_IN_PROGRESS') {
        alert("Google Sign-In failed. Please try again.");
      }
    } finally {
      setStatus(false);
    }
  };

  return (
    <TouchableOpacity
      onPress={signInWithGoogle}
      className="bg-white border border-gray-300 dark:border-0 dark:bg-gray-800 p-4 rounded-lg mt-4 flex-row items-center gap-2 justify-center"
    >
      <Text className="text-center text-gray-700 dark:text-white font-semibold">
        Continue with Google
      </Text>

      <Image
        source={require("../../assets/images/google_icon.png")}
        className="w-5 h-5 ml-2"
      />
    </TouchableOpacity>
  );
}
