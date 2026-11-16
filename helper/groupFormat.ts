import { formatCurrency, TWO_DECIMALS } from '@/store/currencyStore';
import type { Group, GroupExpense, PaymentMethod } from '@/types/group';

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'upi', label: 'UPI' },
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank transfer' },
  { value: 'other', label: 'Other' },
];

export const paymentMethodLabel = (method: PaymentMethod) =>
  PAYMENT_METHODS.find((m) => m.value === method)?.label ?? 'Other';

// Money inputs: digits with up to two decimals
export const cleanAmountInput = (value: string) => {
  const cleaned = value.replace(/[^0-9.]/g, '');
  const [whole, ...rest] = cleaned.split('.');
  return rest.length ? `${whole}.${rest.join('').slice(0, 2)}` : whole;
};

// Selectable pill used across the group forms
export const chipClass = (selected: boolean) =>
  `px-4 py-2 rounded-full border ${selected ? 'bg-indigo-600 border-indigo-600' : 'bg-transparent border-gray-300 dark:border-gray-600'}`;
export const chipTextClass = (selected: boolean) =>
  (selected ? 'text-white font-semibold' : 'dark:text-gray-300 text-gray-700');

export const toPaise = (amount: number) => Math.round(amount * 100);
export const fromPaise = (paise: number) => paise / 100;

// Whole amounts without decimals, otherwise always two decimals
export const formatMoney = (amount: number, symbol: string) => {
  const hasFraction = toPaise(Math.abs(amount)) % 100 !== 0;
  return formatCurrency(amount, symbol, hasFraction ? TWO_DECIMALS : undefined);
};

export type Tone = 'positive' | 'negative' | 'neutral';

export const TONE_TEXT: Record<Tone, string> = {
  positive: 'text-green-600 dark:text-green-400',
  negative: 'text-red-500 dark:text-red-400',
  neutral: 'text-gray-500 dark:text-gray-400',
};

export const myBalanceLabel = (net: number, symbol: string): { text: string; tone: Tone } => {
  if (toPaise(net) > 0) return { text: `You are owed ${formatMoney(net, symbol)}`, tone: 'positive' };
  if (toPaise(net) < 0) return { text: `You owe ${formatMoney(-net, symbol)}`, tone: 'negative' };
  return { text: 'All settled up', tone: 'neutral' };
};

export const memberBalanceLabel = (net: number, symbol: string): { text: string; tone: Tone } => {
  if (toPaise(net) > 0) return { text: `gets back ${formatMoney(net, symbol)}`, tone: 'positive' };
  if (toPaise(net) < 0) return { text: `owes ${formatMoney(-net, symbol)}`, tone: 'negative' };
  return { text: 'settled up', tone: 'neutral' };
};

export const memberName = (group: Group, memberId: string, { you = true } = {}) => {
  const member = group.members.find((m) => m._id === memberId);
  if (!member) return 'Someone';
  if (you && member.isYou) return 'You';
  return member.name;
};

// How one expense affects you: what you lent or borrowed
export const expenseImpact = (expense: GroupExpense, symbol: string): { text: string; tone: Tone } => {
  const diff = toPaise(expense.myPaid) - toPaise(expense.myShare);
  if (diff > 0) return { text: `you lent ${formatMoney(fromPaise(diff), symbol)}`, tone: 'positive' };
  if (diff < 0) return { text: `you borrowed ${formatMoney(fromPaise(-diff), symbol)}`, tone: 'negative' };
  if (toPaise(expense.myShare) > 0) return { text: 'your own share', tone: 'neutral' };
  return { text: 'not involved', tone: 'neutral' };
};

// Equal split preview that matches the server: leftover paise go to the first people in group order
export const previewEqualSplit = (amount: number, orderedIds: string[]) => {
  const total = toPaise(amount);
  const count = orderedIds.length;
  const result = new Map<string, number>();
  if (count === 0 || !(total > 0)) return result;
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  orderedIds.forEach((id, index) => result.set(id, fromPaise(base + (index < remainder ? 1 : 0))));
  return result;
};

// Percent/shares preview that matches the server: rounded-down parts, then
// leftover paise to the largest remainders (ties: group order)
export const previewWeightedSplit = (amount: number, rows: { memberId: string; weight: number }[]) => {
  const result = new Map<string, number>();
  const total = toPaise(amount);
  const weighted = rows
    .map((r) => ({ memberId: r.memberId, weight: Math.round(r.weight * 100) }))
    .filter((r) => r.weight > 0);
  const totalWeight = weighted.reduce((sum, r) => sum + r.weight, 0);
  if (!(total > 0) || totalWeight === 0) return result;

  const bigTotal = BigInt(total);
  const bigWeight = BigInt(totalWeight);
  const parts = weighted.map((r, index) => {
    const scaled = bigTotal * BigInt(r.weight);
    return { memberId: r.memberId, paise: Number(scaled / bigWeight), remainder: scaled % bigWeight, index };
  });
  let left = total - parts.reduce((sum, p) => sum + p.paise, 0);
  [...parts]
    .sort((a, b) => (b.remainder > a.remainder ? 1 : b.remainder < a.remainder ? -1 : 0) || a.index - b.index)
    .forEach((p) => {
      if (left > 0) {
        p.paise += 1;
        left -= 1;
      }
    });
  parts.forEach((p) => result.set(p.memberId, fromPaise(p.paise)));
  return result;
};

// Totals across groups, per currency (groups can use different currencies)
export const totalsByCurrency = (groups: Group[]) => {
  const totals = new Map<string, { owed: number; owe: number }>();
  for (const group of groups) {
    const paise = toPaise(group.myNet ?? 0);
    if (paise === 0) continue;
    const entry = totals.get(group.currencySymbol) ?? { owed: 0, owe: 0 };
    if (paise > 0) entry.owed += paise;
    else entry.owe += -paise;
    totals.set(group.currencySymbol, entry);
  }
  return [...totals.entries()].map(([symbol, t]) => ({ symbol, owed: fromPaise(t.owed), owe: fromPaise(t.owe) }));
};
