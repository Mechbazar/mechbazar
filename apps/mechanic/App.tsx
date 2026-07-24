import React from 'react';
import { Provider } from 'react-redux';
import { store, logout } from './src/store';
import { RootNavigator } from './src/navigation/RootNavigator';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { setApiBaseUrl, setUnauthorizedHandler } from '@mechbazar/shared';
import { OfflineBanner } from './src/components/OfflineBanner';

// An expired/invalid token would otherwise leave the technician stuck on a
// screen that looks logged-in but silently fails every request -- see
// packages/shared/src/api/client.ts for why this lives there, not here.
setUnauthorizedHandler(() => store.dispatch(logout()));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const configureApiBaseUrl = () => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) {
    setApiBaseUrl(envUrl);
    return;
  }

  const hostUri = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoGo?.debuggerHost;
  const host = typeof hostUri === 'string' ? hostUri.split(':')[0] : '';

  if (host) {
    setApiBaseUrl(`http://${host}:5000/api`);
  }
};

configureApiBaseUrl();

export default function App() {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <StatusBar style="dark" />
          <OfflineBanner />
          <RootNavigator />
        </SafeAreaProvider>
      </QueryClientProvider>
    </Provider>
  );
}
