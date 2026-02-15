// network.ts
import NetInfo from '@react-native-community/netinfo';

export const addNetworkListener = (onChange: (isConnected: boolean) => void) => {
  const unsubscribe = NetInfo.addEventListener(state => {
    onChange(!!state.isConnected);
  });
  return unsubscribe;
};

export const checkConnection = async (): Promise<boolean> => {
  const state = await NetInfo.fetch();
  return !!state.isConnected;
};
