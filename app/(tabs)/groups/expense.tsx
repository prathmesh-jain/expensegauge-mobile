import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, ScrollView, Switch, Text, TextInput, TouchableOpacity, View, useColorScheme,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import DateTimePicker, { DateTimePickerEvent } from '@/components/DateTimePicker';
import { Toast } from 'toastify-react-native';
import { useGroupStore } from '@/store/groupStore';
import { useAccountStore } from '@/store/accountStore';
import { fetchAccountsApi } from '@/api/accountApi';
import { addGroupExpenseApi, deleteGroupExpenseApi, updateGroupExpenseApi } from '@/api/groupApi';
import { getExpenseLimitError, MAX_AMOUNT_INPUT_LENGTH, MAX_DETAILS_LENGTH } from '@/helper/expenseLimits';
import {
  chipClass, chipTextClass, cleanAmountInput, formatMoney, fromPaise, memberName, previewEqualSplit, previewWeightedSplit, toPaise,
} from '@/helper/groupFormat';
import { createLocalId } from '@/helper/localId';
import { useKeyboardHeight } from '@/helper/useKeyboardHeight';
import { predictCategory } from '@/helper/categoryDetector';
import InitialsAvatar from '@/components/InitialsAvatar';
import ConfirmModal from '@/components/ConfirmModal';
import type { GroupExpense, GroupExpenseInput, GroupMember, SplitType } from '@/types/group';

const CATEGORIES = [
  'Food & Dining', 'Groceries', 'Transport', 'Shopping', 'Entertainment',
  'Bills & Utilities', 'Healthcare', 'Education', 'Other',
];

const SPLIT_OPTIONS: { value: SplitType; label: string }[] = [
  { value: 'equal', label: 'Equally' },
  { value: 'exact', label: 'Exact' },
  { value: 'percent', label: '%' },
  { value: 'shares', label: 'Shares' },
];



