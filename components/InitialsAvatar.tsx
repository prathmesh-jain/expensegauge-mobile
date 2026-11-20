import React from 'react';
import { Text, View } from 'react-native';

const initialsOf = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
  return (first + last).toUpperCase();
};

// `muted` for people who haven't joined yet
type Props = { name: string; size?: number; muted?: boolean };

export default function InitialsAvatar({ name, size = 40, muted = false }: Props) {
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2 }}
      className={`items-center justify-center ${muted ? 'bg-gray-100 dark:bg-gray-800' : 'bg-gray-200 dark:bg-gray-700'}`}
    >
      <Text
        style={{ fontSize: size * 0.38, fontWeight: '600' }}
        className={muted ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-200'}
      >
        {initialsOf(name)}
      </Text>
    </View>
  );
}
