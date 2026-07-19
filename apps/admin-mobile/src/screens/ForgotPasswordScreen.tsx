import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors, Button, Typography, Input, Card } from '@mechbazar/shared';

// Mirrors apps/admin/src/pages/ForgotPassword.tsx exactly: no real backend
// call exists on the web side either ("Simulate API call") — this is the
// same fake-success UX, not a shortcut taken only on mobile.
export const ForgotPasswordScreen = () => {
  const navigation = useNavigation<any>();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!email) return;
    setSubmitted(true);
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.background }}>
      <Card variant="elevated" style={{ padding: 32 }}>
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <Text style={{ fontSize: 24, fontWeight: '900', color: colors.text }}>Forgot Password</Text>
        </View>

        {submitted ? (
          <View>
            <View style={{ backgroundColor: '#E8F6EE', borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <Typography variant="body" style={{ color: colors.success }}>
                If an account exists for {email}, a password reset link has been sent.
              </Typography>
            </View>
            <Button title="Back to Sign In" onPress={() => navigation.navigate('Login')} style={{ width: '100%' }} />
          </View>
        ) : (
          <View>
            <Typography variant="body" style={{ color: colors.textSecondary, marginBottom: 16 }}>
              Enter your email address and we'll send you a link to reset your password.
            </Typography>
            <Input
              label="Email Address"
              placeholder="admin@mechbazar.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              containerStyle={{ marginBottom: 16 }}
            />
            <Button title="Send Reset Link" onPress={handleSubmit} style={{ width: '100%' }} />
            <Text
              style={{ color: colors.primary, fontWeight: '600', textAlign: 'center', marginTop: 16 }}
              onPress={() => navigation.navigate('Login')}
            >
              Back to Sign In
            </Text>
          </View>
        )}
      </Card>
    </View>
  );
};
