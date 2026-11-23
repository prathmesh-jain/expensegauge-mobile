import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useShareIntentContext } from 'expo-share-intent';
import { Toast } from 'toastify-react-native';
import { useAuthStore } from '@/store/authStore';
import { parseExpenseText, type ParsedExpense } from '@/helper/expenseParser';
import { categoryFor, prefillParams } from '@/helper/scanBill';
import ScanBillSheet from '@/components/ScanBillSheet';

// Something shared to ExpenseGauge from another app opens Add Debit, or Add
// Credit for money received, filled with what could be read from it. A shared
// image (a bill photo, a UPI screenshot) is read first and the user picks the
// amount and name. Mounted inside the tabs, so it only runs once someone is signed in.
export default function ShareIntakeHandler() {
  const router = useRouter();
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  const inAdminMode = useAuthStore((state) => state.role === 'admin' && state.viewMode === 'admin');
  const [imageUri, setImageUri] = useState<string | null>(null);

  const openForm = (parsed: ParsedExpense, category?: string) =>
    router.push({ pathname: '/expenseModal/[type]', params: prefillParams(parsed, category) });

  useEffect(() => {
    if (!hasShareIntent) return;
    if (inAdminMode) {
      Toast.info('Switch to your personal view in Profile to add expenses');
    } else {
      const image = shareIntent.files?.find((f) => f.mimeType?.startsWith('image/'));
      if (image) {
        // Shared files arrive as plain paths; text recognition wants a uri
        setImageUri(image.path.startsWith('/') ? `file://${image.path}` : image.path);
      } else {
        const parsed = parseExpenseText(shareIntent.text ?? '');
        router.push({ pathname: '/expenseModal/[type]', params: prefillParams(parsed, categoryFor(parsed)) });
      }
    }
    resetShareIntent();
  }, [hasShareIntent, shareIntent, inAdminMode, router, resetShareIntent]);

  return (
    <ScanBillSheet
      visible={imageUri !== null}
      imageUri={imageUri ?? undefined}
      onClose={() => setImageUri(null)}
      onScanned={openForm}
    />
  );
}
