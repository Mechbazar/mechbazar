import React from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import * as SecureStore from 'expo-secure-store';
import { colors, Typography, Card, Button, getApiBaseUrl } from '@mechbazar/shared';
import { RootState, logout } from '../store';

// apps/admin has no dedicated Settings page — this is the minimal, non-
// invented equivalent of the "Sign Out" button that already exists in its
// sidebar, plus a read-only view of the logged-in admin's own account info.
export const SettingsScreen = () => {
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await SecureStore.deleteItemAsync('token');
          dispatch(logout());
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Typography variant="h2" style={{ marginBottom: 16 }}>Settings</Typography>

      <Card>
        <View style={styles.row}><Typography variant="caption">Name</Typography><Typography variant="body">{user?.name || 'N/A'}</Typography></View>
        <View style={styles.row}><Typography variant="caption">Email</Typography><Typography variant="body">{user?.email || 'N/A'}</Typography></View>
        <View style={[styles.row, { borderBottomWidth: 0 }]}><Typography variant="caption">Role</Typography><Typography variant="body">{user?.role || 'N/A'}</Typography></View>
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Typography variant="caption">Backend</Typography>
        <Typography variant="body" style={{ marginTop: 4 }}>{getApiBaseUrl()}</Typography>
      </Card>

      <Button title="Sign Out" onPress={handleLogout} style={{ backgroundColor: colors.danger, marginTop: 24 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
});
