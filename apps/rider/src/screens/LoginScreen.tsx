import React, { useState } from 'react';
import { View, Text, Alert, TouchableOpacity } from 'react-native';
import { useDispatch } from 'react-redux';
import * as SecureStore from 'expo-secure-store';
import { colors, Button, Typography, Input, riderService, getApiBaseUrl } from '@mechbazar/shared';
import { Truck } from 'lucide-react-native';
import { setAuth } from '../store';
import { sendPhoneOtp, confirmPhoneOtp } from '../services/phoneAuth';

// Riders are created by admin without a password, so they log in the same
// Firebase Phone Auth flow every role uses: "Send OTP" triggers a real SMS via
// Firebase (sendPhoneOtp), and the code the user enters is confirmed with
// Firebase to produce an ID token, which is what /auth/login and
// /riders/register verify (there is no dev bypass or backend send-otp
// anymore). New riders can also self-register here (the only entry point into
// the KYC wizard, see RootNavigator).
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
      // Firebase sends the real SMS; the code is confirmed in handleSubmit.
      await sendPhoneOtp(normalizedPhone);
      setOtpSent(true);
      Alert.alert('OTP Sent', 'An OTP has been sent to your phone.');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to send OTP');
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

    setLoading(true);
    // Confirm the SMS code with Firebase first -> ID token. A failure here is
    // a wrong/expired code, distinct from a backend/network error below.
    let idToken: string;
    try {
      idToken = await confirmPhoneOtp(normalizedOtp);
    } catch (error: any) {
      Alert.alert(mode === 'login' ? 'Login Failed' : 'Registration Failed', error?.message || 'The OTP you entered is incorrect or has expired.');
      setLoading(false);
      return;
    }

    try {
      const data = mode === 'login'
        ? await riderService.login({ phone: normalizedPhone, otp: idToken })
        : await riderService.register({ phone: normalizedPhone, otp: idToken, name: name.trim(), email: email.trim() || undefined });

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
