import React, { useState } from 'react';
import { ActivityIndicator, Modal, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Toast } from 'toastify-react-native';
import { setGroupNotifications, useGroupNotifyPrompt } from '@/helper/pushService';

// "Get notified about <group>?" shown once per group, right after creating or joining it
const GroupNotifyPromptModal = () => {
  const group = useGroupNotifyPrompt((state) => state.group);
  const hide = useGroupNotifyPrompt((state) => state.hide);
  const [saving, setSaving] = useState(false);

  const choose = async (on: boolean) => {
    if (!group) return;
    setSaving(true);
    // Close before the system permission dialog so they aren't stacked
    if (on) hide();
    const result = await setGroupNotifications(group.id, on);
    setSaving(false);
    hide();
    // "Not now" failing (e.g. offline) just means we may ask again next time
    if (!on) return;
    if (result.ok) Toast.success(`Notifications on for ${group.name}`);
    else Toast.info(result.message);
  };

  return (
    <Modal animationType="fade" transparent visible={!!group} onRequestClose={() => choose(false)}>
      <View className="flex-1 justify-center items-center bg-black/50 p-4">
        <View className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-2xl p-6 shadow-xl">
          <View className="items-center mb-4">
            <View className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900/30 items-center justify-center mb-3">
              <Feather name="bell" size={28} color="#6366f1" />
            </View>
            <Text className="text-xl font-bold text-center dark:text-white">
              Get notified about {group?.name}?
            </Text>
          </View>
          <Text className="text-gray-600 dark:text-gray-300 mb-2 text-center">
            Hear when someone adds an expense you&apos;re part of or records a payment with you in this group.
          </Text>
          <Text className="text-gray-400 dark:text-gray-400 text-sm mb-6 text-center">
            You can change this any time in the group&apos;s settings.
          </Text>
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={() => choose(false)}
              disabled={saving}
              className="flex-1 bg-gray-200 dark:bg-gray-700 p-4 rounded-xl"
            >
              <Text className="text-center font-semibold text-gray-700 dark:text-gray-300">Not now</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => choose(true)} disabled={saving} className="flex-1 bg-indigo-600 p-4 rounded-xl">
              {saving ? <ActivityIndicator color="white" /> : <Text className="text-center font-semibold text-white">Turn on</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default GroupNotifyPromptModal;
