import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  expenseImpact, formatMoney, formatShortDate, memberName, paymentMethodLabel, roundOffText, TONE_TEXT,
} from '@/helper/groupFormat';
import type { ActivityItem, Group } from '@/types/group';

type Props = { group: Group; item: ActivityItem; onPress: (item: ActivityItem) => void };

// One expense or payment in a group's activity list
export default function ActivityRow({ group, item, onPress }: Props) {
  if (item.kind === 'settlement') {
    const rounding = roundOffText(item, group);
    const involvesMe = item.fromMemberId === group.myMemberId || item.toMemberId === group.myMemberId;
    return (
      <TouchableOpacity
        onPress={() => onPress(item)}
        activeOpacity={0.7}
        className="flex-row items-center py-3 border-b border-gray-100 dark:border-gray-800"
      >
        <View className="w-11 items-center">
          <Text className="dark:text-gray-400 text-gray-500 text-xs text-center">{formatShortDate(item.date)}</Text>
        </View>
        <View className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 items-center justify-center ml-2">
          <Feather name="check" size={15} color="#6b7280" />
        </View>
        <View className="flex-1 ml-2">
          <Text className={`dark:text-white text-gray-900 ${involvesMe ? 'font-semibold' : 'font-medium'}`} numberOfLines={1}>
            {memberName(group, item.fromMemberId)} paid {memberName(group, item.toMemberId)} {formatMoney(item.amount, group.currencySymbol)}
          </Text>
          <Text className="dark:text-gray-400 text-gray-500 text-xs mt-0.5" numberOfLines={1}>
            {[item.source === 'smart' ? 'Smart settle' : null, rounding ?? paymentMethodLabel(item.method)].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  const impact = expenseImpact(item, group.currencySymbol);
  const payer = memberName(group, item.paidBy[0]?.memberId);
  return (
    <TouchableOpacity
      onPress={() => !item.pendingSync && onPress(item)}
      activeOpacity={item.pendingSync ? 1 : 0.7}
      className="flex-row items-center py-3 border-b border-gray-100 dark:border-gray-800"
    >
      <View className="w-11 items-center">
        <Text className="dark:text-gray-400 text-gray-500 text-xs text-center">{formatShortDate(item.date)}</Text>
      </View>
      <View className="flex-1 ml-2">
        <Text className="dark:text-white text-gray-900 font-medium" numberOfLines={1}>{item.details}</Text>
        <Text className="dark:text-gray-400 text-gray-500 text-xs mt-0.5" numberOfLines={1}>
          {item.pendingSync
            ? 'Waiting to sync'
            : `${payer} paid ${formatMoney(item.amount, group.currencySymbol)}${item.edits?.length ? ' · edited' : ''}`}
        </Text>
      </View>
      <View className="items-end ml-2">
        {item.pendingSync ? (
          <Feather name="clock" size={16} color="#d97706" />
        ) : (
          <Text className={`text-xs font-semibold ${TONE_TEXT[impact.tone]}`}>{impact.text}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}
