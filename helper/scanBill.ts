import * as ImagePicker from 'expo-image-picker';
import { recognizeRows } from '@/helper/textRecognition';
import { analyzeText, type ParsedExpense, type ScanAnalysis } from '@/helper/expenseParser';
import { predictCategory } from '@/helper/categoryDetector';

export type ScanSource = 'camera' | 'library';

export type PickResult =
  | { status: 'ok'; uri: string }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

export type ReadResult =
  | { status: 'ok'; analysis: ScanAnalysis }
  | { status: 'error'; message: string };

/** Camera or gallery. With crop, the user can trim away other text before it's read. */
export const pickBillImage = async (source: ScanSource, crop: boolean): Promise<PickResult> => {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return { status: 'error', message: 'Allow camera access for ExpenseGauge in your phone settings' };
  }
  // Full quality: text recognition works best on the original photo
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, allowsEditing: crop };
  const result = source === 'camera'
    ? await ImagePicker.launchCameraAsync(options)
    : await ImagePicker.launchImageLibraryAsync(options);
  const uri = result.canceled ? undefined : result.assets[0]?.uri;
  return uri ? { status: 'ok', uri } : { status: 'cancelled' };
};

/** Reads an image's text on the phone and finds the amounts, names and date in it. */
export const readBillImage = async (uri: string): Promise<ReadResult> => {
  try {
    const analysis = analyzeText(await recognizeRows(uri));
    if (!analysis.rows.length) return { status: 'error', message: "Couldn't find any text. Try a sharper, well-lit photo." };
    return { status: 'ok', analysis };
  } catch {
    return { status: 'error', message: "Couldn't read that image" };
  }
};

/** A category guess for what was bought, if there is a good one */
export const categoryFor = (parsed: ParsedExpense) => {
  const category = parsed.details && !parsed.incoming ? predictCategory(parsed.details) : undefined;
  return category && category !== 'Other' ? category : undefined;
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
  if (!parsed.amount) return 'Filled from your bill. Enter the amount.';
  const exact = formAmount && formAmount !== parsed.amount ? ` (bill says ${parsed.amount})` : '';
  return parsed.amountConfidence === 'low'
    ? `Filled from your bill. Please check the amount${exact}.`
    : `Filled from your bill. Check the details before saving${exact}.`;
};
