import React from 'react';
import { View, Text, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors, Button, Typography, Card, Input, requestPasswordReset } from '@mechbazar/shared';

// This screen has been wrong twice, in opposite directions.
//
// It began as a lie: handleSubmit only flipped a flag, and the UI then told the
// admin "a password reset link has been sent" for a mail nobody had sent. That
// was replaced with an honest dead end -- "resets aren't available here, use
// admin.mechbazar.com" -- which was true at the time, because this app signs in
// against the backend's bcrypt hash and the backend had no reset endpoint and
// no way to deliver a mail.
//
// It has one now. POST /auth/forgot-password hands delivery to Firebase, which
// holds the project's verified mail channel, and the login path reconciles the
// local hash the first time the new password is used (see
// reconcilePasswordAfterFirebaseReset). So a reset started here really does
// unlock this app, not just the web panel.
export const ForgotPasswordScreen = () => {
  const navigation = useNavigation<any>();
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
    } catch (err: any) {
      // The endpoint answers 200 even for unknown addresses, so nothing here is
      // ever "no such user" -- it is a transport failure, the rate limit, or a
      // 503 saying delivery is not configured. Show the server's own wording in
      // that last case rather than inventing a friendlier one that would imply
      // the mail is on its way.
      Alert.alert(
        'Could not send reset email',
        err?.response?.data?.error || 'Please check your connection and try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.background }}>
      <Card variant="elevated" style={{ padding: 32 }}>
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <Text style={{ fontSize: 24, fontWeight: '900', color: colors.text }}>Forgot Password</Text>
        </View>

        {sent ? (
          <View>
            {/* Deliberately conditional. The backend cannot tell us whether the
                address exists without becoming an account-enumeration oracle,
                so this screen must not claim it knows either. */}
            <Typography variant="body" style={{ color: colors.textSecondary, marginBottom: 12 }}>
              If an account exists for {email.trim()}, a password reset link has been sent to it.
              Check your inbox, including spam.
            </Typography>
            <Typography variant="caption" style={{ marginBottom: 20 }}>
              Open the link, set a new password, then sign in here with it.
            </Typography>
            <Button title="Back to Sign In" onPress={() => navigation.navigate('Login')} style={{ width: '100%' }} />
          </View>
        ) : (
          <View>
            <Typography variant="body" style={{ color: colors.textSecondary, marginBottom: 16 }}>
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
              style={{ width: '100%', marginTop: 8 }}
            />

            <Typography variant="caption" style={{ marginTop: 16 }}>
              Already signed in? You can change your password from Settings.
            </Typography>

            <Button
              title="Back to Sign In"
              variant="outline"
              onPress={() => navigation.navigate('Login')}
              style={{ width: '100%', marginTop: 12 }}
            />
          </View>
        )}
      </Card>
    </View>
  );
};
