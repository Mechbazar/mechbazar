import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Alert, TouchableOpacity } from 'react-native';
import { useDispatch } from 'react-redux';
import * as SecureStore from 'expo-secure-store';
import { colors, Button, Typography, Input, Logo, technicianService, getApiBaseUrl } from '@mechbazar/shared';
import { setAuth } from '../store';
import { sendPhoneOtp, confirmPhoneOtp, watchForAutoVerification } from '../services/phoneAuth';

// Technicians are created by admin without a password, so they log in the same
// Firebase Phone Auth flow every role uses: "Send OTP" triggers a real SMS via
// Firebase (sendPhoneOtp), and the code the user enters is confirmed with
// Firebase to produce an ID token, which is what /auth/login and
// /technicians/register verify (there is no dev bypass or backend send-otp
// anymore). New technicians can also self-register here (the only entry point
// into the KYC wizard, see RootNavigator).
//
// Typing the code is only ONE of the two ways verification finishes. Android
// also completes it on its own -- instantly (this device already verified this
// number, so no SMS is sent at all) or by auto-reading the SMS. Both consume
// the verification session, which is why this screen has to react to them
// rather than sit waiting on an OTP box: see the long note in
// services/phoneAuth.ts.
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
  // A Firebase ID token can reach completeAuth from either the manual code or
  // the auto-verification watcher, and both can land at once (the watcher fires
  // the moment confirm() succeeds). Without this, that would post the same
  // login twice.
  const completingRef = useRef(false);
  // Holds the token when Android verifies the number on its own (instant
  // verification, or SMS auto-retrieval). Login only proceeds once the user
  // taps the button -- Android completing this silently is not the same as
  // the user asking to be signed in.
  const autoVerifiedTokenRef = useRef<string | null>(null);
  const [autoVerifiedReady, setAutoVerifiedReady] = useState(false);

  // Everything after Firebase is happy: swap the ID token for a MechBazar
  // session. Shared by both verification paths, which differ only in how the
  // token was obtained.
  const completeAuth = useCallback(
    async (idToken: string) => {
      if (completingRef.current) return;
      completingRef.current = true;
      setLoading(true);
      try {
        const data = mode === 'login'
          ? await technicianService.login({ phone: phone.replace(/\D/g, '').slice(-10), otp: idToken })
          : await technicianService.register({ phone: phone.replace(/\D/g, '').slice(-10), otp: idToken, name: name.trim(), email: email.trim() || undefined });

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
        completingRef.current = false;
        setLoading(false);
      }
    },
    [dispatch, email, mode, name, phone]
  );

  // Covers the auto-verification that arrives LATE: the SMS lands a few seconds
  // after "Send OTP" and Play services reads it while this screen is showing
  // the code box. That signs the user in and spends the session, so anything
  // they type afterwards comes back as auth/session-expired. Watching the auth
  // state turns that into a successful login instead.
  useEffect(() => {
    if (!otpSent) return;
    const normalizedPhone = phone.replace(/\D/g, '').slice(-10);
    if (normalizedPhone.length !== 10) return;
    return watchForAutoVerification(normalizedPhone, (idToken) => {
      // Hold the token and ask the user to confirm rather than logging them
      // in the moment Android finishes -- see autoVerifiedTokenRef.
      autoVerifiedTokenRef.current = idToken;
      setAutoVerifiedReady(true);
    });
  }, [otpSent, phone, completeAuth]);

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

    autoVerifiedTokenRef.current = null;
    setAutoVerifiedReady(false);
    try {
      setSendingOtp(true);
      // Firebase sends the real SMS; the code is confirmed in handleSubmit.
      const result = await sendPhoneOtp(normalizedPhone);
      // ...unless Android verified the number instantly, in which case no SMS
      // was ever sent. That used to log the user straight in with no
      // confirmation step at all; now it holds the token and shows a
      // "verified -- tap to continue" state instead (autoVerifiedTokenRef).
      if (result.autoVerified && result.idToken) {
        autoVerifiedTokenRef.current = result.idToken;
        setAutoVerifiedReady(true);
        setOtpSent(true);
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

  const handleSubmit = async () => {
    // Android already produced a valid token (see autoVerifiedTokenRef) --
    // there is no code to confirm, just the user's explicit go-ahead.
    if (autoVerifiedTokenRef.current) {
      const token = autoVerifiedTokenRef.current;
      autoVerifiedTokenRef.current = null;
      setAutoVerifiedReady(false);
      await completeAuth(token);
      return;
    }

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
      idToken = await confirmPhoneOtp(normalizedOtp, normalizedPhone);
    } catch (error: any) {
      setLoading(false);
      Alert.alert(mode === 'login' ? 'Login Failed' : 'Registration Failed', error?.message || 'The OTP you entered is incorrect or has expired.');
      return;
    }

    // Leaves `loading` set: completeAuth owns it from here, so the button does
    // not flicker back to idle between the two network calls.
    await completeAuth(idToken);
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#ffffff' }}>
      <View style={{ alignItems: 'center', marginBottom: 48 }}>
        <Logo width={240} />
        <Typography variant="body" style={{ color: colors.navy, fontWeight: '700', marginTop: 8, letterSpacing: 2 }}>
          MECHANIC APP
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
            autoVerifiedTokenRef.current = null;
            setAutoVerifiedReady(false);
          }}
          autoCapitalize="none"
          keyboardType="phone-pad"
          editable={!otpSent}
        />
        {otpSent && (
          autoVerifiedReady ? (
            <Typography variant="body" style={{ color: colors.text, marginBottom: 8 }}>
              ✓ Number verified automatically. Tap below to continue.
            </Typography>
          ) : (
            <Input
              label="OTP"
              placeholder="Enter OTP"
              value={otp}
              onChangeText={(text) => setOtp(text.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              secureTextEntry
            />
          )
        )}
        {!otpSent ? (
          <Button
            title="Send OTP"
            onPress={handleSendOtp}
            loading={sendingOtp || loading}
            style={{ width: '100%', marginTop: 24, paddingVertical: 16 }}
          />
        ) : (
          <>
            <Button
              title={autoVerifiedReady ? 'Continue' : (mode === 'login' ? 'Login' : 'Register')}
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
            {mode === 'login' ? 'New mechanic? Register' : 'Already registered? Log in'}
          </Typography>
        </TouchableOpacity>
      </View>
    </View>
  );
};
