import * as SecureStore from 'expo-secure-store';

// Where the login tokens are kept. Native uses the device keychain/keystore;
// authStorage.web.ts is used in the browser, where SecureStore doesn't exist.
export const authStorage = {
  getItem: (name: string) => SecureStore.getItemAsync(name),
  setItem: (name: string, value: string) => SecureStore.setItemAsync(name, value),
  removeItem: (name: string) => SecureStore.deleteItemAsync(name),
};
