// Browser version of authStorage.ts: SecureStore has no web implementation,
// so tokens go to localStorage.
const available = () => typeof window !== 'undefined' && !!window.localStorage;

export const authStorage = {
  getItem: async (name: string) => (available() ? window.localStorage.getItem(name) : null),
  setItem: async (name: string, value: string) => {
    if (available()) window.localStorage.setItem(name, value);
  },
  removeItem: async (name: string) => {
    if (available()) window.localStorage.removeItem(name);
  },
};
