import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, setAuth } from '../store';
import { TabNavigator } from './TabNavigator';
import { View, Text } from 'react-native';
import { colors, Button, Typography, Card, Input, vendorService } from '@mechbazar/shared';
import * as SecureStore from 'expo-secure-store';
import { Alert } from 'react-native';

const Stack = createNativeStackNavigator();

import { Wrench } from 'lucide-react-native';

const LoginScreen = () => {
  const dispatch = useDispatch();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }
    
    try {
      setLoading(true);
      const data = await vendorService.login({ email, password });
      
      if (data.token) {
        await SecureStore.setItemAsync('token', data.token);
        dispatch(setAuth({ token: data.token, user: data.vendor }));
      } else {
        Alert.alert('Login Failed', 'No token received from server');
      }
    } catch (error: any) {
      Alert.alert('Login Failed', error.response?.data?.message || error.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{flex:1, justifyContent:'center', padding: 24, backgroundColor: '#ffffff'}}>
      <View style={{ alignItems: 'center', marginBottom: 48 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ 
            width: 50, height: 50, 
            borderColor: colors.primary, borderWidth: 4, 
            borderRadius: 12, justifyContent: 'center', alignItems: 'center',
            transform: [{ rotate: '45deg' }],
            marginRight: 16
          }}>
            <View style={{ transform: [{ rotate: '-45deg' }] }}>
              <Wrench color={colors.primary} size={28} />
            </View>
          </View>
          <Text style={{ fontSize: 36, fontWeight: '900', color: colors.primary, fontStyle: 'italic', letterSpacing: -1 }}>
            Mech Bazar
          </Text>
        </View>
        <Typography variant="body" style={{ color: colors.navy, fontWeight: '700', marginTop: 8, letterSpacing: 2 }}>
          VENDOR PORTAL
        </Typography>
      </View>
      
      <View style={{ width: '100%' }}>
        <Input 
          label="Email Address" 
          placeholder="vendor@example.com" 
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        
        <Input 
          label="Password" 
          placeholder="••••••••" 
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        
        <Button 
          title="Login to Dashboard" 
          onPress={handleLogin} 
          loading={loading}
          style={{ width: '100%', marginTop: 24, paddingVertical: 16 }} 
        />
        
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 24 }}>
          <Text style={{ color: colors.navy, fontWeight: '600' }}>Forgot password?</Text>
          <Text style={{ color: colors.primary, fontWeight: '600' }}>Sign up</Text>
        </View>
      </View>
    </View>
  );
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
          // If token exists, we can dispatch login state
          // Optionally, verify token or fetch user profile from API here
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
    return <View style={{flex: 1, backgroundColor: colors.background}} />; // simple splash placeholder
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <Stack.Screen name="MainTabs" component={TabNavigator} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
