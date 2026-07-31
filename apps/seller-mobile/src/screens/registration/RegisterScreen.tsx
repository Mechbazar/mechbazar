import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, Alert, Text, TouchableOpacity } from 'react-native';
import { useDispatch } from 'react-redux';
import * as SecureStore from 'expo-secure-store';
import { colors, Button, Typography, Input, vendorService } from '@mechbazar/shared';
import { setAuth } from '../../store';
import { sendPhoneOtp, confirmPhoneOtp, watchForAutoVerification } from '../../services/phoneAuth';

// Step 1 of the vendor onboarding flow -- creates the account (mirrors web
// Register.tsx's "personal" step) and authenticates. The remaining steps
// (business/bank/documents/submit) happen in OnboardingWizard, reached
// automatically once RootNavigator sees an authenticated vendor whose
// status isn't APPROVED yet.
//
// The phone field must be proven via Firebase Phone Auth (Send OTP -> enter
// code) before the account is created, same as Customer/Rider/Mechanic
// registration -- previously this screen sent phone as a raw, unverified
// field, so anyone could type in someone else's number as a vendor. This
// also makes vendor registration resolve to the same shared identity if the
// phone already has a Customer/Rider/Mechanic account. Mirrors
// apps/rider/src/screens/LoginScreen.tsx's send/confirm flow.
export const RegisterScreen = ({ navigation }: { navigation: any }) => {
  const dispatch = useDispatch();
  const [form, setForm] = useState({ name: '', phone: '', email: '', password: '' });
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [loading, setLoading] = useState(false);

  const normalizedPhone = form.phone.replace(/\D/g, '').slice(0, 10);

  const completeRegistration = useCallback(
    async (idToken: string) => {
      setLoading(true);
      try {
        const data = await vendorService.register({
          name: form.name.trim(),
          phone: normalizedPhone,
          otp: idToken,
          email: form.email.trim() || undefined,
          password: form.password,
        });
        if (data.token) {
          await SecureStore.setItemAsync('token', data.token);
          dispatch(setAuth({ token: data.token, user: data.user }));
        } else {
          Alert.alert('Registration Failed', 'No token received from server');
        }
      } catch (error: any) {
        Alert.alert('Registration Failed', error.response?.data?.error || error.message || 'An error occurred');
      } finally {
        setLoading(false);
      }
    },
    [dispatch, form.email, form.name, form.password, normalizedPhone]
  );

  // Covers auto-verification that arrives late (SMS auto-read by Play
  // services a few seconds after Send OTP, while this screen still shows the
  // code box) -- see services/phoneAuth.ts for why this can't be optional.
  useEffect(() => {
    if (!otpSent || normalizedPhone.length !== 10) return;
    return watchForAutoVerification(normalizedPhone, (idToken) => {
      setOtpSent(false);
      void completeRegistration(idToken);
    });
  }, [otpSent, normalizedPhone, completeRegistration]);

  const handleSendOtp = async () => {
    if (!form.name.trim()) {
      Alert.alert('Error', 'Please enter your full name');
      return;
    }
    if (normalizedPhone.length !== 10) {
      Alert.alert('Error', 'Please enter a valid 10-digit phone number');
      return;
    }
    if (!form.password || form.password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    try {
      setSendingOtp(true);
      const result = await sendPhoneOtp(normalizedPhone);
      if (result.autoVerified && result.idToken) {
        setOtpSent(false);
        await completeRegistration(result.idToken);
        return;
      }
      setOtpSent(true);
      Alert.alert('OTP Sent', 'An OTP has been sent to your phone.');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to send OTP');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyAndRegister = async () => {
    const normalizedOtp = otp.replace(/\D/g, '');
    if (normalizedOtp.length < 6) {
      Alert.alert('Error', 'OTP must be at least 6 digits');
      return;
    }

    setLoading(true);
    let idToken: string;
    try {
      idToken = await confirmPhoneOtp(normalizedOtp, normalizedPhone);
    } catch (error: any) {
      setLoading(false);
      Alert.alert('Registration Failed', error?.message || 'The OTP you entered is incorrect or has expired.');
      return;
    }

    await completeRegistration(idToken);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#ffffff' }} contentContainerStyle={{ padding: 24, paddingTop: 64 }}>
      <Typography variant="h2">Become a MechBazar Seller</Typography>
      <Typography variant="body" style={{ color: colors.textSecondary, marginTop: 8, marginBottom: 24 }}>
        Complete your profile to start selling products to thousands of customers.
      </Typography>

      <Input label="Full Name" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} editable={!otpSent} />
      <Input
        label="Phone Number"
        keyboardType="phone-pad"
        value={form.phone}
        onChangeText={(v) => {
          setForm({ ...form, phone: v.replace(/\D/g, '').slice(0, 10) });
          setOtpSent(false);
        }}
        editable={!otpSent}
      />
      <Input label="Email Address" autoCapitalize="none" keyboardType="email-address" value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} editable={!otpSent} />
      <Input label="Password" secureTextEntry value={form.password} onChangeText={(v) => setForm({ ...form, password: v })} editable={!otpSent} />

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
        <Button title="Send OTP" onPress={handleSendOtp} loading={sendingOtp} style={{ marginTop: 16 }} />
      ) : (
        <>
          <Button title="Verify & Continue" onPress={handleVerifyAndRegister} loading={loading} style={{ marginTop: 16 }} />
          <TouchableOpacity onPress={handleSendOtp} disabled={sendingOtp} style={{ marginTop: 16, alignItems: 'center' }}>
            <Typography variant="body" style={{ color: colors.primary, fontWeight: '600' }}>
              Resend OTP
            </Typography>
          </TouchableOpacity>
        </>
      )}

      <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 24 }}>
        <Text style={{ color: colors.navy }}>Already have an account? </Text>
        <Text style={{ color: colors.primary, fontWeight: '700' }} onPress={() => navigation.navigate('Login')}>
          Login
        </Text>
      </View>
    </ScrollView>
  );
};
