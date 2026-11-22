import { useEffect, useRef, useState } from 'react';
import { View, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { Toast } from 'toastify-react-native';
import api from '@/api/api';
import { useAuthStore } from '@/store/authStore';

// Browser sign-in with Google Identity Services. It needs only the web client ID
// (no secret): Google returns an ID token, which the backend verifies exactly as
// it does the token from the Android app.
type CredentialResponse = { credential?: string };
type GoogleId = {
  initialize: (config: Record<string, unknown>) => void;
  renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
};
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

const CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
const MAX_BUTTON_WIDTH = 400; // Google's limit

let scriptPromise: Promise<void> | null = null;
const loadGoogleScript = () => {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SCRIPT_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        scriptPromise = null;
        reject(new Error('Could not load Google Sign-In'));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
};

export default function GoogleSignInButton({ setStatus }: { setStatus: (loading: boolean) => void }) {
  const router = useRouter();
  const { setTokens, setUser } = useAuthStore();
  const isDark = useColorScheme() === 'dark';
  const buttonRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  // Latest values for the callback Google keeps hold of
  const onCredential = useRef<(response: CredentialResponse) => void>(() => {});
  onCredential.current = async ({ credential }) => {
    if (!credential) return;
    try {
      setStatus(true);
      const res = await api.post('/user/google-login', { idToken: credential, role: 'user' });
      setTokens(res.data.accessToken, res.data.refreshToken);
      setUser(res.data.name, res.data.email, res.data.role ?? 'user', res.data.profilePicture);
      router.replace(res.data.role === 'admin' ? '/(tabs)/home/adminView' : '/(tabs)/home');
    } catch (error: any) {
      console.error('Google Sign-In Error:', error);
      Toast.error(error.response?.data?.message || 'Google Sign-In failed. Please try again.');
    } finally {
      setStatus(false);
    }
  };

  useEffect(() => {
    if (!CLIENT_ID || !width) return;
    let cancelled = false;
    loadGoogleScript()
      .then(() => {
        const google = window.google?.accounts?.id;
        if (cancelled || !google || !buttonRef.current) return;
        google.initialize({
          client_id: CLIENT_ID,
          callback: (response: CredentialResponse) => onCredential.current(response),
          ux_mode: 'popup',
          auto_select: false,
        });
        buttonRef.current.innerHTML = '';
        google.renderButton(buttonRef.current, {
          type: 'standard',
          theme: isDark ? 'filled_black' : 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'center',
          width: Math.min(Math.floor(width), MAX_BUTTON_WIDTH),
        });
      })
      .catch((error) => console.error(error));
    return () => {
      cancelled = true;
    };
  }, [isDark, width]);

  if (!CLIENT_ID) return null;

  return (
    <View className="mt-4 items-center" onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <div ref={buttonRef} style={{ minHeight: 44 }} />
    </View>
  );
}