export default function GroupExpenseForm() {
  const { groupId, expenseId } = useLocalSearchParams<{ groupId: string; expenseId?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';
  const keyboardHeight = useKeyboardHeight();

  const group = useGroupStore((state) => state.groups.find((g) => g._id === groupId));
  const existing = useGroupStore((state) => {
    if (!expenseId) return undefined;
    const item = state.activityByGroup[groupId]?.find((e) => e._id === expenseId);
    return item?.kind === 'expense' ? item : undefined;
  });
  const upsertGroup = useGroupStore((state) => state.upsertGroup);
  const setActivity = useGroupStore((state) => state.setActivity);
  const addPendingExpense = useGroupStore((state) => state.addPendingExpense);
  const bumpPersonalLedger = useGroupStore((state) => state.bumpPersonalLedger);
  const { accounts, setAccounts, getDefaultAccount } = useAccountStore();

  const isEdit = !!expenseId;
  const symbol = group?.currencySymbol ?? '₹';
  const myMemberId = group?.myMemberId ?? '';

  // People who can be chosen: everyone still in the group, plus anyone who
  // left but was already on this expense
  const selectable: GroupMember[] = useMemo(() => {
    if (!group) return [];
    const onExpense = new Set(existing ? [...existing.paidBy, ...existing.splits].map((p) => p.memberId) : []);
    return group.members.filter((m) => m.status !== 'left' || onExpense.has(m._id));
  }, [group, existing]);

  const [amount, setAmount] = useState(existing ? String(existing.amount) : '');
  const [details, setDetails] = useState(existing?.details ?? '');
  const [category, setCategory] = useState(existing?.category ?? '');
  const [date, setDate] = useState(existing ? new Date(existing.date) : new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [paidBy, setPaidBy] = useState(existing?.paidBy[0]?.memberId ?? myMemberId);
  const [splitType, setSplitType] = useState<SplitType>(existing?.splitType ?? 'equal');
  const [participants, setParticipants] = useState<Set<string>>(
    () => new Set(existing ? existing.splits.map((s) => s.memberId) : selectable.filter((m) => m.status !== 'left').map((m) => m._id))
  );
  const [exactAmounts, setExactAmounts] = useState<Record<string, string>>(() =>
    existing?.splitType === 'exact'
      ? Object.fromEntries(existing.splits.map((s) => [s.memberId, String(s.amount)]))
      : {}
  );
  // Percent or number of shares per person, as typed
  const [weights, setWeights] = useState<Record<string, string>>(() =>
    existing && (existing.splitType === 'percent' || existing.splitType === 'shares')
      ? Object.fromEntries(existing.splits.map((s) => [s.memberId, String(s.weight ?? '')]))
      : {}
  );
  const [addToPersonal, setAddToPersonal] = useState(existing ? existing.addedToPersonal : true);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const clientId = useRef(createLocalId()).current;

  useEffect(() => {
    if (accounts.length === 0) fetchAccountsApi().then((list) => list.length && setAccounts(list));
  }, [accounts.length, setAccounts]);

  useEffect(() => {
    if (!sourceId && accounts.length > 0) setSourceId(getDefaultAccount()?._id ?? accounts[0]._id);
  }, [accounts, sourceId, getDefaultAccount]);

  if (!group || (isEdit && !existing)) {
    return (
      <SafeAreaView className="flex-1 dark:bg-gray-900 bg-white items-center justify-center">
        <Text className="dark:text-gray-400 text-gray-500">This expense isn&apos;t available</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4 bg-indigo-600 px-6 py-3 rounded-xl">
          <Text className="text-white font-semibold">Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const amountValue = parseFloat(amount) || 0;
  const orderedParticipants = selectable.map((m) => m._id).filter((id) => participants.has(id));
  const equalPreview = previewEqualSplit(amountValue, orderedParticipants);
  const exactSumPaise = Object.values(exactAmounts).reduce((sum, v) => sum + toPaise(parseFloat(v) || 0), 0);
  const remainingPaise = toPaise(amountValue) - exactSumPaise;
  const iPaid = paidBy === myMemberId;
  const isWeighted = splitType === 'percent' || splitType === 'shares';
  const weightRows = selectable.map((m) => ({ memberId: m._id, weight: parseFloat(weights[m._id] || '') || 0 }));
  const weightedPreview = previewWeightedSplit(amountValue, weightRows);
  const weightTotalHundredths = weightRows.reduce((sum, r) => sum + Math.round(r.weight * 100), 0);

  // Who is part of the split right now, whichever way it's being entered
  const currentlyIncluded = (): string[] => {
    if (splitType === 'equal') return orderedParticipants;
    if (splitType === 'exact') return selectable.filter((m) => (parseFloat(exactAmounts[m._id] || '') || 0) > 0).map((m) => m._id);
    return weightRows.filter((r) => r.weight > 0).map((r) => r.memberId);
  };
  const currentAmounts = (): Map<string, number> => {
    if (splitType === 'equal') return equalPreview;
    if (splitType === 'exact') {
      return new Map(selectable.map((m) => [m._id, parseFloat(exactAmounts[m._id] || '') || 0]));
    }
    return weightedPreview;
  };

  // Each switch starts from the current split, so only the differences need typing
  const switchSplitType = (next: SplitType) => {
    if (next === splitType) return;
    const included = currentlyIncluded();
    const ids = included.length ? included : selectable.filter((m) => m.status !== 'left').map((m) => m._id);
    if (next === 'equal') {
      setParticipants(new Set(ids));
    } else if (next === 'exact') {
      const amounts = currentAmounts();
      setExactAmounts(Object.fromEntries(selectable.map((m) => [m._id, (amounts.get(m._id) ?? 0) > 0 ? String(amounts.get(m._id)) : ''])));
    } else if (next === 'percent') {
      // Equal percentages that add up to exactly 100
      const base = Math.floor(10000 / ids.length);
      const extra = 10000 - base * ids.length;
      const ordered = selectable.map((m) => m._id).filter((id) => ids.includes(id));
      setWeights(Object.fromEntries(ordered.map((id, i) => [id, String((base + (i < extra ? 1 : 0)) / 100)])));
    } else {
      setWeights(Object.fromEntries(ids.map((id) => [id, '1'])));
    }
    setSplitType(next);
  };

  const toggleParticipant = (id: string) => {
    setParticipants((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    const limitError = getExpenseLimitError(details, amountValue, existing ? { details: existing.details, amount: existing.amount } : undefined);
    if (limitError) return Toast.error(limitError);
    if (splitType === 'equal' && orderedParticipants.length === 0) return Toast.error('Choose at least one person to split with');
    if (splitType === 'exact' && remainingPaise !== 0) {
      return Toast.error(remainingPaise > 0
        ? `${formatMoney(fromPaise(remainingPaise), symbol)} is still unassigned`
        : `Split is ${formatMoney(fromPaise(-remainingPaise), symbol)} more than the total`);
    }
    if (splitType === 'percent' && weightTotalHundredths !== 10000) {
      return Toast.error(`Percentages add up to ${weightTotalHundredths / 100}%, they need to add up to 100%`);
    }
    if (splitType === 'shares' && weightTotalHundredths === 0) return Toast.error('Give at least one person a share');

    const finalCategory = category || predictCategory(details.trim()) || 'Other';
    const body: GroupExpenseInput = {
      details: details.trim(),
      amount: amountValue,
      date: date.toISOString(),
      category: finalCategory,
      paidByMemberId: paidBy,
      splitType,
      ...(splitType === 'equal'
        ? { participantIds: orderedParticipants }
        : isWeighted
          ? { splits: weightRows.filter((r) => r.weight > 0) }
          : {
            splits: selectable
              .map((m) => ({ memberId: m._id, amount: parseFloat(exactAmounts[m._id] || '') || 0 }))
              .filter((s) => (s.amount ?? 0) > 0),
          }),
      addToPersonal: iPaid && addToPersonal,
      sourceId,
    };

    setSaving(true);
    if (isEdit && existing) {
      const result = await updateGroupExpenseApi(group._id, existing._id, body);
      setSaving(false);
      if (!result.ok) return Toast.error(result.message);
      upsertGroup(result.data.group);
      const list = useGroupStore.getState().activityByGroup[group._id] ?? [];
      const updated = { ...result.data.expense, kind: 'expense' as const };
      setActivity(group._id, list.map((e) => (e._id === existing._id ? updated : e)));
      if (existing.addedToPersonal || result.data.expense.addedToPersonal) bumpPersonalLedger();
      Toast.success('Expense updated');
      router.back();
      return;
    }

    const result = await addGroupExpenseApi(group._id, { ...body, clientId });
    setSaving(false);
    if (!result.ok) return Toast.error(result.message);
    if (result.data.offline) {
      addPendingExpense(group._id, buildPendingExpense(body, clientId, myMemberId));
      Toast.info("Saved offline. It'll sync when you're back online.");
    } else {
      const saved = { ...result.data.expense, kind: 'expense' as const };
      upsertGroup(result.data.group);
      const list = useGroupStore.getState().activityByGroup[group._id] ?? [];
      setActivity(group._id, [saved, ...list.filter((e) => e._id !== saved._id)]);
      if (saved.addedToPersonal) bumpPersonalLedger();
      Toast.success('Expense added');
    }
    router.back();
  };

  const handleDelete = async () => {
    if (!existing) return;
    setSaving(true);
    const result = await deleteGroupExpenseApi(group._id, existing._id);
    setSaving(false);
    if (!result.ok) return Toast.error(result.message);
    upsertGroup(result.data);
    const list = useGroupStore.getState().activityByGroup[group._id] ?? [];
    setActivity(group._id, list.filter((e) => e._id !== existing._id));
    if (existing.addedToPersonal) bumpPersonalLedger();
    setConfirmDelete(false);
    Toast.success('Expense deleted');
    router.back();
  };


  return (
    <SafeAreaView className="flex-1 dark:bg-gray-900 bg-white" edges={['top']}>
      <View className="flex-row items-center px-5 pt-4 pb-2">
        <TouchableOpacity onPress={() => router.back()} className="mr-4" hitSlop={8}>
          <Feather name="x" size={24} color={isDark ? 'white' : '#111827'} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-xl font-bold dark:text-white text-gray-900">{isEdit ? 'Edit expense' : 'Add expense'}</Text>
          <Text className="dark:text-gray-400 text-gray-500 text-xs" numberOfLines={1}>{group.name}</Text>
        </View>
        {isEdit && (
          <TouchableOpacity onPress={() => setConfirmDelete(true)} hitSlop={8}>
            <Feather name="trash-2" size={20} color="#ef4444" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        className="flex-1 px-5"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: 8, paddingBottom: (keyboardHeight || 90 + insets.bottom) + 24 }}
      >
        {/* Amount + details */}
        <View className="flex-row items-center border-b border-gray-200 dark:border-gray-700 pb-2">
          <Text className="text-3xl font-bold dark:text-gray-300 text-gray-500 mr-2">{symbol}</Text>
          <TextInput
            className="flex-1 text-3xl font-bold dark:text-white text-gray-900"
            placeholder="0"
            placeholderTextColor="#9ca3af"
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={(v) => setAmount(cleanAmountInput(v))}
            maxLength={MAX_AMOUNT_INPUT_LENGTH}
            autoFocus={!isEdit}
          />
        </View>
        <TextInput
          className="dark:bg-gray-800 bg-gray-100 rounded-lg p-3 dark:text-white text-gray-900 text-base mt-4"
          placeholder="What was it for? e.g. Dinner at Fisherman's Wharf"
          placeholderTextColor="#9ca3af"
          value={details}
          onChangeText={setDetails}
          maxLength={MAX_DETAILS_LENGTH}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" className="mt-3">
          <View className="flex-row gap-2">
            {CATEGORIES.map((c) => (
              <TouchableOpacity key={c} onPress={() => setCategory(category === c ? '' : c)} className={chipClass(category === c)}>
                <Text className={chipTextClass(category === c)}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <TouchableOpacity
          onPress={() => setShowDatePicker(true)}
          className="flex-row items-center mt-4 dark:bg-gray-800 bg-gray-100 rounded-lg p-3"
        >
          <Feather name="calendar" size={18} color={isDark ? '#d1d5db' : '#4b5563'} />
          <Text className="ml-3 dark:text-gray-200 text-gray-700">{date.toDateString()}</Text>
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            value={date}
            mode="date"
            maximumDate={new Date()}
            onChange={(_e: DateTimePickerEvent, selected?: Date) => {
              setShowDatePicker(false);
              if (selected) setDate(selected);
            }}
          />
        )}

        {/* Paid by */}
        <Text className="dark:text-gray-300 text-gray-600 mt-6 mb-2 font-medium">Paid by</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View className="flex-row gap-2">
            {selectable.map((m) => (
              <TouchableOpacity key={m._id} onPress={() => setPaidBy(m._id)} className={chipClass(paidBy === m._id)}>
                <Text className={chipTextClass(paidBy === m._id)}>{memberName(group, m._id)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Split */}
        <Text className="dark:text-gray-300 text-gray-600 font-medium mt-6 mb-2">Split</Text>
        <View className="flex-row bg-gray-100 dark:bg-gray-800 rounded-full p-1 mb-2">
          {SPLIT_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.value}
              onPress={() => switchSplitType(option.value)}
              className={`flex-1 py-1.5 rounded-full ${splitType === option.value ? 'bg-white dark:bg-gray-700' : ''}`}
            >
              <Text className={`text-center ${splitType === option.value ? 'font-semibold text-indigo-600 dark:text-indigo-300' : 'text-gray-500 dark:text-gray-400'}`}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {selectable.map((m) => {
          if (splitType === 'equal') {
            const included = participants.has(m._id);
            return (
              <TouchableOpacity key={m._id} onPress={() => toggleParticipant(m._id)} activeOpacity={0.7} className="flex-row items-center py-2">
                <InitialsAvatar name={m.name} size={36} muted={m.status !== 'active'} />
                <Text className="flex-1 ml-3 dark:text-white text-gray-900">{memberName(group, m._id)}</Text>
                <Text className="dark:text-gray-400 text-gray-500 mr-3">
                  {included && amountValue > 0 ? formatMoney(equalPreview.get(m._id) ?? 0, symbol) : ''}
                </Text>
                <Feather name={included ? 'check-square' : 'square'} size={22} color={included ? '#6366f1' : '#9ca3af'} />
              </TouchableOpacity>
            );
          }
          if (isWeighted) {
            const share = weightedPreview.get(m._id);
            return (
              <View key={m._id} className="flex-row items-center py-2">
                <InitialsAvatar name={m.name} size={36} muted={m.status !== 'active'} />
                <View className="flex-1 ml-3">
                  <Text className="dark:text-white text-gray-900">{memberName(group, m._id)}</Text>
                  {share !== undefined && amountValue > 0 && (
                    <Text className="dark:text-gray-400 text-gray-500 text-xs">{formatMoney(share, symbol)}</Text>
                  )}
                </View>
                <View className="flex-row items-center dark:bg-gray-800 bg-gray-100 rounded-lg px-3 w-28">
                  <TextInput
                    className="flex-1 py-2 dark:text-white text-gray-900 text-right"
                    placeholder="0"
                    placeholderTextColor="#9ca3af"
                    keyboardType="decimal-pad"
                    value={weights[m._id] ?? ''}
                    onChangeText={(v) => setWeights((prev) => ({ ...prev, [m._id]: cleanAmountInput(v) }))}
                    maxLength={splitType === 'percent' ? 6 : 7}
                  />
                  <Text className="dark:text-gray-400 text-gray-500 ml-1">{splitType === 'percent' ? '%' : '×'}</Text>
                </View>
              </View>
            );
          }
          return (
            <View key={m._id} className="flex-row items-center py-2">
              <InitialsAvatar name={m.name} size={36} muted={m.status !== 'active'} />
              <Text className="flex-1 ml-3 dark:text-white text-gray-900">{memberName(group, m._id)}</Text>
              <View className="flex-row items-center dark:bg-gray-800 bg-gray-100 rounded-lg px-3 w-32">
                <Text className="dark:text-gray-400 text-gray-500">{symbol}</Text>
                <TextInput
                  className="flex-1 py-2 ml-1 dark:text-white text-gray-900 text-right"
                  placeholder="0"
                  placeholderTextColor="#9ca3af"
                  keyboardType="decimal-pad"
                  value={exactAmounts[m._id] ?? ''}
                  onChangeText={(v) => setExactAmounts((prev) => ({ ...prev, [m._id]: cleanAmountInput(v) }))}
                  maxLength={MAX_AMOUNT_INPUT_LENGTH}
                />
              </View>
            </View>
          );
        })}
        {splitType === 'exact' && amountValue > 0 && (
          <Text className={`text-right text-sm mt-1 ${remainingPaise === 0 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
            {remainingPaise === 0
              ? 'Adds up to the total'
              : remainingPaise > 0
                ? `${formatMoney(fromPaise(remainingPaise), symbol)} left to assign`
                : `${formatMoney(fromPaise(-remainingPaise), symbol)} over the total`}
          </Text>
        )}
        {splitType === 'percent' && (
          <Text className={`text-right text-sm mt-1 ${weightTotalHundredths === 10000 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
            {weightTotalHundredths === 10000
              ? 'Adds up to 100%'
              : weightTotalHundredths < 10000
                ? `${(10000 - weightTotalHundredths) / 100}% left to assign`
                : `${(weightTotalHundredths - 10000) / 100}% over 100%`}
          </Text>
        )}
        {splitType === 'shares' && (
          <Text className="text-right text-sm mt-1 dark:text-gray-400 text-gray-500">
            {weightTotalHundredths > 0
              ? `${weightTotalHundredths / 100} shares in total · e.g. 2 for a couple, 1 for one person`
              : 'Give each person a number of shares'}
          </Text>
        )}

        {/* Personal ledger link */}
        {iPaid ? (
          <View className="mt-6 rounded-xl p-4 dark:bg-gray-800 bg-gray-50 border dark:border-gray-700 border-gray-200">
            <View className="flex-row items-center">
              <View className="flex-1 pr-3">
                <Text className="dark:text-white text-gray-900 font-medium">Also add to my expenses</Text>
                <Text className="dark:text-gray-400 text-gray-500 text-xs mt-0.5 leading-4">
                  Records the full amount you paid from your account. Insights count only your share.
                </Text>
              </View>
              <Switch
                value={addToPersonal}
                onValueChange={setAddToPersonal}
                trackColor={{ false: '#9ca3af', true: '#818cf8' }}
                thumbColor={addToPersonal ? '#4f46e5' : '#f4f4f5'}
              />
            </View>
            {addToPersonal && accounts.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" className="mt-3">
                <View className="flex-row gap-2">
                  {accounts.map((a) => (
                    <TouchableOpacity key={a._id} onPress={() => setSourceId(a._id)} className={chipClass(sourceId === a._id)}>
                      <Text className={chipTextClass(sourceId === a._id)}>{a.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            )}
          </View>
        ) : (
          <Text className="dark:text-gray-500 text-gray-400 text-xs mt-6 leading-4">
            Someone else paid, so nothing is added to your personal expenses. What you owe shows in the group balance.
          </Text>
        )}

        <TouchableOpacity onPress={handleSave} disabled={saving} className="bg-indigo-600 p-4 rounded-xl mt-8">
          {saving ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-semibold text-center text-base">{isEdit ? 'Save changes' : 'Save expense'}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <ConfirmModal
        visible={confirmDelete}
        title="Delete this expense?"
        message={existing?.addedToPersonal
          ? 'It will be removed from the group and from your personal expenses. Balances update for everyone.'
          : 'It will be removed from the group. Balances update for everyone.'}
        confirmLabel="Delete"
        icon="trash-2"
        tone="danger"
        loading={saving}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
      />
    </SafeAreaView>
  );
}

// Local stand-in shown until the queued request reaches the server
const buildPendingExpense = (body: GroupExpenseInput, clientId: string, myMemberId: string): GroupExpense => {
  const splits = body.splitType === 'exact'
    ? (body.splits ?? []).map((s) => ({ memberId: s.memberId, amount: s.amount ?? 0 }))
    : body.splitType === 'equal'
      ? [...previewEqualSplit(body.amount, body.participantIds ?? []).entries()].map(([memberId, amount]) => ({ memberId, amount }))
      : [...previewWeightedSplit(body.amount, (body.splits ?? []).map((s) => ({ memberId: s.memberId, weight: s.weight ?? 0 }))).entries()]
        .map(([memberId, amount]) => ({ memberId, amount }));
  const now = new Date().toISOString();
  return {
    _id: `pending-${clientId}`,
    clientId,
    details: body.details,
    amount: body.amount,
    category: body.category,
    date: body.date,
    splitType: body.splitType,
    paidBy: [{ memberId: body.paidByMemberId, amount: body.amount }],
    splits,
    createdByMemberId: myMemberId,
    createdAt: now,
    updatedAt: now,
    canEdit: false,
    addedToPersonal: body.addToPersonal,
    myShare: splits.find((s) => s.memberId === myMemberId)?.amount ?? 0,
    myPaid: body.paidByMemberId === myMemberId ? body.amount : 0,
    pendingSync: true,
  };
};
