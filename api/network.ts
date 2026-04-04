// network.ts
import NetInfo from '@react-native-community/netinfo';

export const addNetworkListener = (onChange: (isConnected: boolean) => void) => {
  const unsubscribe = NetInfo.addEventListener(state => {
    const online = state.isInternetReachable ?? state.isConnected;
    onChange(!!online);
  });
  return unsubscribe;
};

export const checkConnection = async (): Promise<boolean|null> => {
  const state = await NetInfo.fetch();
  return state.isInternetReachable ?? state.isConnected;
};
