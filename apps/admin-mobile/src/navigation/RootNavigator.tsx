import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { colors } from '@mechbazar/shared';
import { RootState, setAuth } from '../store';
import { LoginScreen } from '../screens/LoginScreen';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
import { MainStack } from './MainStack';

const Stack = createNativeStackNavigator();
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

  if (!isReady) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return (
    <NavigationContainer>
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
