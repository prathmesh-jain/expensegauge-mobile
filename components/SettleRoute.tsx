import React from 'react';
import { Text, View } from 'react-native';
import { formatMoney, memberName, toPaise } from '@/helper/groupFormat';
import type { Group, MemberBalance, Transfer } from '@/types/group';

type Props = {
  group: Group;
  before: Transfer[];
  after: Transfer[];
  nets: MemberBalance[];
  // The payment being explained, highlighted in the "after" list
  highlight?: { from: string; to: string };
};

const TransferRow = ({ group, t, strong }: { group: Group; t: Transfer; strong?: boolean }) => (
  <View className={`flex-row items-center py-1.5 px-2 rounded-lg ${strong ? 'bg-gray-100 dark:bg-gray-800' : ''}`}>
    <Text className={`flex-1 ${strong ? 'font-semibold dark:text-white text-gray-900' : 'dark:text-gray-200 text-gray-700'}`} numberOfLines={1}>
      {memberName(group, t.from)} <Text className="text-gray-400">→</Text> {memberName(group, t.to)}
    </Text>
    <Text className={strong ? 'font-semibold dark:text-white text-gray-900' : 'dark:text-gray-300 text-gray-600'}>
      {formatMoney(t.amount, group.currencySymbol)}
    </Text>
  </View>
);

// Why a smart-settle payment goes where it does: the debts it replaces,
// everyone's overall position, and the shorter list of payments
export default function SettleRoute({ group, before, after, nets, highlight }: Props) {
  const symbol = group.currencySymbol;
  const isHighlighted = (t: Transfer) => !!highlight && t.from === highlight.from && t.to === highlight.to;
  const owed = nets.filter((n) => toPaise(n.net) > 0);
  const owing = nets.filter((n) => toPaise(n.net) < 0);

  return (
    <View>
      <Text className="dark:text-gray-400 text-gray-500 text-xs font-semibold">
        Who owed whom · {before.length} {before.length === 1 ? 'payment' : 'payments'}
      </Text>
      <View className="mt-1">
        {before.map((t) => <TransferRow key={`b-${t.from}-${t.to}`} group={group} t={t} />)}
      </View>

      <Text className="dark:text-gray-400 text-gray-500 text-xs font-semibold mt-4">
        Overall
      </Text>
      <View className="mt-1 px-2">
        {owed.map((n) => (
          <Text key={n.memberId} className="text-green-600 dark:text-green-400 py-0.5">
            {memberName(group, n.memberId)} {memberName(group, n.memberId) === 'You' ? 'are' : 'is'} owed {formatMoney(n.net, symbol)}
          </Text>
        ))}
        {owing.map((n) => (
          <Text key={n.memberId} className="text-red-500 dark:text-red-400 py-0.5">
            {memberName(group, n.memberId)} {memberName(group, n.memberId) === 'You' ? 'owe' : 'owes'} {formatMoney(-n.net, symbol)}
          </Text>
        ))}
      </View>

      <Text className="dark:text-gray-400 text-gray-500 text-xs font-semibold mt-4">
        Smart settle · {after.length} {after.length === 1 ? 'payment' : 'payments'}
      </Text>
      <View className="mt-1">
        {after.map((t) => <TransferRow key={`a-${t.from}-${t.to}`} group={group} t={t} strong={isHighlighted(t)} />)}
      </View>

      <Text className="dark:text-gray-500 text-gray-400 text-xs mt-3 leading-4">
        Only each person&apos;s overall total matters. Whoever owes the most pays whoever is owed the most,
        so debts that pass through someone in the middle are paid directly instead. Everyone ends at zero
        {before.length > after.length ? ` with ${before.length - after.length} fewer ${before.length - after.length === 1 ? 'payment' : 'payments'}.` : '.'}
      </Text>
    </View>
  );
}
