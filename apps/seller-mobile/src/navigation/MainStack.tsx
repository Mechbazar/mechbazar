import React, { useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useDispatch } from 'react-redux';
import * as SecureStore from 'expo-secure-store';
import { useQuery } from '@tanstack/react-query';
import { colors, vendorService, Loader } from '@mechbazar/shared';
import { logout } from '../store';
import { OnboardingWizard } from '../screens/registration/OnboardingWizard';
import { StatusScreen } from '../screens/registration/StatusScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { AnalyticsScreen } from '../screens/AnalyticsScreen';
import { TabNavigator } from './TabNavigator';

const Stack = createNativeStackNavigator();

// Once authenticated, whether a vendor sees the onboarding wizard, a status
// screen, or the real app depends on Vendor.status -- only APPROVED reaches
// TabNavigator. PENDING (registered but hasn't finished business/bank/docs)
// and REJECTED (editable) go to the wizard; UNDER_VERIFICATION/SUSPENDED/
// BLOCKED/INACTIVE are informational-only until an admin acts.
const VendorGate = () => {
  const dispatch = useDispatch();
  const [showWizard, setShowWizard] = useState(false);
  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ['vendor-profile'],
    queryFn: vendorService.getProfile,
    retry: false,
  });

  React.useEffect(() => {
    if (isError) {
      SecureStore.deleteItemAsync('token').then(() => {
        dispatch(logout());
      });
    }
  }, [isError, dispatch]);

  // Resubmitting from the wizard (OnboardingWizard's "Submit for Review")
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
    return <TabNavigator />;
  }

  if (showWizard || profile.status === 'PENDING') {
    return <OnboardingWizard />;
  }

  return <StatusScreen status={profile.status} onEdit={() => setShowWizard(true)} />;
};

// Nested inside RootNavigator's "Main" screen: the bottom tabs (behind
// VendorGate's approval check) live at the root of this stack, and
// Notifications/Analytics push on top so they get a native back
// button/header without needing their own tab -- same pattern as
// apps/mechanic's MainStack (BookingDetail/BookingChat).
export const MainStack = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Home" component={VendorGate} options={{ headerShown: false }} />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: 'Notifications', headerStyle: { backgroundColor: colors.card }, headerTintColor: colors.text }}
      />
      <Stack.Screen
        name="Analytics"
        component={AnalyticsScreen}
        options={{ title: 'Analytics', headerStyle: { backgroundColor: colors.card }, headerTintColor: colors.text }}
      />
    </Stack.Navigator>
  );
};
