import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, ScrollView, Switch, Text, TextInput, TouchableOpacity, View, useColorScheme,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Toast } from 'toastify-react-native';
import { useGroupStore } from '@/store/groupStore';
import { useAccountStore } from '@/store/accountStore';
import { fetchAccountsApi } from '@/api/accountApi';
import { addSettlementApi } from '@/api/groupApi';
import { MAX_AMOUNT, MAX_AMOUNT_INPUT_LENGTH } from '@/helper/expenseLimits';
import {
  chipClass, chipTextClass, cleanAmountInput, formatMoney, fromPaise, memberName, PAYMENT_METHODS, toPaise,
} from '@/helper/groupFormat';
import { createLocalId } from '@/helper/localId';
import { useKeyboardHeight } from '@/helper/useKeyboardHeight';
import type { GroupMember, PaymentMethod } from '@/types/group';

const MAX_NOTE_LENGTH = 100;



type Rounding = 'none' | 'up' | 'down';

export default function RecordPaymentScreen() {
  const params = useLocalSearchParams<{ groupId: string; from?: string; to?: string; amount?: string; source?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';
  const keyboardHeight = useKeyboardHeight();

  const group = useGroupStore((state) => state.groups.find((g) => g._id === params.groupId));
  const upsertGroup = useGroupStore((state) => state.upsertGroup);
  const setActivity = useGroupStore((state) => state.setActivity);
  const bumpPersonalLedger = useGroupStore((state) => state.bumpPersonalLedger);
  const { accounts, setAccounts, getDefaultAccount } = useAccountStore();

  const me = group?.myMemberId ?? '';
  const netByMember = useMemo(
    () => new Map((group?.balances ?? []).map((b) => [b.memberId, toPaise(b.net)])),
    [group]
  );
  // Members still in the group, plus anyone who left with a balance
  const selectable: GroupMember[] = useMemo(
    () => (group?.members ?? []).filter((m) => m.status !== 'left' || (netByMember.get(m._id) ?? 0) !== 0),
    [group, netByMember]
  );

  const suggested = useMemo(
    () => (params.from && params.to && params.amount
      ? { from: params.from, to: params.to, paise: toPaise(Number(params.amount)) }
      : null),
    [params.from, params.to, params.amount]
  );

  // Default for a blank form: you pay whoever you owe the most, or the reverse
  const defaultPair = () => {
    if (suggested) return { from: suggested.from, to: suggested.to };
    const myNet = netByMember.get(me) ?? 0;
    const others = selectable.filter((m) => m._id !== me);
    if (myNet < 0) {
      const top = [...others].sort((a, b) => (netByMember.get(b._id) ?? 0) - (netByMember.get(a._id) ?? 0))[0];
      return { from: me, to: top?._id ?? '' };
    }
    if (myNet > 0) {
      const top = [...others].sort((a, b) => (netByMember.get(a._id) ?? 0) - (netByMember.get(b._id) ?? 0))[0];
      return { from: top?._id ?? '', to: me };
    }
    return { from: me, to: others[0]?._id ?? '' };
  };

  const [{ from, to }, setPair] = useState(defaultPair);
  // What this payment would clear: the suggested amount, or the most it can
  // settle between these two without anyone ending up owed more
  const targetPaise = useMemo(() => {
    if (suggested && suggested.from === from && suggested.to === to) return suggested.paise;
    const fromOwes = -(netByMember.get(from) ?? 0);
    const toIsOwed = netByMember.get(to) ?? 0;
    const most = Math.min(fromOwes, toIsOwed);
    return most > 0 ? most : null;
  }, [suggested, from, to, netByMember]);

  const [amount, setAmount] = useState(() => (targetPaise ? String(fromPaise(targetPaise)) : ''));
  const [rounding, setRounding] = useState<Rounding>('none');
  const [method, setMethod] = useState<PaymentMethod>('upi');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [addToPersonal, setAddToPersonal] = useState(true);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const clientId = useRef(createLocalId()).current;

  useEffect(() => {
    if (accounts.length === 0) fetchAccountsApi().then((list) => list.length && setAccounts(list));
  }, [accounts.length, setAccounts]);
  useEffect(() => {
    if (!sourceId && accounts.length > 0) setSourceId(getDefaultAccount()?._id ?? accounts[0]._id);
  }, [accounts, sourceId, getDefaultAccount]);

  if (!group) {
    return (
      <SafeAreaView className="flex-1 dark:bg-gray-900 bg-white items-center justify-center">
        <TouchableOpacity onPress={() => router.back()} className="bg-indigo-600 px-6 py-3 rounded-xl">
          <Text className="text-white font-semibold">Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const symbol = group.currencySymbol;
  const amountPaise = toPaise(parseFloat(amount) || 0);
  const iPay = from === me;
  const iReceive = to === me;
  // Rounding only closes a debt, so it must not clear more than either person's overall balance
  const withinBalances = targetPaise !== null
    && targetPaise <= Math.min(-(netByMember.get(from) ?? 0), netByMember.get(to) ?? 0);
  const hasPaise = targetPaise !== null && targetPaise % 100 !== 0 && withinBalances;
  const roundedUp = targetPaise !== null ? Math.ceil(targetPaise / 100) * 100 : 0;
  const roundedDown = targetPaise !== null ? Math.floor(targetPaise / 100) * 100 : 0;
  const canRoundUp = hasPaise && iPay;
  // Rounding down to zero would mean nothing was paid
  const canRoundDown = hasPaise && iReceive && roundedDown > 0;

  const choosePair = (next: { from: string; to: string }) => {
    setPair(next);
    setRounding('none');
    // Prefill with what these two can settle
    const fromOwes = -(netByMember.get(next.from) ?? 0);
    const toIsOwed = netByMember.get(next.to) ?? 0;
    const most = suggested && suggested.from === next.from && suggested.to === next.to
      ? suggested.paise
      : Math.min(fromOwes, toIsOwed);
    setAmount(most > 0 ? String(fromPaise(most)) : '');
  };

  const applyRounding = (kind: Rounding) => {
    if (targetPaise === null) return;
    if (rounding === kind) {
      setRounding('none');
      setAmount(String(fromPaise(targetPaise)));
      return;
    }
    setRounding(kind);
    setAmount(String(fromPaise(kind === 'up' ? roundedUp : roundedDown)));
  };

  const summary = (() => {
    if (!amountPaise || targetPaise === null) return null;
    if (rounding !== 'none') {
      const diff = formatMoney(fromPaise(Math.abs(amountPaise - targetPaise)), symbol);
      return {
        tone: 'good',
        text: rounding === 'up'
          ? `Settles fully · ${diff} rounded off by ${iPay ? 'you' : memberName(group, from)}`
          : `Settles fully · ${iReceive ? 'you let go of' : `${memberName(group, to)} lets go of`} ${diff}`,
      };
    }
    if (amountPaise === targetPaise) return { tone: 'good', text: 'Settles this fully' };
    if (amountPaise < targetPaise) {
      return { tone: 'info', text: `${formatMoney(fromPaise(targetPaise - amountPaise), symbol)} will still be left to settle` };
    }
    return {
      tone: 'warn',
      text: `That's ${formatMoney(fromPaise(amountPaise - targetPaise), symbol)} more than what's owed, so ${memberName(group, to)} will then owe ${memberName(group, from) === 'You' ? 'you' : memberName(group, from)} that much`,
    };
  })();

  const handleSave = async () => {
    if (!from || !to || from === to) return Toast.error('Choose who paid and who received');
    if (amountPaise <= 0) return Toast.error('Enter the amount paid');
    if (fromPaise(amountPaise) > MAX_AMOUNT) return Toast.error(`Amount cannot be more than ${MAX_AMOUNT.toLocaleString('en-IN')}`);

    setSaving(true);
    const result = await addSettlementApi(group._id, {
      fromMemberId: from,
      toMemberId: to,
      amount: fromPaise(amountPaise),
      settledAmount: rounding !== 'none' && targetPaise !== null ? fromPaise(targetPaise) : undefined,
      method,
      note: note.trim() || undefined,
      date: date.toISOString(),
      source: params.source === 'smart' && suggested?.from === from && suggested?.to === to ? 'smart' : 'manual',
      addToPersonal: (iPay || iReceive) && addToPersonal,
      sourceId,
      clientId,
    });
    setSaving(false);
    if (!result.ok) return Toast.error(result.message);

    upsertGroup(result.data.group);
    const list = useGroupStore.getState().activityByGroup[group._id] ?? [];
    setActivity(group._id, [result.data.settlement, ...list.filter((a) => a._id !== result.data.settlement._id)]);
    if (result.data.settlement.addedToPersonal) bumpPersonalLedger();
    Toast.success('Payment recorded');
    router.back();
  };

  const summaryColor: Record<string, string> = {
    good: 'text-green-600 dark:text-green-400',
    info: 'dark:text-gray-400 text-gray-500',
    warn: 'text-amber-600 dark:text-amber-400',
  };

  const memberChips = (selected: string, onPick: (id: string) => void, exclude: string) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View className="flex-row gap-2">
        {selectable.filter((m) => m._id !== exclude).map((m) => (
          <TouchableOpacity key={m._id} onPress={() => onPick(m._id)} className={chipClass(selected === m._id)}>
            <Text className={chipTextClass(selected === m._id)}>{m.isYou ? 'You' : m.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView className="flex-1 dark:bg-gray-900 bg-white" edges={['top']}>
      <View className="flex-row items-center px-5 pt-4 pb-2">
        <TouchableOpacity onPress={() => router.back()} className="mr-4" hitSlop={8}>
          <Feather name="x" size={24} color={isDark ? 'white' : '#111827'} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-xl font-bold dark:text-white text-gray-900">Record payment</Text>
          <Text className="dark:text-gray-400 text-gray-500 text-xs" numberOfLines={1}>{group.name}</Text>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-5"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: 8, paddingBottom: (keyboardHeight || 90 + insets.bottom) + 24 }}
      >
        <Text className="dark:text-gray-300 text-gray-600 mb-2 font-medium">Who paid</Text>
        {memberChips(from, (id) => choosePair({ from: id, to: id === to ? from : to }), '')}
        <Text className="dark:text-gray-300 text-gray-600 mt-4 mb-2 font-medium">Paid to</Text>
        {memberChips(to, (id) => choosePair({ from, to: id }), from)}

        <View className="flex-row items-center border-b border-gray-200 dark:border-gray-700 pb-2 mt-6">
          <Text className="text-3xl font-bold dark:text-gray-300 text-gray-500 mr-2">{symbol}</Text>
          <TextInput
            className="flex-1 text-3xl font-bold dark:text-white text-gray-900"
            placeholder="0"
            placeholderTextColor="#9ca3af"
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={(v) => {
              setAmount(cleanAmountInput(v));
              setRounding('none');
            }}
            maxLength={MAX_AMOUNT_INPUT_LENGTH}
          />
        </View>
        {targetPaise !== null && (
          <Text className="dark:text-gray-400 text-gray-500 text-xs mt-2">
            {memberName(group, from)} {memberName(group, from) === 'You' ? 'owe' : 'owes'} {formatMoney(fromPaise(targetPaise), symbol)} here
          </Text>
        )}

        {(canRoundUp || canRoundDown) && (
          <View className="flex-row mt-3">
            {canRoundUp && (
              <TouchableOpacity onPress={() => applyRounding('up')} className={`flex-row items-center ${chipClass(rounding === 'up')}`}>
                <Feather name="arrow-up-circle" size={14} color={rounding === 'up' ? 'white' : '#6366f1'} />
                <Text className={`ml-1.5 ${chipTextClass(rounding === 'up')}`}>Round up to {formatMoney(fromPaise(roundedUp), symbol)}</Text>
              </TouchableOpacity>
            )}
            {canRoundDown && (
              <TouchableOpacity onPress={() => applyRounding('down')} className={`flex-row items-center ${chipClass(rounding === 'down')}`}>
                <Feather name="arrow-down-circle" size={14} color={rounding === 'down' ? 'white' : '#6366f1'} />
                <Text className={`ml-1.5 ${chipTextClass(rounding === 'down')}`}>Accept {formatMoney(fromPaise(roundedDown), symbol)} as full</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        {hasPaise && !iPay && !iReceive && (
          <Text className="dark:text-gray-500 text-gray-400 text-xs mt-2">
            Only {memberName(group, from)} or {memberName(group, to)} can round this off.
          </Text>
        )}
        {summary && <Text className={`text-sm mt-3 ${summaryColor[summary.tone]}`}>{summary.text}</Text>}

        <Text className="dark:text-gray-300 text-gray-600 mt-6 mb-2 font-medium">Paid with</Text>
        <View className="flex-row flex-wrap gap-2">
          {PAYMENT_METHODS.map((m) => (
            <TouchableOpacity key={m.value} onPress={() => setMethod(m.value)} className={chipClass(method === m.value)}>
              <Text className={chipTextClass(method === m.value)}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

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
        <TextInput
          className="dark:bg-gray-800 bg-gray-100 rounded-lg p-3 dark:text-white text-gray-900 text-base mt-3"
          placeholder="Note (optional)"
          placeholderTextColor="#9ca3af"
          value={note}
          onChangeText={setNote}
          maxLength={MAX_NOTE_LENGTH}
        />

        {(iPay || iReceive) && (
          <View className="mt-6 rounded-2xl p-4 dark:bg-gray-800 bg-gray-50 border dark:border-gray-700 border-gray-200">
            <View className="flex-row items-center">
              <View className="flex-1 pr-3">
                <Text className="dark:text-white text-gray-900 font-medium">Also add to my expenses</Text>
                <Text className="dark:text-gray-400 text-gray-500 text-xs mt-0.5 leading-4">
                  {iPay ? 'Records the money leaving your account' : 'Records the money coming into your account'} as a settlement. It isn&apos;t counted as spending or income.
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
        )}

        <TouchableOpacity onPress={handleSave} disabled={saving} className="bg-indigo-600 p-4 rounded-xl mt-8">
          {saving ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-semibold text-center text-base">
              Record {amountPaise > 0 ? formatMoney(fromPaise(amountPaise), symbol) : 'payment'}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
