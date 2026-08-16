import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Alert, Pressable, TouchableOpacity } from 'react-native';
import { useDispatch } from 'react-redux';
import * as SecureStore from 'expo-secure-store';
import { Eye, EyeOff } from 'lucide-react-native';
import { colors, Button, Typography, Input, Logo, vendorService } from '@mechbazar/shared';
import { setAuth } from '../store';
import { sendPhoneOtp, confirmPhoneOtp, watchForAutoVerification } from '../services/phoneAuth';

export const LoginScreen = ({ navigation }: { navigation: any }) => {
  const dispatch = useDispatch();
  const [authMode, setAuthMode] = useState<'password' | 'otp'>('password');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);

  const [loading, setLoading] = useState(false);
  // Holds the token when Android verifies the number on its own (instant
  // verification, or SMS auto-retrieval). Login only proceeds once the user
  // taps the button -- Android completing this silently is not the same as
  // the user asking to be signed in.
  const autoVerifiedTokenRef = useRef<string | null>(null);
  const [autoVerifiedReady, setAutoVerifiedReady] = useState(false);

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
        dispatch(setAuth({ token: data.token, user: data.user }));
      } else {
        Alert.alert('Login Failed', 'No token received from server');
      }
    } catch (error: any) {
      Alert.alert('Login Failed', error?.response?.data?.message || error?.response?.data?.error || 'Incorrect email or password.');
    } finally {
      setLoading(false);
    }
  };

  const normalizedPhone = phone.replace(/\D/g, '').slice(0, 10);

  // Phone+OTP login -- same shared identity/session resolution used by
  // Customer/Rider/Mechanic, so a vendor who registered with a verified phone
  // (see RegisterScreen) can log back in without an email/password. Mirrors
  // apps/rider/src/screens/LoginScreen.tsx's send/confirm flow.
  const completeOtpLogin = useCallback(
    async (idToken: string) => {
      setLoading(true);
      try {
        const data = await vendorService.login({ phone: normalizedPhone, otp: idToken });
        if (data.token) {
          await SecureStore.setItemAsync('token', data.token);
          dispatch(setAuth({ token: data.token, user: data.user }));
        } else {
          Alert.alert('Login Failed', 'No token received from server');
        }
      } catch (error: any) {
        Alert.alert('Login Failed', error.response?.data?.error || error.message || 'An error occurred');
      } finally {
        setLoading(false);
      }
    },
    [dispatch, normalizedPhone]
  );

  useEffect(() => {
    if (authMode !== 'otp' || !otpSent || normalizedPhone.length !== 10) return;
    return watchForAutoVerification(normalizedPhone, (idToken) => {
      // Hold the token and ask the user to confirm rather than logging them
      // in the moment Android finishes -- see autoVerifiedTokenRef.
      autoVerifiedTokenRef.current = idToken;
      setAutoVerifiedReady(true);
    });
  }, [authMode, otpSent, normalizedPhone, completeOtpLogin]);

  const handleSendOtp = async () => {
    if (normalizedPhone.length !== 10) {
      Alert.alert('Error', 'Phone number must be 10 digits');
      return;
    }
    autoVerifiedTokenRef.current = null;
    setAutoVerifiedReady(false);
    try {
      setSendingOtp(true);
      const result = await sendPhoneOtp(normalizedPhone);
      // Android verified the number instantly -- no SMS was ever sent. That
      // used to log the user straight in with no confirmation step at all;
      // now it holds the token and shows a "verified -- tap to continue"
      // state instead (autoVerifiedTokenRef).
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

  const handleVerifyOtp = async () => {
    // Android already produced a valid token (see autoVerifiedTokenRef) --
    // there is no code to confirm, just the user's explicit go-ahead.
    if (autoVerifiedTokenRef.current) {
      const token = autoVerifiedTokenRef.current;
      autoVerifiedTokenRef.current = null;
      setAutoVerifiedReady(false);
      await completeOtpLogin(token);
      return;
    }

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
      Alert.alert('Login Failed', error?.message || 'The OTP you entered is incorrect or has expired.');
      return;
    }
    await completeOtpLogin(idToken);
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#ffffff' }}>
      <View style={{ alignItems: 'center', marginBottom: 48 }}>
        <Logo width={240} />
        <Typography variant="body" style={{ color: colors.navy, fontWeight: '700', marginTop: 8, letterSpacing: 2 }}>
          VENDOR PORTAL
        </Typography>
      </View>

      <View style={{ width: '100%' }}>
        {authMode === 'password' ? (
          <>
            <Input
              label="Email Address"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />

            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8 }}>Password</Text>
            <View>
              <Input
                placeholder="••••••••"
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
                  ? <EyeOff size={20} color={colors.navy} />
                  : <Eye size={20} color={colors.navy} />}
              </Pressable>
            </View>

            <Text
              style={{ color: colors.primary, fontWeight: '700', textAlign: 'right', marginTop: 4 }}
              onPress={() => navigation.navigate('ForgotPassword')}
            >
              Forgot password?
            </Text>

            <Button
              title="Login to Dashboard"
              onPress={handleLogin}
              loading={loading}
              style={{ width: '100%', marginTop: 24, paddingVertical: 16 }}
            />
          </>
        ) : (
          <>
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
                loading={sendingOtp}
                style={{ width: '100%', marginTop: 24, paddingVertical: 16 }}
              />
            ) : (
              <>
                <Button
                  title={autoVerifiedReady ? 'Continue' : 'Login'}
                  onPress={handleVerifyOtp}
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
          </>
        )}

        <TouchableOpacity
          onPress={() => {
            setAuthMode(authMode === 'password' ? 'otp' : 'password');
            setOtpSent(false);
          }}
          style={{ marginTop: 16, alignItems: 'center' }}
        >
          <Typography variant="body" style={{ color: colors.primary, fontWeight: '600' }}>
            {authMode === 'password' ? 'Login with phone OTP instead' : 'Login with email & password instead'}
          </Typography>
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 24 }}>
          <Text style={{ color: colors.navy }}>New seller? </Text>
          <Text
            style={{ color: colors.primary, fontWeight: '700' }}
            onPress={() => navigation.navigate('Register')}
          >
            Sign up
          </Text>
        </View>
      </View>
    </View>
  );
};
