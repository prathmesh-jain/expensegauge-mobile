import React, { useState } from 'react';
import {
  ActivityIndicator, Modal, ScrollView, Text, TextInput, TouchableOpacity, View, useColorScheme,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Toast } from 'toastify-react-native';
import { useGroupStore } from '@/store/groupStore';
import { addGroupMemberApi, addGroupMemberByEmailApi, lookupEmailApi, removeGroupMemberApi } from '@/api/groupApi';
import { memberBalanceLabel, TONE_TEXT } from '@/helper/groupFormat';
import { cleanName, looksLikeEmail } from '@/helper/groupLimits';
import { useKeyboardHeight } from '@/helper/useKeyboardHeight';
import InitialsAvatar from '@/components/InitialsAvatar';
import ConfirmModal from '@/components/ConfirmModal';
import { shareGroupInvite } from '@/helper/shareInvite';
import type { GroupMember } from '@/types/group';

// Everyone in a group with their balance; add people, remove those who haven't joined, share the invite
export default function GroupMembersScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';
  const keyboardHeight = useKeyboardHeight();
  const sheetPaddingBottom = keyboardHeight > 0 ? 24 : insets.bottom + 24;

  const group = useGroupStore((state) => state.groups.find((g) => g._id === groupId));
  const upsertGroup = useGroupStore((state) => state.upsertGroup);

  const [showAdd, setShowAdd] = useState(false);
  const [input, setInput] = useState('');
  const [foundUser, setFoundUser] = useState<{ email: string; name: string; maskedEmail: string } | null>(null);
  const [notFoundEmail, setNotFoundEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<GroupMember | null>(null);

  if (!group) return null;

  const members = group.members.filter((m) => m.status !== 'left');
  const joined = members.filter((m) => m.status === 'active');
  const waiting = members.filter((m) => m.status !== 'active');
  const netByMember = new Map((group.balances ?? []).map((b) => [b.memberId, b.net]));
  const canRemove = (m: GroupMember) =>
    (m.status === 'pending' || m.status === 'invited') && (group.isCreator || m.addedByYou);

  const closeAdd = () => {
    setShowAdd(false);
    setInput('');
    setFoundUser(null);
    setNotFoundEmail(null);
  };

  const handleAdd = async () => {
    const value = input.trim();
    if (!value) return;

    if (looksLikeEmail(value)) {
      const email = value.toLowerCase();
      // First tap: show who the email belongs to, so the right person gets invited
      if (foundUser?.email !== email) {
        setBusy(true);
        const lookup = await lookupEmailApi(email);
        setBusy(false);
        if (!lookup.ok) {
          if (lookup.status === 404) setNotFoundEmail(email);
          else Toast.error(lookup.message);
          return;
        }
        if (lookup.data.isYou) return Toast.error("That's your own email");
        setFoundUser({ email, name: lookup.data.name, maskedEmail: lookup.data.maskedEmail });
        return;
      }
      // Second tap: send the invitation
      setBusy(true);
      const result = await addGroupMemberByEmailApi(group._id, email);
      setBusy(false);
      if (!result.ok) return Toast.error(result.message);
      upsertGroup(result.data);
      Toast.success(`Invitation sent to ${foundUser.name}`);
      closeAdd();
      return;
    }

    const name = cleanName(value);
    setBusy(true);
    const result = await addGroupMemberApi(group._id, name);
    setBusy(false);
    if (!result.ok) return Toast.error(result.message);
    upsertGroup(result.data);
    closeAdd();
    Toast.success(`${name} added`);
  };

  const confirmRemove = async () => {
    if (!removing) return;
    setBusy(true);
    const result = await removeGroupMemberApi(group._id, removing._id);
    setBusy(false);
    if (!result.ok) return Toast.error(result.message);
    upsertGroup(result.data);
    Toast.success(`${removing.name} removed`);
    setRemoving(null);
  };

  const row = (member: GroupMember) => {
    const label = memberBalanceLabel(netByMember.get(member._id) ?? 0, group.currencySymbol);
    return (
      <View key={member._id} className="flex-row items-center py-2.5">
        <InitialsAvatar name={member.name} size={40} muted={member.status !== 'active'} />
        <View className="flex-1 ml-3">
          <Text className="dark:text-white text-gray-900 font-medium">
            {member.name}{member.isYou ? ' (you)' : ''}
          </Text>
          {member.status === 'pending' && (
            <Text className="dark:text-gray-400 text-gray-500 text-xs mt-0.5">Not joined yet</Text>
          )}
          {member.status === 'invited' && (
            <Text className="dark:text-gray-400 text-gray-500 text-xs mt-0.5">Invited · hasn&apos;t accepted yet</Text>
          )}
        </View>
        <Text className={`text-xs font-semibold mr-3 ${TONE_TEXT[label.tone]}`}>{label.text}</Text>
        {canRemove(member) && (
          <TouchableOpacity onPress={() => setRemoving(member)} hitSlop={10}>
            <Feather name="x" size={18} color="#9ca3af" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 dark:bg-gray-900 bg-white" edges={['top']}>
      <View className="flex-row items-center px-5 pt-4 pb-2">
        <TouchableOpacity onPress={() => router.back()} className="mr-4" hitSlop={8}>
          <Feather name="arrow-left" size={22} color={isDark ? 'white' : '#111827'} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-xl font-bold dark:text-white text-gray-900">Members</Text>
          <Text className="dark:text-gray-400 text-gray-500 text-xs" numberOfLines={1}>{group.name}</Text>
        </View>
        <TouchableOpacity onPress={() => setShowAdd(true)} className="bg-indigo-600 px-3 py-2 rounded-full flex-row items-center">
          <Feather name="user-plus" size={15} color="white" />
          <Text className="text-white text-sm font-semibold ml-1">Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingTop: 8, paddingBottom: 90 + insets.bottom }}>
        <View className="rounded-xl p-4 dark:bg-gray-800 bg-gray-50 border dark:border-gray-700 border-gray-200">
          <Text className="dark:text-gray-400 text-gray-500 text-xs">Invite code</Text>
          <View className="flex-row items-center mt-1">
            <Text selectable className="flex-1 dark:text-white text-gray-900 text-lg font-bold tracking-widest">
              {group.inviteCode}
            </Text>
            <TouchableOpacity
              onPress={() => shareGroupInvite(group.name, group.inviteCode)}
              className="bg-indigo-600 px-4 py-2.5 rounded-lg flex-row items-center"
            >
              <Feather name="share-2" size={15} color="white" />
              <Text className="text-white font-semibold ml-2">Share invite</Text>
            </TouchableOpacity>
          </View>
          <Text className="dark:text-gray-500 text-gray-400 text-xs mt-2">Anyone with the link or code can join this group.</Text>
        </View>

        <Text className="dark:text-gray-300 text-gray-700 font-semibold mt-6 mb-1">Joined · {joined.length}</Text>
        {joined.map(row)}

        {waiting.length > 0 && (
          <>
            <Text className="dark:text-gray-300 text-gray-700 font-semibold mt-6 mb-1">Not joined yet · {waiting.length}</Text>
            {waiting.map(row)}
          </>
        )}
      </ScrollView>

      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={closeAdd}>
        <View className="flex-1 justify-end bg-black/50" style={{ paddingBottom: keyboardHeight }}>
          <View className="dark:bg-gray-900 bg-white rounded-t-2xl p-6" style={{ paddingBottom: sheetPaddingBottom }}>
            <Text className="text-xl font-bold dark:text-white text-gray-900">Add member</Text>
            <Text className="dark:text-gray-400 text-gray-500 text-sm mt-1 mb-4">
              Enter their ExpenseGauge email to send an invitation, or just a name. People added by name claim it when they join with the invite link.
            </Text>
            <TextInput
              className="dark:bg-gray-800 bg-gray-100 rounded-lg p-3 dark:text-white text-gray-900 text-base"
              placeholder="Name or email"
              placeholderTextColor="#9ca3af"
              value={input}
              onChangeText={(v) => {
                setInput(v);
                setFoundUser(null);
                setNotFoundEmail(null);
              }}
              maxLength={254}
              autoCorrect={false}
              autoFocus
              onSubmitEditing={handleAdd}
            />
            {foundUser && (
              <View className="flex-row items-center mt-3 rounded-xl p-3 dark:bg-gray-800 bg-gray-50">
                <InitialsAvatar name={foundUser.name} size={36} />
                <View className="ml-3 flex-1">
                  <Text className="dark:text-white text-gray-900 font-medium">{foundUser.name}</Text>
                  <Text className="dark:text-gray-400 text-gray-500 text-xs">{foundUser.maskedEmail}</Text>
                </View>
                <Feather name="check-circle" size={18} color="#6b7280" />
              </View>
            )}
            {notFoundEmail && (
              <View className="mt-3 rounded-xl p-3 dark:bg-gray-800 bg-gray-50">
                <Text className="dark:text-gray-300 text-gray-600 text-xs leading-4">
                  No ExpenseGauge account uses {notFoundEmail}. Type their name instead and share the invite link.
                </Text>
              </View>
            )}
            <View className="flex-row gap-3 mt-5">
              <TouchableOpacity onPress={closeAdd} className="flex-1 bg-gray-200 dark:bg-gray-700 p-4 rounded-xl">
                <Text className="text-center font-semibold text-gray-700 dark:text-gray-300">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleAdd} disabled={busy} className="flex-1 bg-indigo-600 p-4 rounded-xl">
                {busy ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-center font-semibold text-white">
                    {foundUser ? 'Send invitation' : looksLikeEmail(input) ? 'Find' : 'Add'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ConfirmModal
        visible={!!removing}
        title={removing?.status === 'invited' ? 'Cancel invitation?' : `Remove ${removing?.name}?`}
        message={removing?.status === 'invited'
          ? `${removing?.name} won't see this invitation anymore.`
          : `${removing?.name} hasn't joined yet. They won't be part of this group anymore.`}
        confirmLabel="Remove"
        icon="user-x"
        tone="danger"
        loading={busy}
        onCancel={() => setRemoving(null)}
        onConfirm={confirmRemove}
      />
    </SafeAreaView>
  );
}
