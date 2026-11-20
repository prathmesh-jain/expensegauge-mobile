import { Share } from 'react-native';
import { Toast } from 'toastify-react-native';
import { inviteLink } from '@/helper/groupLimits';

// Opens the share sheet (WhatsApp etc.) with the group's invite link and code
export const shareGroupInvite = async (groupName: string, code: string) => {
  try {
    await Share.share({
      message: `Join "${groupName}" on ExpenseGauge so we can split expenses:\n${inviteLink(code)}\n\nOr open Groups → Join and enter code ${code}`,
    });
  } catch {
    Toast.error("Couldn't open the share sheet");
  }
};
