import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useGroupStore } from '@/store/groupStore';
import { parseInviteCode } from '@/helper/groupLimits';

// Landing route for https://expensegauge.prathmeshjain.in/invite/<code> and
// expensegauge://invite/<code>. The code is kept until the user is signed in;
// the tabs layout then opens the join screen.
export default function InviteLinkScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const setPendingInviteCode = useGroupStore((state) => state.setPendingInviteCode);

  useEffect(() => {
    const parsed = parseInviteCode(String(code ?? ''));
    if (parsed) setPendingInviteCode(parsed);
    router.replace('/');
  }, [code, router, setPendingInviteCode]);

  return (
    <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900">
      <ActivityIndicator size="large" color="#6366f1" />
    </View>
  );
}
