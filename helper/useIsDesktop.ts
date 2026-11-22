import { Platform, useWindowDimensions } from 'react-native';

// Browser windows this wide get the desktop layout (sidebar, wider pages,
// centered dialogs). Phones, tablets and the native apps keep the mobile UI.
export const DESKTOP_MIN_WIDTH = 1024;

export const useIsDesktop = () => {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= DESKTOP_MIN_WIDTH;
};
