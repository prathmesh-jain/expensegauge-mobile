import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const CURRENCY_OPTIONS = [
  { symbol: '₹', label: 'Indian Rupee' },
  { symbol: '$', label: 'US Dollar' },
  { symbol: '€', label: 'Euro' },
  { symbol: '£', label: 'British Pound' },
  { symbol: '¥', label: 'Japanese Yen / Chinese Yuan' },
  { symbol: '₩', label: 'South Korean Won' },
  { symbol: 'A$', label: 'Australian Dollar' },
  { symbol: 'C$', label: 'Canadian Dollar' },
  { symbol: 'AED', label: 'UAE Dirham' },
];

type CurrencyStore = {
  symbol: string;
  setSymbol: (symbol: string) => void;
};

export const useCurrencyStore = create<CurrencyStore>()(
  persist(
    (set) => ({
      symbol: '₹',
      setSymbol: (symbol) => set({ symbol }),
    }),
    {
      name: 'currency-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export const useCurrencySymbol = () => useCurrencyStore((state) => state.symbol);

// Only the symbol is configurable; number grouping stays en-IN as before
export const formatCurrency = (value: number, symbol: string, options?: Intl.NumberFormatOptions) =>
  `${value < 0 ? '-' : ''}${symbol}${Math.abs(value).toLocaleString('en-IN', options)}`;

export const TWO_DECIMALS: Intl.NumberFormatOptions = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
