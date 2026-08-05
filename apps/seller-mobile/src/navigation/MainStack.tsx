import React, { useState } from 'react';
import { View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { colors, vendorService, Loader, Typography, Button } from '@mechbazar/shared';
import { registerForPushNotificationsAsync } from '../services/notifications';
import { OnboardingWizard } from '../screens/registration/OnboardingWizard';
import { ChangePasswordScreen } from '../screens/ChangePasswordScreen';
import { StatusScreen } from '../screens/registration/StatusScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { NotificationPreferencesScreen } from '../screens/NotificationPreferencesScreen';
import { AnalyticsScreen } from '../screens/AnalyticsScreen';
import { TabNavigator } from './TabNavigator';

const Stack = createNativeStackNavigator();

// Once authenticated, whether a vendor sees the onboarding wizard, a status
// screen, or the real app depends on Vendor.status -- only APPROVED reaches
// TabNavigator. PENDING (registered but hasn't finished business/bank/docs)
// and REJECTED (editable) go to the wizard; UNDER_VERIFICATION/SUSPENDED/
// BLOCKED/INACTIVE are informational-only until an admin acts.
const VendorGate = () => {
  const [showWizard, setShowWizard] = useState(false);
  const { data: profile, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['vendor-profile'],
    queryFn: vendorService.getProfile,
    retry: false,
  });

  // A real auth failure (expired/invalid token) is already handled globally --
  // packages/shared/src/api/client.ts's response interceptor deletes the token
  // and fires setUnauthorizedHandler (wired to dispatch(logout()) in App.tsx)
  // on any 401. This screen used to *also* delete the token and log out on
  // isError, but that fires for every failure (500, timeout, a rider offline
  // for a moment right after launch), not just auth ones -- so a transient
  // network blip on cold start silently destroyed a perfectly valid session.
  // Show a retry state instead and let the global 401 handler own logout.

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
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.background }}>
        <Typography variant="h2" style={{ marginBottom: 8, textAlign: 'center' }}>Couldn't load your profile</Typography>
        <Typography variant="body" style={{ marginBottom: 24, textAlign: 'center', color: colors.textSecondary }}>
          Check your connection and try again.
        </Typography>
        <Button title={isRefetching ? 'Retrying...' : 'Retry'} onPress={() => refetch()} loading={isRefetching} disabled={isRefetching} />
      </View>
    );
  }

  if (profile.status === 'APPROVED') {
    return <ApprovedVendorApp />;
  }

  if (showWizard || profile.status === 'PENDING') {
    return <OnboardingWizard />;
  }

  return <StatusScreen status={profile.status} onEdit={() => setShowWizard(true)} />;
};

// Only registers once the vendor is actually APPROVED and reaches the real
// app -- a token registered earlier (still in the onboarding wizard, or on a
// suspended/rejected account) would receive order/wallet notifications for
// an account that can't yet act on them.
const ApprovedVendorApp = () => {
  React.useEffect(() => {
    registerForPushNotificationsAsync();
  }, []);

  return <TabNavigator />;
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
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ headerShown: true, title: 'Change Password' }} />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: 'Notifications', headerStyle: { backgroundColor: colors.card }, headerTintColor: colors.text }}
      />
      <Stack.Screen
        name="NotificationPreferences"
        component={NotificationPreferencesScreen}
        options={{ title: 'Notification Preferences', headerStyle: { backgroundColor: colors.card }, headerTintColor: colors.text }}
      />
      <Stack.Screen
        name="Analytics"
        component={AnalyticsScreen}
        options={{ title: 'Analytics', headerStyle: { backgroundColor: colors.card }, headerTintColor: colors.text }}
      />
    </Stack.Navigator>
  );
};
