import { requireOptionalNativeModule } from 'expo';

// A line of text and where it sits in the image, in pixels; angle is its slope in degrees
export type TextLine = { text: string; left: number; top: number; right: number; bottom: number; angle: number };
export type RecognizedText = { width: number; height: number; lines: TextLine[] };

type TextScannerModule = { recognize(uri: string): Promise<RecognizedText> };

// Null on iOS, web and builds made before this module was added
export const TextScanner = requireOptionalNativeModule<TextScannerModule>('TextScanner');
