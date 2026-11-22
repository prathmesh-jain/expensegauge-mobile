// Native apps are already installed: nothing to offer. installApp.web.ts has the
// browser version (install prompt, iOS "Add to Home Screen", Play Store link).
export type InstallMode = 'prompt' | 'ios' | 'play' | null;

export const INSTALL_LABELS: Record<Exclude<InstallMode, null>, string> = {
  prompt: 'Install app',
  ios: 'Add to Home Screen',
  play: 'Get the Android app',
};

export const useInstallApp = (): { mode: InstallMode; install: () => Promise<void> } => ({
  mode: null,
  install: async () => {},
});

type InstallHelp = { visible: boolean; setVisible: (visible: boolean) => void };
const hidden: InstallHelp = { visible: false, setVisible: () => {} };
export const useInstallHelp = <T = InstallHelp>(selector?: (state: InstallHelp) => T): T =>
  (selector ? selector(hidden) : hidden) as T;
