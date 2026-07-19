import React, { useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { useDispatch } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import { colors, Button, Typography, Input, Card, adminService, getApiBaseUrl } from '@mechbazar/shared';
import { setAuth } from '../store';

// Mirrors apps/admin/src/pages/Login.tsx: email/password -> POST /auth/admin/login.
export const LoginScreen = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation<any>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError('');
    if (!email || !password) {
      setError('Please enter email and password.');
      return;
    }

    try {
      setLoading(true);
      const data = await adminService.login({ email, password });
      if (data?.token) {
        await SecureStore.setItemAsync('token', data.token);
        dispatch(setAuth({ token: data.token, user: data.user }));
      } else {
        setError('No token received from server.');
      }
    } catch (err: any) {
      const networkError = !err?.response;
      setError(
        networkError
          ? `Cannot reach server (${getApiBaseUrl()}). Check the backend is running and reachable.`
          : err.response?.data?.error || 'Invalid credentials or server error.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.background }}>
      <Card variant="elevated" style={{ padding: 32 }}>
        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <Text style={{ fontSize: 32, fontWeight: '900', color: colors.text, letterSpacing: 1 }}>
            MECH<Text style={{ color: colors.primary }}>BAZAR</Text>
          </Text>
          <Typography variant="body" style={{ color: colors.textSecondary, marginTop: 8 }}>
            Sign in to manage your empire
          </Typography>
        </View>

        {!!error && (
          <View
            style={{
              backgroundColor: '#FDECEA',
              borderRadius: 8,
              padding: 12,
              marginBottom: 16,
            }}
          >
            <Typography variant="caption" style={{ color: colors.dangerStrong }}>{error}</Typography>
          </View>
        )}

        <Input
          label="Email Address"
          placeholder="admin@mechbazar.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          containerStyle={{ marginBottom: 16 }}
        />

        <Input
          label="Password"
          placeholder="••••••••"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          containerStyle={{ marginBottom: 8 }}
        />

        <View style={{ alignItems: 'flex-end', marginBottom: 16 }}>
          <Text style={{ color: colors.primary, fontWeight: '600' }} onPress={() => navigation.navigate('ForgotPassword')}>
            Forgot password?
          </Text>
        </View>

        <Button title={loading ? 'Authenticating...' : 'Sign In'} onPress={handleLogin} loading={loading} style={{ width: '100%' }} />
      </Card>
    </View>
  );
};
