import { useSyncExternalStore } from 'react';
import { Linking } from 'react-native';
import { create } from 'zustand';

/**
 * How this browser can get the app:
 * - prompt: Chrome/Edge can install the web app (it opens in its own window)
 * - ios: Safari on iPhone/iPad, installed by hand via Share > Add to Home Screen
 * - play: Android, where the Play Store app is the better choice
 * - null: already installed, or the browser can't install web apps
 */
export type InstallMode = 'prompt' | 'ios' | 'play' | null;

export const INSTALL_LABELS: Record<Exclude<InstallMode, null>, string> = {
  prompt: 'Install app',
  ios: 'Add to Home Screen',
  play: 'Get the Android app',
};

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.expensegauge';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const hasWindow = typeof window !== 'undefined';
const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
// iPadOS reports itself as a Mac; touch support tells them apart
const isIOS = /iphone|ipad|ipod/i.test(userAgent)
  || (/macintosh/i.test(userAgent) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1);
const isAndroid = /android/i.test(userAgent);

let deferredPrompt: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

const isStandalone = () =>
  hasWindow && (window.matchMedia?.('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true);

// The browser fires this once, early, when the app can be installed. Keep it so
// an "Install app" button can show the prompt later.
if (hasWindow) {
  if ('serviceWorker' in navigator) {
    const register = () => navigator.serviceWorker.register('/sw.js').catch(() => {});
    // The bundle often runs after the page has finished loading
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register);
  }
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferredPrompt = null;
    notify();
  });
}

const currentMode = (): InstallMode => {
  if (installed || isStandalone()) return null;
  if (isAndroid) return 'play';
  if (deferredPrompt) return 'prompt';
  if (isIOS) return 'ios';
  return null;
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Shows the "Add to Home Screen" steps on iPhone/iPad (InstallHelpModal). */
export const useInstallHelp = create<{ visible: boolean; setVisible: (visible: boolean) => void }>()((set) => ({
  visible: false,
  setVisible: (visible) => set({ visible }),
}));

export const useInstallApp = () => {
  const mode = useSyncExternalStore(subscribe, currentMode, () => null);

  const install = async () => {
    if (mode === 'play') {
      await Linking.openURL(PLAY_STORE_URL);
    } else if (mode === 'ios') {
      useInstallHelp.getState().setVisible(true);
    } else if (mode === 'prompt' && deferredPrompt) {
      const prompt = deferredPrompt;
      await prompt.prompt();
      await prompt.userChoice;
      // A prompt can only be shown once
      deferredPrompt = null;
      notify();
    }
  };

  return { mode, install };
};
