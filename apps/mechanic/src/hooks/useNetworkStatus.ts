import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

// Previously nothing in this app distinguished "you're offline" from "the
// server errored" -- every failed request fell into the same generic catch
// block or React Query error state. This is the first real connectivity
// check, backed by the OS (Wi-Fi/cellular radio state), not just a failed
// request -- matters especially here since a technician losing signal
// mid-job needs to know that's why status updates aren't going through.
export function useNetworkStatus(): boolean {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(state.isConnected === false || state.isInternetReachable === false);
    });
    return unsubscribe;
  }, []);

  return isOffline;
}
