import { Platform, Share } from 'react-native';
import { Toast } from 'toastify-react-native';
import { inviteLink } from '@/helper/groupLimits';

// Opens the share sheet (WhatsApp etc.) with the group's invite link and code
export const shareGroupInvite = async (groupName: string, code: string) => {
  const message = `Join "${groupName}" on ExpenseGauge so we can split expenses:\n${inviteLink(code)}\n\nOr open Groups → Join and enter code ${code}`;

  // Most desktop browsers have no share sheet: copy the invite instead
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && !navigator.share) {
    try {
      await navigator.clipboard.writeText(message);
      Toast.success('Invite copied. Paste it to share');
    } catch {
      Toast.error("Couldn't copy the invite");
    }
    return;
  }

  try {
    await Share.share({ message });
  } catch {
    Toast.error("Couldn't open the share sheet");
  }
};
