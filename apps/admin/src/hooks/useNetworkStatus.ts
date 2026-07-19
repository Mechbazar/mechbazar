import { useEffect, useState } from 'react';

// Previously nothing in the admin panel distinguished "you're offline" from
// "the server errored" -- every failed request fell into the same generic
// catch/alert. Browser's own online/offline events are the simplest reliable
// signal here (no polling, no extra dependency).
export function useNetworkStatus(): boolean {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  return isOffline;
}
