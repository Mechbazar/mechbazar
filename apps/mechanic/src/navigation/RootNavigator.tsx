import React, { useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useQuery } from '@tanstack/react-query';
import { colors, technicianService, Loader } from '@mechbazar/shared';
import { RootState, setAuth, logout } from '../store';
import { LoginScreen } from '../screens/LoginScreen';
import { RegistrationScreen } from '../screens/registration/RegistrationScreen';
import { StatusScreen } from '../screens/registration/StatusScreen';
import { MainStack } from './MainStack';

const Stack = createNativeStackNavigator();

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

  if (!isReady) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return (
    <NavigationContainer>
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
