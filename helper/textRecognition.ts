import { Platform } from 'react-native';

// On-device text recognition: Google ML Kit on Android (through Google Play
// services), Apple Vision on iOS. Images never leave the phone.
export const canRecognizeText = Platform.OS === 'android' || Platform.OS === 'ios';

type TextExtractor = {
  isSupported: boolean;
  extractTextFromImage: (uri: string) => Promise<string[]>;
};

/**
 * Reads the text in an image (a file:// or content:// uri), one line per row.
 * The module is loaded on first use: importing it on web, or on an app build
 * made before it was added, would crash at startup.
 */
export const recognizeImageText = async (uri: string): Promise<string> => {
  if (!canRecognizeText) throw new Error('Scanning works in the Android app');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const extractor = require('expo-text-extractor') as TextExtractor;
  if (!extractor.isSupported) throw new Error('Text recognition is not available on this phone');
  // Blocks of text in reading order; each block can hold several lines
  const blocks = await extractor.extractTextFromImage(uri);
  return blocks.join('\n');
};
