import React from 'react';
import { Text, View } from 'react-native';

const PALETTE = [
  { bg: '#e0e7ff', fg: '#4338ca' },
  { bg: '#dcfce7', fg: '#15803d' },
  { bg: '#fef3c7', fg: '#b45309' },
  { bg: '#fce7f3', fg: '#be185d' },
  { bg: '#e0f2fe', fg: '#0369a1' },
  { bg: '#ede9fe', fg: '#6d28d9' },
];

const initialsOf = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
  return (first + last).toUpperCase();
};

// Same name always gets the same color
const colorFor = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
};

type Props = { name: string; size?: number; seed?: string; muted?: boolean };

export default function InitialsAvatar({ name, size = 40, seed, muted = false }: Props) {
  const color = muted ? { bg: '#e5e7eb', fg: '#6b7280' } : colorFor(seed ?? name);
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color.bg }}
      className="items-center justify-center"
    >
      <Text style={{ color: color.fg, fontSize: size * 0.38, fontWeight: '700' }}>{initialsOf(name)}</Text>
    </View>
  );
}
