import * as ImagePicker from 'expo-image-picker';
import { recognizeImageText } from '@/helper/textRecognition';
import { parseExpenseText, type ParsedExpense } from '@/helper/expenseParser';
import { predictCategory } from '@/helper/categoryDetector';

export type ScanSource = 'camera' | 'library';

export type ScanResult =
  | { status: 'ok'; parsed: ParsedExpense; category?: string }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

const pickImage = async (source: ScanSource): Promise<string | null | 'denied'> => {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return 'denied';
  }
  // Full quality, no cropping: text recognition works best on the original photo
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, allowsEditing: false };
  const result = source === 'camera'
    ? await ImagePicker.launchCameraAsync(options)
    : await ImagePicker.launchImageLibraryAsync(options);
  return result.canceled ? null : result.assets[0]?.uri ?? null;
};

/** Reads an image's text on the phone and turns it into expense fields. */
export const readBillImage = async (uri: string): Promise<ScanResult> => {
  try {
    const text = await recognizeImageText(uri);
    if (!text.trim()) return { status: 'error', message: "Couldn't find any text. Try a sharper, well-lit photo." };
    const parsed = parseExpenseText(text);
    const category = parsed.details && !parsed.incoming ? predictCategory(parsed.details) : undefined;
    return { status: 'ok', parsed, category: category && category !== 'Other' ? category : undefined };
  } catch {
    return { status: 'error', message: "Couldn't read that image" };
  }
};

/** Camera or gallery → read → parsed fields. */
export const scanBill = async (source: ScanSource): Promise<ScanResult> => {
  const uri = await pickImage(source);
  if (uri === 'denied') return { status: 'error', message: 'Allow camera access for ExpenseGauge in your phone settings' };
  if (!uri) return { status: 'cancelled' };
  return readBillImage(uri);
};

/** Route params that open Add Debit (or Add Credit for money received) filled in */
export const prefillParams = (parsed: ParsedExpense, category?: string) => {
  const type = parsed.incoming ? 'credit' : 'debit';
  const rounded = parsed.amount ? String(Math.round(Number(parsed.amount))) : undefined;
  return {
    type,
    ...(parsed.amount ? { prefillAmount: parsed.amount } : {}),
    ...(parsed.details ? { prefillDetails: parsed.details } : {}),
    ...(parsed.date ? { prefillDate: parsed.date } : {}),
    ...(category && type === 'debit' ? { prefillCategory: category } : {}),
    prefillNote: scanNote(parsed, rounded),
  };
};

/** The note shown on a form filled from a scan */
export const scanNote = (parsed: ParsedExpense, formAmount?: string) => {
  if (!parsed.amount) return "Read from your bill, but couldn't find the amount. Please enter it.";
  const exact = formAmount && formAmount !== parsed.amount ? ` (read ${parsed.amount})` : '';
  return parsed.amountConfidence === 'low'
    ? `Read from your bill. Please check the amount${exact}.`
    : `Read from your bill. Check the details before saving${exact}.`;
};
