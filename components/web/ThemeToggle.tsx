import { Feather } from '@expo/vector-icons';
import { Pressable, View, useColorScheme } from 'react-native';
import { applyColorScheme } from '@/helper/applyColorScheme';
import { useThemeStore } from '@/store/themeStore';

type Theme = 'light' | 'dark' | null;

const OPTIONS: { value: Theme; icon: keyof typeof Feather.glyphMap; label: string }[] = [
  { value: 'light', icon: 'sun', label: 'Light theme' },
  { value: 'dark', icon: 'moon', label: 'Dark theme' },
  { value: null, icon: 'monitor', label: 'Use system theme' },
];

/** Light / dark / system switch shown outside the Profile screen in a browser. */
export default function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const isDark = useColorScheme() === 'dark';

  const choose = (value: Theme) => {
    applyColorScheme(value);
    setTheme(value);
  };

  return (
    <View className="flex-row rounded-lg p-1 gap-1 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 self-start">
      {OPTIONS.map((option) => {
        const active = theme === option.value;
        return (
          <Pressable
            key={option.label}
            onPress={() => choose(option.value)}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: active }}
            className={`w-8 h-7 rounded-md items-center justify-center ${active
              ? 'bg-white dark:bg-gray-600'
              : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}
          >
            <Feather
              name={option.icon}
              size={14}
              color={active ? (isDark ? '#ffffff' : '#4f46e5') : isDark ? '#9ca3af' : '#6b7280'}
            />
          </Pressable>
        );
      })}
    </View>
  );
}
