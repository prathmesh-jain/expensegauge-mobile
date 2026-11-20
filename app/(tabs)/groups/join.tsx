import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View, useColorScheme } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Toast } from 'toastify-react-native';
import { joinGroupApi, previewInviteApi } from '@/api/groupApi';
import { parseInviteCode } from '@/helper/groupLimits';
import { useKeyboardHeight } from '@/helper/useKeyboardHeight';
import { askAboutGroupNotifications } from '@/helper/pushService';
import { useGroupStore } from '@/store/groupStore';
import InitialsAvatar from '@/components/InitialsAvatar';
import type { InvitePreview } from '@/types/group';

const NEW_MEMBER = 'new';

export default function JoinGroupScreen() {
  const params = useLocalSearchParams<{ code?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';
  const keyboardHeight = useKeyboardHeight();
  const upsertGroup = useGroupStore((state) => state.upsertGroup);

  const [codeInput, setCodeInput] = useState('');
  const [code, setCode] = useState<string | null>(params.code ? parseInviteCode(params.code) : null);
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [choice, setChoice] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const loadPreview = useCallback(async (inviteCode: string) => {
    setLoading(true);
    setError(null);
    const result = await previewInviteApi(inviteCode);
    setLoading(false);
    if (!result.ok) {
      setPreview(null);
      setError(result.message);
      return;
    }
    setPreview(result.data);
    // Nothing to claim means there's only one way to join
    setChoice(result.data.claimable.length === 0 ? NEW_MEMBER : null);
  }, []);

  // A new link can arrive while this screen is open
  useEffect(() => {
    if (params.code) setCode(parseInviteCode(params.code));
  }, [params.code]);

  useEffect(() => {
    if (code) loadPreview(code);
  }, [code, loadPreview]);

  const submitCode = () => {
    const parsed = parseInviteCode(codeInput);
    if (!parsed) {
      Toast.error('Enter the invite code or paste the invite link');
      return;
    }
    setCode(parsed);
  };

  const openGroup = (groupId: string) =>
    router.replace({ pathname: '/(tabs)/groups/[id]', params: { id: groupId } });

  const handleJoin = async () => {
    if (!code || !preview || !choice) return;
    setJoining(true);
    const result = await joinGroupApi(code, choice === NEW_MEMBER ? undefined : choice);
    setJoining(false);
    if (!result.ok) {
      Toast.error(result.message);
      // Someone else may have claimed that name meanwhile
      if (result.status === 409) loadPreview(code);
      return;
    }
    upsertGroup(result.data);
    Toast.success(`You joined ${result.data.name}`);
    askAboutGroupNotifications(result.data);
    openGroup(result.data._id);
  };

  const resetCode = () => {
    setCode(null);
    setPreview(null);
    setError(null);
    setCodeInput('');
  };

  const renderCodeEntry = () => (
    <>
      <Text className="dark:text-gray-300 text-gray-600 mb-1">Invite code or link</Text>
      <TextInput
        className="dark:bg-gray-800 bg-gray-100 rounded-lg p-3 dark:text-white text-gray-900 text-base"
        placeholder="e.g. K7M2QX9P"
        placeholderTextColor="#9ca3af"
        value={codeInput}
        onChangeText={setCodeInput}
        autoCapitalize="characters"
        autoCorrect={false}
        autoFocus
        returnKeyType="go"
        onSubmitEditing={submitCode}
      />
      <Text className="dark:text-gray-500 text-gray-400 text-xs mt-2">
        Ask a group member to share the invite from their group screen.
      </Text>
      <TouchableOpacity onPress={submitCode} className="bg-indigo-600 p-4 rounded-xl mt-6">
        <Text className="text-white font-semibold text-center text-base">Continue</Text>
      </TouchableOpacity>
    </>
  );

  const renderPreview = (invite: InvitePreview) => {
    if (invite.alreadyMember) {
      return (
        <View className="items-center pt-6">
          <InitialsAvatar name={invite.groupName} size={64} />
          <Text className="text-xl font-bold dark:text-white text-gray-900 mt-4 text-center">{invite.groupName}</Text>
          <Text className="dark:text-gray-400 text-gray-500 mt-2 text-center">You&apos;re already in this group.</Text>
          <TouchableOpacity onPress={() => openGroup(invite.groupId)} className="bg-indigo-600 p-4 rounded-xl mt-6 w-full">
            <Text className="text-white font-semibold text-center text-base">Open group</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <>
        <View className="items-center pt-2">
          <InitialsAvatar name={invite.groupName} size={64} />
          <Text className="text-xl font-bold dark:text-white text-gray-900 mt-4 text-center">{invite.groupName}</Text>
          <Text className="dark:text-gray-400 text-gray-500 mt-1 text-center">
            {invite.invitedBy ? `${invite.invitedBy} invited you` : "You've been invited"}
            {` · ${invite.members.length + invite.claimable.length} members`}
          </Text>
        </View>

        {invite.members.length > 0 && (
          <View className="flex-row flex-wrap justify-center mt-4 gap-2">
            {invite.members.slice(0, 8).map((m) => (
              <View key={m._id} className="flex-row items-center bg-gray-100 dark:bg-gray-800 rounded-full pl-1 pr-3 py-1">
                <InitialsAvatar name={m.name} size={22} />
                <Text className="dark:text-gray-200 text-gray-700 text-xs ml-1.5">{m.name.split(' ')[0]}</Text>
              </View>
            ))}
          </View>
        )}

        {invite.claimable.length > 0 && (
          <>
            <Text className="text-base font-semibold dark:text-white text-gray-900 mt-8">Are you one of these?</Text>
            <Text className="dark:text-gray-400 text-gray-500 text-xs mt-1 mb-3">
              Pick your name so expenses already added for you stay yours.
            </Text>
            {[...invite.claimable, { _id: NEW_MEMBER, name: "None of these, I'm new" }].map((option) => {
              const selected = choice === option._id;
              return (
                <TouchableOpacity
                  key={option._id}
                  onPress={() => setChoice(option._id)}
                  activeOpacity={0.8}
                  className={`flex-row items-center rounded-xl p-3 mb-2 border ${selected
                    ? 'border-indigo-600 dark:border-indigo-400'
                    : 'border-gray-200 dark:border-gray-700'}`}
                >
                  {option._id === NEW_MEMBER ? (
                    <View className="w-9 h-9 rounded-full items-center justify-center bg-gray-100 dark:bg-gray-800">
                      <Feather name="user-plus" size={16} color={isDark ? '#d1d5db' : '#4b5563'} />
                    </View>
                  ) : (
                    <InitialsAvatar name={option.name} size={36} />
                  )}
                  <Text className="flex-1 ml-3 dark:text-white text-gray-900">{option.name}</Text>
                  <Feather
                    name={selected ? 'check-circle' : 'circle'}
                    size={20}
                    color={selected ? '#6366f1' : '#9ca3af'}
                  />
                </TouchableOpacity>
              );
            })}
          </>
        )}

        <TouchableOpacity
          onPress={handleJoin}
          disabled={!choice || joining}
          className={`p-4 rounded-xl mt-6 ${choice ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-700'}`}
        >
          {joining ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-semibold text-center text-base">
              {choice ? 'Join group' : 'Pick an option above'}
            </Text>
          )}
        </TouchableOpacity>
      </>
    );
  };

  return (
    <SafeAreaView className="flex-1 dark:bg-gray-900 bg-white" edges={['top']}>
      <View className="flex-row items-center px-5 pt-4 pb-2">
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/groups'))}
          className="mr-4"
          hitSlop={8}
        >
          <Feather name="arrow-left" size={22} color={isDark ? 'white' : '#111827'} />
        </TouchableOpacity>
        <Text className="text-xl font-bold dark:text-white text-gray-900 flex-1">Join a group</Text>
      </View>

      <ScrollView
        className="flex-1 px-5"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: 16, paddingBottom: (keyboardHeight || 90 + insets.bottom) + 24 }}
      >
        {loading ? (
          <View className="items-center pt-16">
            <ActivityIndicator size="large" color="#6366f1" />
          </View>
        ) : error ? (
          <View className="items-center pt-10">
            <View className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 items-center justify-center">
              <Feather name="link-2" size={26} color="#ef4444" />
            </View>
            <Text className="dark:text-white text-gray-900 font-semibold text-base mt-4 text-center">{error}</Text>
            <View className="flex-row gap-3 mt-6 w-full">
              <TouchableOpacity onPress={resetCode} className="flex-1 bg-gray-200 dark:bg-gray-700 p-4 rounded-xl">
                <Text className="text-center font-semibold text-gray-700 dark:text-gray-300">Enter another code</Text>
              </TouchableOpacity>
              {code && (
                <TouchableOpacity onPress={() => loadPreview(code)} className="flex-1 bg-indigo-600 p-4 rounded-xl">
                  <Text className="text-center font-semibold text-white">Try again</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : preview ? (
          renderPreview(preview)
        ) : (
          renderCodeEntry()
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
