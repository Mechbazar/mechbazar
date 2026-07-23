import React, { useState } from 'react';
import { View, Text, Alert, TouchableOpacity } from 'react-native';
import { useDispatch } from 'react-redux';
import * as SecureStore from 'expo-secure-store';
import { colors, Button, Typography, Input, riderService, getApiBaseUrl } from '@mechbazar/shared';
import { Truck } from 'lucide-react-native';
import { setAuth } from '../store';

// Riders are created by admin without a password, so they log in the same
// phone+OTP flow every role uses. A real OTP only ever exists once
// POST /auth/send-otp has been called (it's what creates the PhoneOtp row,
// or sends the real SMS in production) -- previously this screen submitted
// straight to /auth/login with no way to request an OTP first, so the only
// code that ever worked was the dev-bypass '123456', and only for phones
// explicitly allow-listed via DEV_OTP_BYPASS_PHONES on the backend. New
// riders can also self-register here (the only entry point into the KYC
// wizard, see RootNavigator).
export const LoginScreen = () => {
  const dispatch = useDispatch();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async () => {
    const normalizedPhone = phone.replace(/\D/g, '').slice(-10);
    if (normalizedPhone.length !== 10) {
      Alert.alert('Error', 'Phone number must be 10 digits');
      return;
    }
    if (mode === 'register' && !name.trim()) {
      Alert.alert('Error', 'Please enter your full name');
      return;
    }

    try {
      setSendingOtp(true);
      const data = await riderService.sendOtp(normalizedPhone);
      setOtpSent(true);
      if (data?.otp) {
        Alert.alert('OTP Sent', `Your OTP is: ${data.otp} (dev/test mode only).`);
      } else {
        Alert.alert('OTP Sent', 'An OTP has been sent to your phone.');
      }
    } catch (error: any) {
      const networkError = !error?.response;
      const message = networkError
        ? `Cannot reach server (${getApiBaseUrl()}). Check the backend is running and phone/laptop are on same Wi-Fi.`
        : error.response?.data?.error || error.message || 'Failed to send OTP';
      Alert.alert('Error', message);
    } finally {
      setSendingOtp(false);
    }
  };

  const handleSubmit = async () => {
    const normalizedPhone = phone.replace(/\D/g, '').slice(-10);
    const normalizedOtp = otp.replace(/\D/g, '');

    if (!normalizedPhone || !normalizedOtp) {
      Alert.alert('Error', 'Please enter your phone number and OTP');
      return;
    }
    if (normalizedPhone.length !== 10) {
      Alert.alert('Error', 'Phone number must be 10 digits');
      return;
    }
    if (normalizedOtp.length < 6) {
      Alert.alert('Error', 'OTP must be at least 6 digits');
      return;
    }
    if (mode === 'register' && !name.trim()) {
      Alert.alert('Error', 'Please enter your full name');
      return;
    }

    try {
      setLoading(true);
      const data = mode === 'login'
        ? await riderService.login({ phone: normalizedPhone, otp: normalizedOtp })
        : await riderService.register({ phone: normalizedPhone, otp: normalizedOtp, name: name.trim(), email: email.trim() || undefined });

      if (data.token) {
        await SecureStore.setItemAsync('token', data.token);
        dispatch(setAuth({ token: data.token, user: data.user }));
      } else {
        Alert.alert(mode === 'login' ? 'Login Failed' : 'Registration Failed', 'No token received from server');
      }
    } catch (error: any) {
      const networkError = !error?.response;
      const message = networkError
        ? `Cannot reach server (${getApiBaseUrl()}). Check the backend is running and phone/laptop are on same Wi-Fi.`
        : error.response?.data?.error || error.message || 'An error occurred';
      Alert.alert(mode === 'login' ? 'Login Failed' : 'Registration Failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#ffffff' }}>
      <View style={{ alignItems: 'center', marginBottom: 48 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View
            style={{
              width: 50,
              height: 50,
              borderColor: colors.primary,
              borderWidth: 4,
              borderRadius: 12,
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: 16,
            }}
          >
            <Truck color={colors.primary} size={26} />
          </View>
          <Text style={{ fontSize: 32, fontWeight: '900', color: colors.navy, letterSpacing: 1 }}>
            MECH<Text style={{ color: colors.primary }}>BAZAR</Text>
          </Text>
        </View>
        <Typography variant="body" style={{ color: colors.navy, fontWeight: '700', marginTop: 8, letterSpacing: 2 }}>
          RIDER APP
        </Typography>
      </View>

      <View style={{ width: '100%' }}>
        {mode === 'register' && (
          <>
            <Input label="Full Name" placeholder="Your full name" value={name} onChangeText={setName} />
            <Input label="Email (optional)" placeholder="you@example.com" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          </>
        )}
        <Input
          label="Phone Number"
          placeholder="10 digit phone number"
          value={phone}
          onChangeText={(text) => {
            setPhone(text.replace(/\D/g, '').slice(0, 10));
            setOtpSent(false);
          }}
          autoCapitalize="none"
          keyboardType="phone-pad"
          editable={!otpSent}
        />
        {otpSent && (
          <Input
            label="OTP"
            placeholder="Enter OTP"
            value={otp}
            onChangeText={(text) => setOtp(text.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            secureTextEntry
          />
        )}
        {!otpSent ? (
          <Button
            title="Send OTP"
            onPress={handleSendOtp}
            loading={sendingOtp}
            style={{ width: '100%', marginTop: 24, paddingVertical: 16 }}
          />
        ) : (
          <>
            <Button
              title={mode === 'login' ? 'Login' : 'Register'}
              onPress={handleSubmit}
              loading={loading}
              style={{ width: '100%', marginTop: 24, paddingVertical: 16 }}
            />
            <TouchableOpacity onPress={handleSendOtp} disabled={sendingOtp} style={{ marginTop: 16, alignItems: 'center' }}>
              <Typography variant="body" style={{ color: colors.primary, fontWeight: '600' }}>
                Resend OTP
              </Typography>
            </TouchableOpacity>
          </>
        )}
        <TouchableOpacity onPress={() => { setMode(mode === 'login' ? 'register' : 'login'); setOtpSent(false); }} style={{ marginTop: 16, alignItems: 'center' }}>
          <Typography variant="body" style={{ color: colors.primary, fontWeight: '600' }}>
            {mode === 'login' ? 'New rider? Register' : 'Already registered? Log in'}
          </Typography>
        </TouchableOpacity>
      </View>
    </View>
  );
};
