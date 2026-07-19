import React, { useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useQuery } from '@tanstack/react-query';
import { colors, vendorService, Loader } from '@mechbazar/shared';
import { RootState, setAuth, logout } from '../store';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/registration/RegisterScreen';
import { OnboardingWizard } from '../screens/registration/OnboardingWizard';
import { StatusScreen } from '../screens/registration/StatusScreen';
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

export const RootNavigator = () => {
  const dispatch = useDispatch();
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const [isReady, setIsReady] = React.useState(false);

  React.useEffect(() => {
    const checkToken = async () => {
      try {
        const token = await SecureStore.getItemAsync('token');
        if (token) {
          // Profile is fetched lazily by VendorGate/screens.
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

  if (!isReady) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />; // simple splash placeholder
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <Stack.Screen name="Main" component={VendorGate} />
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
