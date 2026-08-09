import React, { useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer, createNavigationContainerRef, CommonActions } from '@react-navigation/native';
import { addNotificationTapListener } from '../services/notifications';
import { resolveNotificationRoute } from '../utils/notificationDeepLink';
import { useDispatch, useSelector } from 'react-redux';
import { View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as SplashScreen from 'expo-splash-screen';
import { useQuery } from '@tanstack/react-query';
import { colors, technicianService, Loader } from '@mechbazar/shared';
import { RootState, setAuth, logout } from '../store';
import { LoginScreen } from '../screens/LoginScreen';
import { RegistrationScreen } from '../screens/registration/RegistrationScreen';
import { StatusScreen } from '../screens/registration/StatusScreen';
import { MainStack } from './MainStack';

const Stack = createNativeStackNavigator();

// Module-level so the notification-tap listener (which fires outside the
// component tree) can navigate without threading a ref through props.
const navigationRef = createNavigationContainerRef();

// Once authenticated, whether a technician sees the KYC wizard, a status
// screen, or the real app depends on ServiceTechnician.status -- only
// APPROVED reaches MainStack. PENDING (never submitted) and
// RESUBMISSION_REQUIRED/REJECTED (editable) go to the wizard;
// UNDER_VERIFICATION/SUSPENDED/BLOCKED/INACTIVE are informational-only until
// an admin acts.
const TechnicianGate = () => {
  const dispatch = useDispatch();
  const [showWizard, setShowWizard] = useState(false);
  const { data: profile, isLoading, isError } = useQuery({ 
    queryKey: ['technician-profile'], 
    queryFn: technicianService.getProfile,
    retry: false
  });

  React.useEffect(() => {
    if (isError) {
      SecureStore.deleteItemAsync('token').then(() => {
        dispatch(logout());
      });
    }
  }, [isError, dispatch]);

  // Resubmitting from the wizard (RegistrationScreen's "Submit for Review")
  // moves status to UNDER_VERIFICATION -- without this, showWizard stayed
  // true forever after the first "Edit & Continue" tap, so a successful
  // resubmission kept rendering the wizard instead of the status screen, with
  // no visible confirmation it went through.
  React.useEffect(() => {
    if (profile?.status === 'UNDER_VERIFICATION') {
      setShowWizard(false);
    }
  }, [profile?.status]);

  if (isLoading) {
    return <Loader fullScreen />;
  }

  if (isError || !profile) {
    return null;
  }

  if (profile.status === 'APPROVED') {
    return <MainStack />;
  }

  if (showWizard || profile.status === 'PENDING') {
    return <RegistrationScreen />;
  }

  return <StatusScreen status={profile.status} remarks={profile.remarks} onEdit={() => setShowWizard(true)} />;
};

export const RootNavigator = () => {
  const dispatch = useDispatch();
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const [isReady, setIsReady] = React.useState(false);

  React.useEffect(() => {
    const checkToken = async () => {
      try {
        const token = await SecureStore.getItemAsync('token');
        if (token) {
          // Profile is fetched lazily by screens, matching rider's pattern.
          dispatch(setAuth({ token, user: null }));
        }
      } catch (error) {
        console.error('Failed to load token', error);
      } finally {
        setIsReady(true);
      }
    };
    checkToken();
  }, [dispatch]);

  // Deep-link a tapped push notification straight to its booking screen
  // (system tray, not just an in-app list). Registered once, independent of
  // auth state -- a tap can arrive before login finishes restoring.
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
          <Stack.Screen name="Main" component={TechnicianGate} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
