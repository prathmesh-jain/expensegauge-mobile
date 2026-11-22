import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useShareIntentContext } from 'expo-share-intent';
import { Toast } from 'toastify-react-native';
import { useAuthStore } from '@/store/authStore';
import { parseExpenseText } from '@/helper/expenseParser';
import { prefillParams, readBillImage, type ScanResult } from '@/helper/scanBill';
import { predictCategory } from '@/helper/categoryDetector';

// Something shared to ExpenseGauge from another app (a bank SMS, a UPI
// screenshot, a bill photo) opens Add Debit, or Add Credit for money received,
// filled with what could be read from it. Mounted inside the tabs, so it only
// runs once someone is signed in.
export default function ShareIntakeHandler() {
  const router = useRouter();
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  const inAdminMode = useAuthStore((state) => state.role === 'admin' && state.viewMode === 'admin');

  useEffect(() => {
    if (!hasShareIntent) return;
    let cancelled = false;

    const handle = async () => {
      if (inAdminMode) {
        Toast.info('Switch to your personal view in Profile to add expenses');
        return;
      }
      const image = shareIntent.files?.find((f) => f.mimeType?.startsWith('image/'));
      let result: ScanResult;
      if (image) {
        Toast.info('Reading the image…');
        // Shared files arrive as plain paths; text recognition wants a uri
        result = await readBillImage(image.path.startsWith('/') ? `file://${image.path}` : image.path);
      } else {
        const parsed = parseExpenseText(shareIntent.text ?? '');
        const category = parsed.details && !parsed.incoming ? predictCategory(parsed.details) : undefined;
        result = { status: 'ok', parsed, category: category !== 'Other' ? category : undefined };
      }
      if (cancelled) return;
      if (result.status !== 'ok') {
        if (result.status === 'error') Toast.error(result.message);
        return;
      }
      router.push({ pathname: '/expenseModal/[type]', params: prefillParams(result.parsed, result.category) });
    };

    handle().finally(() => resetShareIntent());
    return () => {
      cancelled = true;
    };
  }, [hasShareIntent, shareIntent, inAdminMode, router, resetShareIntent]);

  return null;
}
