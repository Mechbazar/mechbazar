import React, { useEffect } from 'react';
import { Provider } from 'react-redux';
import { store } from './src/store';
import { RootNavigator } from './src/navigation/RootNavigator';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { setApiBaseUrl, setUnauthorizedHandler } from '@mechbazar/shared';
import { logout } from './src/store';

import * as SplashScreen from 'expo-splash-screen';

// Must run in global scope rather than inside a component or hook: by the time
// a hook body executes, expo-splash-screen may already have auto-hidden. Not
// awaited, per Expo's docs -- awaiting it here would reintroduce the race.
SplashScreen.preventAutoHideAsync().catch(() => {});

// Without this, an expired/invalid token's 401 deletes the SecureStore token
// (packages/shared/src/api/client.ts's response interceptor) but Redux never
// learns about it -- isAuthenticated stays true, RootNavigator keeps rendering
// MainStack, and every screen just keeps re-fetching and failing with no path
// back to Login. rider/mechanic/seller-mobile all register this; admin-mobile
// was the one sibling app that didn't.
setUnauthorizedHandler(() => store.dispatch(logout()));

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
          {/* App theme is light (colors.background/#F5F6F8, colors.card/#FFFFFF)
              throughout -- "light" (white icons) made the status bar clock/
              battery/signal unreadable. Every sibling app uses "dark" here. */}
          <StatusBar style="dark" />
          <OrdersPoller />
          <RootNavigator />
        </SafeAreaProvider>
      </QueryClientProvider>
    </Provider>
  );
}
