import React, { useState } from 'react';
import { View, ScrollView, Alert, Text } from 'react-native';
import { useDispatch } from 'react-redux';
import * as SecureStore from 'expo-secure-store';
import { colors, Button, Typography, Input, vendorService } from '@mechbazar/shared';
import { setAuth } from '../../store';

// Step 1 of the vendor onboarding flow -- creates the account (mirrors web
// Register.tsx's "personal" step) and authenticates. The remaining steps
// (business/bank/documents/submit) happen in OnboardingWizard, reached
// automatically once RootNavigator sees an authenticated vendor whose
// status isn't APPROVED yet.
export const RegisterScreen = ({ navigation }: { navigation: any }) => {
  const dispatch = useDispatch();
  const [form, setForm] = useState({ name: '', phone: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    const phone = form.phone.replace(/\D/g, '');
    if (!form.name.trim()) {
      Alert.alert('Error', 'Please enter your full name');
      return;
    }
    if (phone.length < 10) {
      Alert.alert('Error', 'Please enter a valid 10-digit phone number');
      return;
    }
    if (!form.password || form.password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    try {
      setLoading(true);
      const data = await vendorService.register({
        name: form.name.trim(),
        phone,
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
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#ffffff' }} contentContainerStyle={{ padding: 24, paddingTop: 64 }}>
      <Typography variant="h2">Become a MechBazar Seller</Typography>
      <Typography variant="body" style={{ color: colors.textSecondary, marginTop: 8, marginBottom: 24 }}>
        Complete your profile to start selling products to thousands of customers.
      </Typography>

      <Input label="Full Name" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
      <Input label="Phone Number" keyboardType="phone-pad" value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v.replace(/\D/g, '').slice(0, 10) })} />
      <Input label="Email Address" autoCapitalize="none" keyboardType="email-address" value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} />
      <Input label="Password" secureTextEntry value={form.password} onChangeText={(v) => setForm({ ...form, password: v })} />

      <Button title="Continue to Business Details" onPress={handleRegister} loading={loading} style={{ marginTop: 16 }} />

      <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 24 }}>
        <Text style={{ color: colors.navy }}>Already have an account? </Text>
        <Text style={{ color: colors.primary, fontWeight: '700' }} onPress={() => navigation.navigate('Login')}>
          Login
        </Text>
      </View>
    </ScrollView>
  );
};
