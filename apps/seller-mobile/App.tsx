import React from 'react';
import { Provider } from 'react-redux';
import { store, logout } from './src/store';
import { RootNavigator } from './src/navigation/RootNavigator';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setUnauthorizedHandler } from '@mechbazar/shared';

import * as SplashScreen from 'expo-splash-screen';

// Must run in global scope rather than inside a component or hook: by the time
// a hook body executes, expo-splash-screen may already have auto-hidden. Not
// awaited, per Expo's docs -- awaiting it here would reintroduce the race.
SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient();

// An expired/invalid token would otherwise leave the seller stuck on a
// screen that looks logged-in but silently fails every request -- see
// packages/shared/src/api/client.ts for why this lives there, not here.
setUnauthorizedHandler(() => store.dispatch(logout()));

export default function App() {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <StatusBar style="dark" />
          <RootNavigator />
        </SafeAreaProvider>
      </QueryClientProvider>
    </Provider>
  );
}
