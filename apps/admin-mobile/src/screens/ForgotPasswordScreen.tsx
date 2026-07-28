import React from 'react';
import { View, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors, Button, Typography, Card } from '@mechbazar/shared';

// This screen used to claim "a password reset link has been sent" while doing
// nothing at all -- handleSubmit only flipped a flag. Its comment said it
// mirrored apps/admin's web version, which was true when both were fake, but
// the web one now really does call Firebase's sendPasswordResetEmail.
//
// This app cannot do the same. It signs in through POST /auth/admin/login's
// email+password path, which bcrypt-compares User.password, and the backend
// exposes no reset endpoint for that store -- there is no way from here to
// send a reset mail for the credential this app actually uses. Firebase would
// be the wrong door: it holds the *web* panel's password, so resetting it
// would not change this app's login.
//
// So it now says what is true and points at the one place a reset genuinely
// works, rather than showing a success message for an email nobody sends.
export const ForgotPasswordScreen = () => {
  const navigation = useNavigation<any>();

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.background }}>
      <Card variant="elevated" style={{ padding: 32 }}>
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <Text style={{ fontSize: 24, fontWeight: '900', color: colors.text }}>Forgot Password</Text>
        </View>

        <View>
          <Typography variant="body" style={{ color: colors.textSecondary, marginBottom: 12 }}>
            Password resets for the admin app aren't available on your phone yet.
          </Typography>
          <Typography variant="body" style={{ color: colors.textSecondary, marginBottom: 12 }}>
            Sign in at admin.mechbazar.com and use "Forgot password?" there to
            receive a reset email, or ask another administrator to reset it for
            you.
          </Typography>
          <Typography variant="caption" style={{ marginBottom: 20 }}>
            Already signed in? You can change your password from Settings.
          </Typography>

          <Button title="Back to Sign In" onPress={() => navigation.navigate('Login')} style={{ width: '100%' }} />
        </View>
      </Card>
    </View>
  );
};
