// Keep in sync with backend/utils/groupLimits.js
export const MAX_GROUP_NAME_LENGTH = 50;
export const MAX_GROUP_MEMBERS = 50;

const INVITE_BASE_URL =
  process.env.EXPO_PUBLIC_INVITE_BASE_URL || 'https://expensegauge.prathmeshjain.in/invite';

export const inviteLink = (code: string) => `${INVITE_BASE_URL}/${code}`;

const INVITE_CODE_PATTERN = /^[A-Za-z0-9]{4,16}$/;

// Accepts a bare code or a pasted invite link
export const parseInviteCode = (input: string): string | null => {
  const trimmed = input.trim();
  const fromLink = trimmed.match(/invite\/([A-Za-z0-9]{4,16})\/?(?:[?#].*)?$/);
  const code = fromLink ? fromLink[1] : trimmed;
  return INVITE_CODE_PATTERN.test(code) ? code.toUpperCase() : null;
};

// Same rule as the backend user model
export const looksLikeEmail = (value: string) => /^\S+@\S+\.\S+$/.test(value.trim());

export const cleanName =(value: string) => value.trim().replace(/\s+/g, ' ');
