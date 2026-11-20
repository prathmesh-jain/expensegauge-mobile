import React, { useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View, useColorScheme } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Toast } from 'toastify-react-native';
import { CURRENCY_OPTIONS, useCurrencySymbol } from '@/store/currencyStore';
import { useAuthStore } from '@/store/authStore';
import { askAboutGroupNotifications } from '@/helper/pushService';
import { useGroupStore } from '@/store/groupStore';
import { createGroupApi, lookupEmailApi } from '@/api/groupApi';
import { cleanName, looksLikeEmail, MAX_GROUP_MEMBERS, MAX_GROUP_NAME_LENGTH } from '@/helper/groupLimits';
import { useKeyboardHeight } from '@/helper/useKeyboardHeight';
import { createLocalId } from '@/helper/localId';
import InitialsAvatar from '@/components/InitialsAvatar';


export default function NewGroupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';
  const keyboardHeight = useKeyboardHeight();
  const myName = useAuthStore((state) => state.name) || 'You';
  const defaultSymbol = useCurrencySymbol();
  const upsertGroup = useGroupStore((state) => state.upsertGroup);

  const [name, setName] = useState('');
  const [currencySymbol, setCurrencySymbol] = useState(defaultSymbol);
  const [memberInput, setMemberInput] = useState('');
  const [memberNames, setMemberNames] = useState<string[]>([]);
  // People found by email; they get an invitation to accept
  const [invitees, setInvitees] = useState<{ email: string; name: string; maskedEmail: string }[]>([]);
  const [lookingUp, setLookingUp] = useState(false);
  const [notFoundEmail, setNotFoundEmail] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Same id for retries of this form, so a slow network can't create two groups
  const clientId = useRef(createLocalId()).current;
  const memberInputRef = useRef<TextInput>(null);

  const symbols = CURRENCY_OPTIONS.some((o) => o.symbol === defaultSymbol)
    ? CURRENCY_OPTIONS
    : [{ symbol: defaultSymbol, label: '' }, ...CURRENCY_OPTIONS];

  const addByEmail = async (email: string) => {
    const key = email.toLowerCase();
    if (invitees.some((i) => i.email === key)) {
      Toast.error('Already added');
      return;
    }
    setLookingUp(true);
    const result = await lookupEmailApi(key);
    setLookingUp(false);
    if (!result.ok) {
      if (result.status === 404) setNotFoundEmail(key);
      else Toast.error(result.message);
      return;
    }
    if (result.data.isYou) {
      Toast.error("That's your own email");
      return;
    }
    setInvitees((prev) => [...prev, { email: key, name: result.data.name, maskedEmail: result.data.maskedEmail }]);
    setMemberInput('');
    memberInputRef.current?.focus();
  };

  const addMemberName = () => {
    setNotFoundEmail(null);
    if (memberNames.length + invitees.length + 1 >= MAX_GROUP_MEMBERS) {
      Toast.error(`A group can have at most ${MAX_GROUP_MEMBERS} members`);
      return;
    }
    if (looksLikeEmail(memberInput)) {
      addByEmail(memberInput.trim());
      return;
    }
    const member = cleanName(memberInput);
    if (!member) return;
    const key = member.toLowerCase();
    if (key === myName.trim().toLowerCase() || memberNames.some((m) => m.toLowerCase() === key)) {
      Toast.error(`${member} is already in the list`);
      return;
    }
    setMemberNames((prev) => [...prev, member]);
    setMemberInput('');
    memberInputRef.current?.focus();
  };

  const handleCreate = async () => {
    const groupName = cleanName(name);
    if (!groupName) {
      Toast.error('Give your group a name');
      return;
    }
    if (looksLikeEmail(memberInput)) {
      Toast.error('Tap Add to look up that email first');
      return;
    }
    // A typed name that wasn't added yet is almost always meant to be included
    const pendingMember = cleanName(memberInput);
    const allMembers = pendingMember && !memberNames.some((m) => m.toLowerCase() === pendingMember.toLowerCase())
      ? [...memberNames, pendingMember]
      : memberNames;

    setSaving(true);
    const result = await createGroupApi({
      name: groupName,
      currencySymbol,
      memberNames: allMembers,
      memberEmails: invitees.map((i) => i.email),
      clientId,
    });
    setSaving(false);
    if (!result.ok) {
      Toast.error(result.message);
      return;
    }
    upsertGroup(result.data);
    router.replace({ pathname: '/(tabs)/groups/[id]', params: { id: result.data._id, created: '1' } });
    askAboutGroupNotifications(result.data);
  };

  return (
    <SafeAreaView className="flex-1 dark:bg-gray-900 bg-white" edges={['top']}>
      <View className="flex-row items-center px-5 pt-4 pb-2">
        <TouchableOpacity onPress={() => router.back()} className="mr-4" hitSlop={8}>
          <Feather name="arrow-left" size={22} color={isDark ? 'white' : '#111827'} />
        </TouchableOpacity>
        <Text className="text-xl font-bold dark:text-white text-gray-900 flex-1">New group</Text>
      </View>

      <ScrollView
        className="flex-1 px-5"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: 12, paddingBottom: (keyboardHeight || 90 + insets.bottom) + 24 }}
      >
        <Text className="dark:text-gray-300 text-gray-600 mb-1">Group name</Text>
        <TextInput
          className="dark:bg-gray-800 bg-gray-100 rounded-lg p-3 dark:text-white text-gray-900 text-base"
          placeholder="e.g. Goa trip, Flat 302"
          placeholderTextColor="#9ca3af"
          value={name}
          onChangeText={setName}
          maxLength={MAX_GROUP_NAME_LENGTH}
          autoFocus
          returnKeyType="next"
          onSubmitEditing={() => memberInputRef.current?.focus()}
        />

        <Text className="dark:text-gray-300 text-gray-600 mt-5 mb-2">Currency</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View className="flex-row gap-2">
            {symbols.map((option) => (
              <TouchableOpacity
                key={option.symbol}
                onPress={() => setCurrencySymbol(option.symbol)}
                className={`px-4 py-2 rounded-full border ${currencySymbol === option.symbol
                  ? 'bg-indigo-600 border-indigo-600'
                  : 'bg-transparent border-gray-400 dark:border-gray-600'}`}
              >
                <Text className={currencySymbol === option.symbol ? 'text-white font-bold' : 'dark:text-gray-300 text-gray-700'}>
                  {option.symbol}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
        <Text className="dark:text-gray-500 text-gray-400 text-xs mt-2">
          Everyone in the group sees amounts in this currency.
        </Text>

        <Text className="dark:text-gray-300 text-gray-600 mt-6 mb-2">Who&apos;s in it?</Text>
        <View className="flex-row items-center py-2">
          <InitialsAvatar name={myName} size={36} />
          <Text className="ml-3 flex-1 dark:text-white text-gray-900 font-medium">{myName} (you)</Text>
        </View>
        {memberNames.map((member) => (
          <View key={member} className="flex-row items-center py-2">
            <InitialsAvatar name={member} size={36} />
            <Text className="ml-3 flex-1 dark:text-white text-gray-900">{member}</Text>
            <TouchableOpacity
              onPress={() => setMemberNames((prev) => prev.filter((m) => m !== member))}
              hitSlop={10}
            >
              <Feather name="x" size={18} color="#9ca3af" />
            </TouchableOpacity>
          </View>
        ))}

        {invitees.map((invitee) => (
          <View key={invitee.email} className="flex-row items-center py-2">
            <InitialsAvatar name={invitee.name} size={36} />
            <View className="ml-3 flex-1">
              <Text className="dark:text-white text-gray-900">{invitee.name}</Text>
              <Text className="dark:text-gray-400 text-gray-500 text-xs">{invitee.maskedEmail} · will get an invitation</Text>
            </View>
            <TouchableOpacity
              onPress={() => setInvitees((prev) => prev.filter((i) => i.email !== invitee.email))}
              hitSlop={10}
            >
              <Feather name="x" size={18} color="#9ca3af" />
            </TouchableOpacity>
          </View>
        ))}

        <View className="flex-row items-center mt-2">
          <TextInput
            ref={memberInputRef}
            className="flex-1 dark:bg-gray-800 bg-gray-100 rounded-lg p-3 dark:text-white text-gray-900 text-base"
            placeholder="Friend's name or email"
            placeholderTextColor="#9ca3af"
            value={memberInput}
            onChangeText={(v) => {
              setMemberInput(v);
              setNotFoundEmail(null);
            }}
            maxLength={254}
            autoCorrect={false}
            returnKeyType="done"
            blurOnSubmit={false}
            onSubmitEditing={addMemberName}
          />
          <TouchableOpacity
            onPress={addMemberName}
            disabled={!cleanName(memberInput) || lookingUp}
            className={`ml-2 px-4 py-3 rounded-lg ${cleanName(memberInput) ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-700'}`}
          >
            {lookingUp ? <ActivityIndicator size="small" color="white" /> : <Text className="text-white font-semibold">Add</Text>}
          </TouchableOpacity>
        </View>
        {notFoundEmail ? (
          <View className="mt-2 rounded-lg p-3 dark:bg-gray-800 bg-gray-50">
            <Text className="dark:text-gray-300 text-gray-600 text-xs leading-4">
              No ExpenseGauge account uses {notFoundEmail}. Type their name instead, then share the invite link once the group is created.
            </Text>
          </View>
        ) : (
          <Text className="dark:text-gray-500 text-gray-400 text-xs mt-2 leading-4">
            Know their ExpenseGauge email? Enter it and they&apos;ll get an invitation in the app. Otherwise add them by name and share the invite link after creating the group.
          </Text>
        )}

        <TouchableOpacity
          onPress={handleCreate}
          disabled={saving}
          className="bg-indigo-600 p-4 rounded-xl mt-8"
        >
          {saving ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-semibold text-center text-base">Create group</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
