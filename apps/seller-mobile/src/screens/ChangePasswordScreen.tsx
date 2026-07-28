import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Eye, EyeOff } from 'lucide-react-native';
import { colors, Button, Typography, Input, Card, changePassword } from '@mechbazar/shared';

// The backend's own minimum (auth.controller.ts rejects anything shorter),
// checked here only to save a round trip.
const MIN_PASSWORD_LENGTH = 6;

function PasswordField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  const [reveal, setReveal] = useState(false);
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8 }}>{label}</Text>
      <View>
        <Input
          value={value}
          onChangeText={onChange}
          secureTextEntry={!reveal}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!disabled}
          style={{ paddingRight: 48 }}
        />
        <Pressable
          onPress={() => setReveal((v) => !v)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={reveal ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          style={{ position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' }}
        >
          {reveal ? <EyeOff size={20} color={colors.textSecondary} /> : <Eye size={20} color={colors.textSecondary} />}
        </Pressable>
      </View>
    </View>
  );
}

// This app signs in through POST /vendors/login's email+password path, which
// bcrypt-compares User.password -- NOT the Firebase credential the vendor
// *web* panel uses. So the change has to go through the backend endpoint;
// Firebase's updatePassword would leave this app's actual login untouched.
export const ChangePasswordScreen = () => {
  const navigation = useNavigation<any>();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setError('');

    if (!currentPassword) {
      setError('Enter your current password.');
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('New password must be different from your current one.');
      return;
    }

    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      Alert.alert('Password updated', 'Use your new password the next time you sign in.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      const status = err?.response?.status;
      // 401 is specifically "current password is wrong" here; the generic
      // handler would read as a session problem, which it is not.
      setError(
        status === 401
          ? 'Current password is incorrect.'
          : err?.response?.data?.error || 'Could not change password. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 16 }}>
      <Card variant="elevated" style={{ padding: 20 }}>
        <Typography variant="h2" style={{ marginBottom: 4 }}>Change Password</Typography>
        <Typography variant="caption" style={{ marginBottom: 20 }}>
          Must be at least {MIN_PASSWORD_LENGTH} characters.
        </Typography>

        {!!error && (
          <View style={{ backgroundColor: '#FDECEA', borderRadius: 8, padding: 12, marginBottom: 16 }}>
            <Typography variant="caption" style={{ color: colors.dangerStrong }}>{error}</Typography>
          </View>
        )}

        <PasswordField label="Current Password" value={currentPassword} onChange={setCurrentPassword} disabled={saving} />
        <PasswordField label="New Password" value={newPassword} onChange={setNewPassword} disabled={saving} />
        <PasswordField label="Confirm New Password" value={confirmPassword} onChange={setConfirmPassword} disabled={saving} />

        <Button
          title={saving ? 'Saving...' : 'Update Password'}
          onPress={handleSubmit}
          loading={saving}
          disabled={saving}
          style={{ width: '100%', marginTop: 8 }}
        />
      </Card>
    </ScrollView>
  );
};
