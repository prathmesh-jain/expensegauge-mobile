import React, { useState } from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Toast } from 'toastify-react-native';
import { useGroupStore } from '@/store/groupStore';
import { deleteSettlementApi } from '@/api/groupApi';
import {
  describeChange, formatDateTime, formatMoney, memberName, paymentMethodLabel, roundOffText,
} from '@/helper/groupFormat';
import InitialsAvatar from '@/components/InitialsAvatar';
import ConfirmModal from '@/components/ConfirmModal';
import SettleRoute from '@/components/SettleRoute';
import type { ActivityItem, Group, GroupExpense, GroupSettlement } from '@/types/group';

type Props = { group: Group; item: ActivityItem | null; onClose: () => void };

const SPLIT_SUFFIX = {
  equal: ', split equally',
  exact: ', split by exact amounts',
  percent: ', split by percentage',
  shares: ', split by shares',
} as const;

// Bottom sheet with the full details of an expense or payment
export default function ActivityDetailSheet({ group, item, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';
  const closeIcon = <Feather name="x" size={22} color={isDark ? '#d1d5db' : '#4b5563'} />;

  return (
    <Modal visible={!!item} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/50">
        {item?.kind === 'settlement' && (
          <PaymentDetails group={group} settlement={item} onClose={onClose} closeIcon={closeIcon} bottom={insets.bottom} />
        )}
        {item?.kind === 'expense' && (
          <ExpenseDetails group={group} expense={item} onClose={onClose} closeIcon={closeIcon} bottom={insets.bottom} />
        )}
      </View>
    </Modal>
  );
}

type DetailProps = { group: Group; onClose: () => void; closeIcon: React.ReactNode; bottom: number };

const PaymentDetails = ({ group, settlement, onClose, closeIcon, bottom }: DetailProps & { settlement: GroupSettlement }) => {
  const upsertGroup = useGroupStore((state) => state.upsertGroup);
  const setActivity = useGroupStore((state) => state.setActivity);
  const bumpPersonalLedger = useGroupStore((state) => state.bumpPersonalLedger);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const deletePayment = async () => {
    setDeleting(true);
    const result = await deleteSettlementApi(group._id, settlement._id);
    setDeleting(false);
    if (!result.ok) return Toast.error(result.message);
    upsertGroup(result.data);
    const list = useGroupStore.getState().activityByGroup[group._id] ?? [];
    setActivity(group._id, list.filter((a) => a._id !== settlement._id));
    if (settlement.addedToPersonal) bumpPersonalLedger();
    setConfirmDelete(false);
    onClose();
    Toast.success('Payment deleted');
  };

  return (
    <View className="dark:bg-gray-900 bg-white rounded-t-2xl p-6" style={{ paddingBottom: bottom + 24, maxHeight: '90%' }}>
      <View className="flex-row items-start">
        <View className="flex-1 pr-3">
          <Text className="text-xl font-bold dark:text-white text-gray-900">
            {memberName(group, settlement.fromMemberId)} paid {memberName(group, settlement.toMemberId)}
          </Text>
          <Text className="dark:text-gray-400 text-gray-500 text-xs mt-1">
            {new Date(settlement.date).toDateString()} · {paymentMethodLabel(settlement.method)}
          </Text>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={10}>{closeIcon}</TouchableOpacity>
      </View>

      <ScrollView className="mt-4" showsVerticalScrollIndicator={false}>
        <Text className="text-3xl font-bold dark:text-white text-gray-900">
          {formatMoney(settlement.amount, group.currencySymbol)}
        </Text>
        {settlement.roundOff !== 0 && (
          <Text className="dark:text-gray-300 text-gray-600 mt-1">
            Cleared {formatMoney(settlement.settledAmount, group.currencySymbol)} owed · {roundOffText(settlement, group)}
          </Text>
        )}
        {!!settlement.note && (
          <Text className="dark:text-gray-300 text-gray-600 mt-3 italic">&ldquo;{settlement.note}&rdquo;</Text>
        )}

        {settlement.route ? (
          <View className="mt-5 rounded-xl p-3 border border-gray-200 dark:border-gray-700">
            <Text className="dark:text-white text-gray-900 font-semibold mb-3">How this was settled</Text>
            <SettleRoute
              group={group}
              before={settlement.route.before}
              after={settlement.route.after}
              nets={settlement.route.nets}
              highlight={{ from: settlement.fromMemberId, to: settlement.toMemberId }}
            />
            <Text className="dark:text-gray-500 text-gray-400 text-[11px] mt-3">
              Balances as of {formatDateTime(settlement.route.computedAt)}
            </Text>
          </View>
        ) : (
          <Text className="dark:text-gray-500 text-gray-400 text-xs mt-4">Recorded as a direct payment.</Text>
        )}

        <Text className="dark:text-gray-500 text-gray-400 text-xs mt-4">
          Recorded by {memberName(group, settlement.createdByMemberId)}
          {settlement.addedToPersonal ? ' · also in your expenses' : ''}
        </Text>

        {settlement.canDelete && (
          <TouchableOpacity
            onPress={() => setConfirmDelete(true)}
            className="mt-5 p-4 rounded-xl border border-red-300 dark:border-red-800 flex-row items-center justify-center"
          >
            <Feather name="trash-2" size={16} color="#ef4444" />
            <Text className="text-red-500 font-semibold ml-2">Delete payment</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <ConfirmModal
        visible={confirmDelete}
        title="Delete this payment?"
        message={settlement.addedToPersonal
          ? 'Balances go back to how they were, and the entry in your personal expenses is removed.'
          : 'Balances go back to how they were before this payment.'}
        confirmLabel="Delete"
        icon="trash-2"
        tone="danger"
        loading={deleting}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={deletePayment}
      />
    </View>
  );
};

const ExpenseDetails = ({ group, expense, onClose, closeIcon, bottom }: DetailProps & { expense: GroupExpense }) => {
  const router = useRouter();
  const edits = expense.edits ?? [];

  return (
    <View className="dark:bg-gray-900 bg-white rounded-t-2xl p-6" style={{ paddingBottom: bottom + 24 }}>
      <View className="flex-row items-start">
        <View className="flex-1 pr-3">
          <Text className="text-xl font-bold dark:text-white text-gray-900">{expense.details}</Text>
          <Text className="dark:text-gray-400 text-gray-500 text-xs mt-1">
            {new Date(expense.date).toDateString()} · {expense.category}
          </Text>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={10}>{closeIcon}</TouchableOpacity>
      </View>

      <Text className="text-3xl font-bold dark:text-white text-gray-900 mt-4">
        {formatMoney(expense.amount, group.currencySymbol)}
      </Text>
      <Text className="dark:text-gray-300 text-gray-600 mt-1">
        Paid by {memberName(group, expense.paidBy[0]?.memberId)}
        {SPLIT_SUFFIX[expense.splitType]}
      </Text>

      <ScrollView style={{ maxHeight: 380 }} className="mt-4">
        {expense.splits.map((s) => (
          <View key={s.memberId} className="flex-row items-center py-2">
            <InitialsAvatar name={memberName(group, s.memberId, { you: false })} size={32} />
            <Text className="flex-1 ml-3 dark:text-white text-gray-900">{memberName(group, s.memberId)}</Text>
            {typeof s.weight === 'number' && (
              <Text className="dark:text-gray-500 text-gray-400 text-xs mr-2">
                {expense.splitType === 'percent' ? `${s.weight}%` : `${s.weight} ${s.weight === 1 ? 'share' : 'shares'}`}
              </Text>
            )}
            <Text className="dark:text-gray-300 text-gray-700">{formatMoney(s.amount, group.currencySymbol)}</Text>
          </View>
        ))}

        <Text className="dark:text-gray-500 text-gray-400 text-xs mt-3">
          Added by {memberName(group, expense.createdByMemberId)} · {formatDateTime(expense.createdAt)}
          {expense.addedToPersonal ? ' · also in your expenses' : ''}
        </Text>

        {/* Edit history, newest first, so everyone sees how it changed */}
        {edits.length > 0 && (
          <View className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
            <Text className="dark:text-gray-300 text-gray-700 font-semibold mb-1">Changes</Text>
            {[...edits].reverse().map((edit) => (
              <View key={edit.at} className="py-2">
                <Text className="dark:text-gray-400 text-gray-500 text-xs">
                  {memberName(group, edit.byMemberId)} edited · {formatDateTime(edit.at)}
                </Text>
                {edit.changes.map((change, index) => (
                  <Text key={`${change.field}-${change.memberId ?? index}`} className="dark:text-gray-200 text-gray-700 text-sm mt-0.5">
                    {describeChange(group, change)}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {expense.canEdit ? (
        <TouchableOpacity
          onPress={() => {
            onClose();
            router.push({ pathname: '/(tabs)/groups/expense', params: { groupId: group._id, expenseId: expense._id } });
          }}
          className="bg-indigo-600 p-4 rounded-xl mt-5 flex-row items-center justify-center"
        >
          <Feather name="edit-2" size={16} color="white" />
          <Text className="text-white font-semibold ml-2">Edit or delete</Text>
        </TouchableOpacity>
      ) : (
        <Text className="dark:text-gray-500 text-gray-400 text-xs mt-2">
          Only {memberName(group, expense.createdByMemberId)} can edit or delete this expense.
        </Text>
      )}
    </View>
  );
};
