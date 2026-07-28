import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useDispatch } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import { Eye, EyeOff } from 'lucide-react-native';
import { colors, Button, Typography, Input, Card, Logo, adminService, getApiBaseUrl } from '@mechbazar/shared';
import { setAuth } from '../store';

// Mirrors apps/admin/src/pages/Login.tsx: email/password -> POST /auth/admin/login.
export const LoginScreen = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation<any>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
          <Logo width={220} />
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
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          containerStyle={{ marginBottom: 16 }}
        />

        {/* Label sits outside <Input> (rather than via its `label` prop) so the
            positioning box wraps the field alone -- top/bottom 0 then centres
            the reveal toggle without hard-coding the label's height. */}
        <View style={{ marginBottom: 8 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8 }}>Password</Text>
          <View>
            <Input
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              style={{ paddingRight: 48 }}
            />
            <Pressable
              onPress={() => setShowPassword((v) => !v)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              style={{ position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' }}
            >
              {showPassword
                ? <EyeOff size={20} color={colors.textSecondary} />
                : <Eye size={20} color={colors.textSecondary} />}
            </Pressable>
          </View>
        </View>

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
