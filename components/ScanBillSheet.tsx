import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, Switch, Text, TextInput,
  TouchableOpacity, View, useColorScheme, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Toast } from 'toastify-react-native';
import { categoryFor, pickBillImage, readBillImage, type ScanSource } from '@/helper/scanBill';
import type { ParsedExpense, ScanAnalysis } from '@/helper/expenseParser';

type Props = {
  visible: boolean;
  onClose: () => void;
  // Called with what the user chose; the caller fills its form
  onScanned: (parsed: ParsedExpense, category?: string) => void;
  // An image to read straight away (shared from another app)
  imageUri?: string;
};

type Step = { name: 'choose' } | { name: 'reading' } | { name: 'review'; uri: string; analysis: ScanAnalysis };

const AMOUNTS_SHOWN = 4;

const formatAmount = (value: string) =>
  Number(value).toLocaleString('en-IN', { minimumFractionDigits: value.includes('.') ? 2 : 0, maximumFractionDigits: 2 });

const formatDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

// Photo or gallery (optionally cropped), read on the phone, then the user picks
// which amount and name to use before anything goes into the form.
export default function ScanBillSheet({ visible, onClose, onScanned, imageUri }: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const isDark = useColorScheme() === 'dark';
  const [step, setStep] = useState<Step>({ name: 'choose' });
  const [crop, setCrop] = useState(false);
  const [amount, setAmount] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [showAllAmounts, setShowAllAmounts] = useState(false);
  const [showText, setShowText] = useState(false);

  const iconColor = isDark ? '#d1d5db' : '#4b5563';

  const read = useCallback(async (uri: string) => {
    setStep({ name: 'reading' });
    const result = await readBillImage(uri);
    if (result.status === 'error') {
      Toast.error(result.message);
      setStep({ name: 'choose' });
      return;
    }
    const { analysis } = result;
    setAmount(analysis.amounts[0]?.value ?? null);
    setDetails(analysis.details[0] ?? '');
    setShowAllAmounts(false);
    setShowText(false);
    setStep({ name: 'review', uri, analysis });
  }, []);

  // Start over each time the sheet opens; a shared image is read right away
  useEffect(() => {
    if (!visible) return;
    if (imageUri) read(imageUri);
    else setStep({ name: 'choose' });
  }, [visible, imageUri, read]);

  const start = async (source: ScanSource) => {
    const picked = await pickBillImage(source, crop);
    if (picked.status === 'error') Toast.error(picked.message);
    if (picked.status === 'ok') read(picked.uri);
  };

  const use = () => {
    if (step.name !== 'review') return;
    const { analysis } = step;
    const parsed: ParsedExpense = {
      kind: analysis.kind,
      amount: amount ?? undefined,
      // The user picked it, so it's what they want, unless they skipped it
      amountConfidence: amount ? 'high' : undefined,
      details: details.trim() || undefined,
      date: analysis.date,
      incoming: analysis.incoming,
    };
    onClose();
    onScanned(parsed, categoryFor(parsed));
  };

  const close = () => step.name !== 'reading' && onClose();

  const option = (source: ScanSource, icon: 'camera' | 'image', label: string, hint: string) => (
    <TouchableOpacity onPress={() => start(source)} className="flex-row items-center py-3">
      <View className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 items-center justify-center">
        <Feather name={icon} size={18} color={iconColor} />
      </View>
      <View className="ml-3 flex-1">
        <Text className="dark:text-white text-gray-900 font-medium">{label}</Text>
        <Text className="dark:text-gray-400 text-gray-500 text-xs">{hint}</Text>
      </View>
    </TouchableOpacity>
  );

  const sectionTitle = (title: string) => (
    <Text className="dark:text-gray-400 text-gray-500 text-xs font-semibold uppercase mt-5 mb-2">{title}</Text>
  );

  const renderChoose = () => (
    <>
      {option('camera', 'camera', 'Take a photo', 'Bill, receipt or invoice, flat and in good light')}
      {option('library', 'image', 'Choose from gallery', 'A photo or a UPI payment screenshot')}
      <View className="flex-row items-center mt-2 py-2">
        <View className="flex-1 pr-3">
          <Text className="dark:text-white text-gray-900">Crop before reading</Text>
          <Text className="dark:text-gray-400 text-gray-500 text-xs">Useful when the photo has other text around the bill</Text>
        </View>
        <Switch value={crop} onValueChange={setCrop} />
      </View>
      <Text className="dark:text-gray-500 text-gray-400 text-xs mt-3 leading-4">
        The image is read on your phone and isn&apos;t uploaded. You choose what goes into the form.
      </Text>
    </>
  );

  const renderReview = (uri: string, analysis: ScanAnalysis) => {
    const amounts = showAllAmounts ? analysis.amounts : analysis.amounts.slice(0, AMOUNTS_SHOWN);
    const hidden = analysis.amounts.length - amounts.length;
    return (
      <>
        <Image source={{ uri }} resizeMode="contain" className="w-full h-32 rounded-lg bg-gray-100 dark:bg-gray-800" />

        {sectionTitle('Amount')}
        {analysis.amounts.length === 0 && (
          <Text className="dark:text-gray-400 text-gray-500 text-sm">No amounts found. You can enter it in the form.</Text>
        )}
        {amounts.map((option) => {
          const selected = amount === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              onPress={() => setAmount(option.value)}
              className={`flex-row items-center rounded-lg border px-3 py-2.5 mb-2 ${
                selected ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950' : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <Feather name={selected ? 'check-circle' : 'circle'} size={16} color={selected ? '#6366f1' : iconColor} />
              <View className="flex-1 ml-3">
                <Text className="dark:text-white text-gray-900 font-semibold">{formatAmount(option.value)}</Text>
                <Text numberOfLines={1} className="dark:text-gray-400 text-gray-500 text-xs">
                  {option.isTotal ? 'Total · ' : ''}{option.row}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
        {hidden > 0 && (
          <TouchableOpacity onPress={() => setShowAllAmounts(true)} className="py-1">
            <Text className="text-indigo-500 text-sm">Show {hidden} more</Text>
          </TouchableOpacity>
        )}
        {analysis.amounts.length > 0 && (
          <TouchableOpacity onPress={() => setAmount(null)} className="flex-row items-center py-2">
            <Feather name={amount === null ? 'check-circle' : 'circle'} size={16} color={amount === null ? '#6366f1' : iconColor} />
            <Text className="dark:text-gray-300 text-gray-700 text-sm ml-3">None of these, I&apos;ll type it</Text>
          </TouchableOpacity>
        )}

        {sectionTitle('Details')}
        {analysis.details.length > 0 && (
          <View className="flex-row flex-wrap mb-2">
            {analysis.details.map((name) => (
              <TouchableOpacity
                key={name}
                onPress={() => setDetails(name)}
                className={`rounded-full border px-3 py-1 mr-2 mb-2 ${
                  details === name ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950' : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <Text className="dark:text-gray-200 text-gray-700 text-sm">{name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        <TextInput
          value={details}
          onChangeText={setDetails}
          placeholder="Shop or what it was for"
          placeholderTextColor="#9ca3af"
          maxLength={60}
          className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2.5 dark:text-white text-gray-900"
        />

        {analysis.date && (
          <Text className="dark:text-gray-400 text-gray-500 text-sm mt-4">Date on the bill: {formatDate(analysis.date)}</Text>
        )}

        <TouchableOpacity onPress={() => setShowText((v) => !v)} className="flex-row items-center mt-5 py-1">
          <Text className="dark:text-gray-300 text-gray-700 text-sm flex-1">All text we read ({analysis.rows.length} lines)</Text>
          <Feather name={showText ? 'chevron-up' : 'chevron-down'} size={16} color={iconColor} />
        </TouchableOpacity>
        {showText && (
          <View className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3 mt-2">
            {analysis.rows.map((row, i) => (
              <Text key={i} selectable className="dark:text-gray-300 text-gray-600 text-xs leading-5">{row}</Text>
            ))}
          </View>
        )}
      </>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-end bg-black/50">
        <View className="dark:bg-gray-900 bg-white rounded-t-2xl" style={{ maxHeight: height * 0.9, paddingBottom: insets.bottom + 16 }}>
          <View className="flex-row items-center px-6 pt-6 pb-2">
            <Text className="text-xl font-bold dark:text-white text-gray-900 flex-1">
              {step.name === 'review' ? 'Check what we read' : 'Scan a bill'}
            </Text>
            {step.name !== 'reading' && (
              <TouchableOpacity onPress={onClose} hitSlop={10}>
                <Feather name="x" size={22} color={iconColor} />
              </TouchableOpacity>
            )}
          </View>

          {step.name === 'reading' && (
            <View className="items-center py-10">
              <ActivityIndicator size="large" color="#6366f1" />
              <Text className="dark:text-gray-300 text-gray-600 mt-3">Reading the bill…</Text>
            </View>
          )}
          {step.name === 'choose' && <View className="px-6">{renderChoose()}</View>}
          {step.name === 'review' && (
            <>
              <ScrollView className="px-6" keyboardShouldPersistTaps="handled">
                {renderReview(step.uri, step.analysis)}
              </ScrollView>
              <View className="flex-row px-6 pt-4">
                <TouchableOpacity
                  onPress={() => setStep({ name: 'choose' })}
                  className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 py-3 items-center mr-3"
                >
                  <Text className="dark:text-gray-200 text-gray-700 font-medium">Scan again</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={use} className="flex-1 rounded-lg bg-indigo-500 py-3 items-center">
                  <Text className="text-white font-medium">Use these</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
