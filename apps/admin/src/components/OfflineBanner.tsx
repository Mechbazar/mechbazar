import { useNetworkStatus } from '../hooks/useNetworkStatus';

export default function OfflineBanner() {
  const isOffline = useNetworkStatus();

  if (!isOffline) return null;

  return (
    <div className="w-full bg-neutral-900 text-white text-xs font-semibold text-center py-1.5">
      No internet connection -- changes won't save until you're back online.
    </div>
  );
}
