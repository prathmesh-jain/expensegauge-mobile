// Keep in sync with backend/utils/expenseLimits.js
export const MAX_DETAILS_LENGTH = 200;
export const MAX_AMOUNT = 999999999;
export const MAX_AMOUNT_DIGITS = 9; // Digit-only inputs
export const MAX_AMOUNT_INPUT_LENGTH = 12; // Inputs that also accept decimals, e.g. 999999999.99

// Pass `original` when editing so older entries that are already over a limit
// can still be edited as long as that field is left unchanged.
export const getExpenseLimitError = (
  details: string,
  amount: number,
  original?: { details?: string; amount?: number }
): string | null => {
  const trimmedDetails = details.trim();
  if (!trimmedDetails) return 'Details cannot be empty';
  if (trimmedDetails.length > MAX_DETAILS_LENGTH && trimmedDetails !== original?.details?.trim()) {
    return `Details cannot be longer than ${MAX_DETAILS_LENGTH} characters`;
  }
  if (!(amount > 0)) return 'Amount must be greater than 0';
  if (amount > MAX_AMOUNT && amount !== original?.amount) {
    return `Amount cannot be more than ${MAX_AMOUNT.toLocaleString('en-IN')}`;
  }
  return null;
};
