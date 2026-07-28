import React from 'react';
import { View, Alert } from 'react-native';
import { colors, Button, Typography, Input, Logo, requestPasswordReset } from '@mechbazar/shared';

// The seller app had no forgot-password route at all: a vendor who lost their
// password had nowhere to go from the login screen, and no backend reset
// endpoint existed for the credential this app signs in with (the bcrypt hash
// on User.password, checked by POST /vendors/login).
//
// POST /auth/forgot-password now hands delivery to Firebase, which holds the
// project's verified mail channel, and loginVendor reconciles the local hash
// the first time the new password is used (see
// reconcilePasswordAfterFirebaseReset). Vendors already have a Firebase account
// -- registerPersonal creates one at signup -- so the link reaches them and
// resetting once unlocks both this app and vendor web.
export const ForgotPasswordScreen = ({ navigation }: { navigation: any }) => {
  const [email, setEmail] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  const handleSubmit = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      Alert.alert('Email required', 'Enter the email address you sign in with.');
      return;
    }
    setSubmitting(true);
    try {
      await requestPasswordReset(trimmed);
      setSent(true);
    } catch (error: any) {
      // The endpoint answers 200 even for addresses with no account, so nothing
      // here is ever "no such user" -- it is a transport failure, the rate
      // limit, or a 503 saying delivery is not configured. The server's own
      // wording is shown so the last case is not dressed up as success.
      Alert.alert(
        'Could not send reset email',
        error?.response?.data?.error || 'Please check your connection and try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#ffffff' }}>
      <View style={{ alignItems: 'center', marginBottom: 40 }}>
        <Logo width={240} />
        <Typography variant="body" style={{ color: colors.navy, fontWeight: '700', marginTop: 8, letterSpacing: 2 }}>
          VENDOR PORTAL
        </Typography>
      </View>

      {sent ? (
        <View style={{ width: '100%' }}>
          {/* Phrased conditionally on purpose: the backend answers identically
              whether or not the address has an account, so that it cannot be
              used to discover who is registered. This screen must not claim
              more certainty than the response carries. */}
          <Typography variant="body" style={{ color: colors.navy, marginBottom: 12 }}>
            If an account exists for {email.trim()}, a password reset link has been sent to it.
            Check your inbox, including spam.
          </Typography>
          <Typography variant="caption" style={{ marginBottom: 24 }}>
            Open the link, set a new password, then sign in here with it.
          </Typography>
          <Button title="Back to Login" onPress={() => navigation.navigate('Login')} style={{ width: '100%' }} />
        </View>
      ) : (
        <View style={{ width: '100%' }}>
          <Typography variant="body" style={{ color: colors.navy, marginBottom: 16 }}>
            Enter the email address you sign in with and we'll send you a link to set a new password.
          </Typography>

          <Input
            label="Email Address"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            editable={!submitting}
          />

          <Button
            title="Send Reset Link"
            onPress={handleSubmit}
            loading={submitting}
            style={{ width: '100%', marginTop: 16, paddingVertical: 16 }}
          />

          <Button
            title="Back to Login"
            variant="outline"
            onPress={() => navigation.navigate('Login')}
            style={{ width: '100%', marginTop: 12 }}
          />
        </View>
      )}
    </View>
  );
};
