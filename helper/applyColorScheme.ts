import { Appearance } from 'react-native';

// Applies the theme picked in Profile > Theme (null follows the system).
// applyColorScheme.web.ts does the same in the browser.
export const applyColorScheme = (theme: 'light' | 'dark' | null) => {
  Appearance.setColorScheme(theme);
};
