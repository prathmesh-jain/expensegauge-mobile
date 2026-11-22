import { Appearance } from 'react-native';
import { colorScheme } from 'nativewind';

// react-native-web's Appearance only reports the browser's preference and has no
// setColorScheme. Patch it so a chosen theme reaches useColorScheme() in every
// screen, and set NativeWind's "dark" class so dark: styles follow it too.
type Scheme = 'light' | 'dark';
type Listener = (preferences: { colorScheme: Scheme }) => void;

const query = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
const systemScheme = (): Scheme => (query?.matches ? 'dark' : 'light');

let override: Scheme | null = null;
let applied: Scheme | null = null;
const listeners = new Set<Listener>();

const current = (): Scheme => override ?? systemScheme();

const publish = () => {
  const scheme = current();
  if (scheme === applied) return;
  applied = scheme;
  // Tells the browser the page draws its own theme (scrollbars, form controls,
  // and no automatic dark mode recoloring on top of ours)
  if (typeof document !== 'undefined') document.documentElement.style.colorScheme = scheme;
  try {
    colorScheme.set(scheme);
  } catch {
    // NativeWind's stylesheet isn't ready yet; it picks the class up when it loads
  }
  // Deferred: this runs while the root layout renders, and listeners set state elsewhere
  queueMicrotask(() => listeners.forEach((listener) => listener({ colorScheme: scheme })));
};

Appearance.getColorScheme = current;
Appearance.addChangeListener = (listener: Listener) => {
  listeners.add(listener);
  return { remove: () => listeners.delete(listener) };
};
query?.addEventListener?.('change', publish);

export const applyColorScheme = (theme: 'light' | 'dark' | null) => {
  override = theme;
  publish();
};
