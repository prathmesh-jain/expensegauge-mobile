import { Feather } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { useAuthStore } from '@/store/authStore';
import InitialsAvatar from '@/components/InitialsAvatar';
import { INSTALL_LABELS, useInstallApp } from '@/helper/installApp';

type Item = { label: string; icon: keyof typeof Feather.glyphMap };

type Props = BottomTabBarProps & {
  items: Record<string, Item>;
  // Tabs that open somewhere other than their own route (Insights in admin mode)
  onItemPress?: Partial<Record<string, () => void>>;
  showQuickAdd: boolean;
};

export const SIDEBAR_WIDTH = 248;

/** Left navigation that replaces the bottom tab bar in a desktop browser. */
export default function DesktopSidebar({ state, descriptors, navigation, items, onItemPress, showQuickAdd }: Props) {
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
  const name = useAuthStore((s) => s.name);
  const email = useAuthStore((s) => s.email);
  const { mode: installMode, install } = useInstallApp();

  const openTab = (index: number) => {
    const route = state.routes[index];
    const custom = onItemPress?.[route.name];
    if (custom) return custom();
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (state.index !== index && !event.defaultPrevented) navigation.navigate(route.name, route.params);
  };

  return (
    <View
      style={{ width: SIDEBAR_WIDTH, borderRightWidth: 1, borderColor: isDark ? '#1f2937' : '#e5e7eb' }}
      className="bg-gray-50 dark:bg-gray-950 px-4 pt-6 pb-4"
    >
      <View className="flex-row items-center gap-2.5 px-2 mb-8">
        <Image
          source={isDark ? require('../../assets/images/icon1.png') : require('../../assets/images/iconLight.png')}
          style={{ width: 34, height: 29 }}
          resizeMode="contain"
        />
        <Text className="text-lg font-bold dark:text-white text-gray-900">ExpenseGauge</Text>
      </View>

      {showQuickAdd && (
        <View className="flex-row gap-2 mb-6">
          <Pressable
            onPress={() => router.push({ pathname: '/expenseModal/[type]', params: { type: 'debit', preselectedSourceId: '' } })}
            className="flex-1 flex-row items-center justify-center gap-1.5 bg-red-600 hover:bg-red-500 rounded-lg py-2.5"
          >
            <Feather name="minus" size={15} color="white" />
            <Text className="text-white font-semibold text-sm">Debit</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push({ pathname: '/expenseModal/[type]', params: { type: 'credit', preselectedSourceId: '' } })}
            className="flex-1 flex-row items-center justify-center gap-1.5 bg-green-600 hover:bg-green-500 rounded-lg py-2.5"
          >
            <Feather name="plus" size={15} color="white" />
            <Text className="text-white font-semibold text-sm">Credit</Text>
          </Pressable>
        </View>
      )}

      <View className="gap-1">
        {state.routes.map((route, index) => {
          const item = items[route.name];
          const { options } = descriptors[route.key];
          if (!item || StyleSheet.flatten(options.tabBarItemStyle)?.display === 'none') return null;
          const focused = state.index === index;
          const badge = options.tabBarBadge;
          return (
            <Pressable
              key={route.key}
              onPress={() => openTab(index)}
              accessibilityRole="link"
              accessibilityState={{ selected: focused }}
              className={`flex-row items-center gap-3 px-3 py-2.5 rounded-lg ${focused
                ? 'bg-indigo-100 dark:bg-indigo-500/15'
                : 'hover:bg-gray-200/70 dark:hover:bg-gray-800/70'}`}
            >
              <Feather name={item.icon} size={18} color={focused ? '#6366f1' : isDark ? '#9ca3af' : '#4b5563'} />
              <Text className={`flex-1 text-[15px] ${focused
                ? 'text-indigo-700 dark:text-indigo-300 font-semibold'
                : 'text-gray-700 dark:text-gray-300'}`}
              >
                {item.label}
              </Text>
              {badge !== undefined && (
                <View className="bg-indigo-600 rounded-full px-1.5 min-w-[20px] h-5 items-center justify-center">
                  <Text className="text-white text-[11px] font-semibold">{badge}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      <View className="flex-1" />

      {installMode && (
        <Pressable
          onPress={install}
          className="flex-row items-center gap-3 px-3 py-2.5 mb-2 rounded-lg border border-indigo-200 dark:border-indigo-500/30 hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
        >
          <Feather name="download" size={17} color="#6366f1" />
          <Text className="text-[14px] font-medium text-indigo-700 dark:text-indigo-300">{INSTALL_LABELS[installMode]}</Text>
        </Pressable>
      )}

      {name && (
        <Pressable
          onPress={() => {
            const profile = state.routes.findIndex((r) => r.name === 'profile');
            if (profile >= 0) openTab(profile);
          }}
          className="flex-row items-center gap-3 p-2 rounded-lg hover:bg-gray-200/70 dark:hover:bg-gray-800/70"
        >
          <InitialsAvatar name={name} size={36} />
          <View className="flex-1">
            <Text numberOfLines={1} className="text-sm font-semibold dark:text-white text-gray-900">{name}</Text>
            {email && <Text numberOfLines={1} className="text-xs dark:text-gray-400 text-gray-500">{email}</Text>}
          </View>
        </Pressable>
      )}
    </View>
  );
}
