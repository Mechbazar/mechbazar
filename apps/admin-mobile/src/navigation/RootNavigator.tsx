import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer, createNavigationContainerRef, CommonActions } from '@react-navigation/native';
import { addNotificationTapListener } from '../services/notifications';
import { resolveNotificationRoute } from '../utils/notificationDeepLink';
import { useDispatch, useSelector } from 'react-redux';
import { View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as SplashScreen from 'expo-splash-screen';
import { colors } from '@mechbazar/shared';
import { RootState, setAuth } from '../store';
import { LoginScreen } from '../screens/LoginScreen';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
import { MainStack } from './MainStack';

const Stack = createNativeStackNavigator();

// Module-level so the notification-tap listener (which fires outside the
// component tree) can navigate without threading a ref through props.
const navigationRef = createNavigationContainerRef();
const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'OPERATIONS_MANAGER', 'INVENTORY_MANAGER', 'VENDOR_MANAGER', 'FINANCE_MANAGER', 'CUSTOMER_SUPPORT']);

const decodeBase64Url = (input: string): string | null => {
  try {
    const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    if (typeof globalThis.atob === 'function') {
      return globalThis.atob(padded);
    }
    return null;
  } catch {
    return null;
  }
};

const getTokenRole = (token: string): string | null => {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const decoded = decodeBase64Url(payload);
    if (!decoded) return null;
    const parsed = JSON.parse(decoded);
    return typeof parsed?.role === 'string' ? parsed.role : null;
  } catch {
    return null;
  }
};

// Auth gate — restores the persisted token on boot (matching apps/rider's
// RootNavigator) before deciding Login/ForgotPassword vs the authenticated
// MainStack. Profile is fetched lazily by screens, same as rider/seller-mobile.
export const RootNavigator = () => {
  const dispatch = useDispatch();
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const [isReady, setIsReady] = React.useState(false);

  React.useEffect(() => {
    const restoreToken = async () => {
      try {
        const token = await SecureStore.getItemAsync('token');
        if (token) {
          const role = getTokenRole(token);
          if (role && ADMIN_ROLES.has(role)) {
            dispatch(setAuth({ token, user: null }));
          } else {
            await SecureStore.deleteItemAsync('token');
          }
        }
      } catch (error) {
        console.error('Failed to load token', error);
      } finally {
        setIsReady(true);
      }
    };
    restoreToken();
  }, [dispatch]);

  // Deep-link a tapped push notification straight to its order/vendor/rider/
  // customer/technician detail screen (system tray, not just an in-app
  // list). Registered once, independent of auth state -- a tap can arrive
  // before login finishes restoring.
  React.useEffect(() => {
    const unsubscribe = addNotificationTapListener((data) => {
      const target = resolveNotificationRoute({ data });
      if (target && navigationRef.isReady()) {
        navigationRef.dispatch(CommonActions.navigate({ name: target.screen, params: target.params }));
      }
    });
    return unsubscribe;
  }, []);

  // Hold the native splash until the token restore above has resolved. Without
  // this, expo-splash-screen auto-hides the moment the JS bundle mounts, which
  // is well before `isReady` flips -- so the blank placeholder below was what
  // the user actually saw for the 2-3 seconds SecureStore took, reading as a
  // white/default loading screen between the splash and the login screen.
  React.useEffect(() => {
    if (isReady) {
      // Failure here is not worth surfacing: the splash is already gone in the
      // only case that throws (it was hidden by something else first).
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isReady]);

  if (!isReady) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <Stack.Screen name="Main" component={MainStack} />
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
