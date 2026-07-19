import React, { useEffect } from 'react';
import { Provider } from 'react-redux';
import { store } from './src/store';
import { RootNavigator } from './src/navigation/RootNavigator';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { setApiBaseUrl } from '@mechbazar/shared';

const queryClient = new QueryClient();
const ORDERS_POLL_INTERVAL_MS = 20000;

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

// Mobile equivalent of apps/admin/src/App.tsx's live-refresh behavior. There's
// no push channel on this deployment, so periodically invalidate the same
// query keys a real-time event used to trigger -- the "New Order Received!"
// banner is dropped since there's no discrete event left to hang it on.
function OrdersPoller() {
  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
    }, ORDERS_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return null;
}

export default function App() {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <OrdersPoller />
          <RootNavigator />
        </SafeAreaProvider>
      </QueryClientProvider>
    </Provider>
  );
}
