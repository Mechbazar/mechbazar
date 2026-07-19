import React from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import * as SecureStore from 'expo-secure-store';
import { colors, Typography, Card, Button, Loader, technicianService } from '@mechbazar/shared';
import { logout } from '../store';

export const ProfileScreen = () => {
  const dispatch = useDispatch();

  const { data: profile, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['technician-profile'],
    queryFn: technicianService.getProfile,
  });

  const handleLogout = async () => {
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

  if (isLoading && !isRefetching) return <Loader fullScreen />;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
    >
      <View style={styles.header}>
        <View style={styles.avatarPlaceholder}>
          <Typography variant="h2" style={{ color: '#ffffff' }}>{profile?.user?.name?.charAt(0) || 'M'}</Typography>
        </View>
        <Typography variant="h2" style={{ marginTop: 16 }}>{profile?.user?.name}</Typography>
        <Typography variant="body" style={{ color: colors.textSecondary }}>{profile?.user?.phone}</Typography>
      </View>

      <View style={{ padding: 16 }}>
        <Card style={{ marginBottom: 24 }}>
          <View style={styles.detailRow}>
            <Typography variant="caption" style={{ color: colors.textSecondary }}>Specializations</Typography>
            <Typography variant="body">{(profile?.specializations || []).join(', ') || 'N/A'}</Typography>
          </View>
          <View style={styles.detailRow}>
            <Typography variant="caption" style={{ color: colors.textSecondary }}>Skills</Typography>
            <Typography variant="body">{(profile?.skills || []).join(', ') || 'N/A'}</Typography>
          </View>
          <View style={styles.detailRow}>
            <Typography variant="caption" style={{ color: colors.textSecondary }}>Experience</Typography>
            <Typography variant="body">{profile?.experienceYears != null ? `${profile.experienceYears} yrs` : 'N/A'}</Typography>
          </View>
          <View style={styles.detailRow}>
            <Typography variant="caption" style={{ color: colors.textSecondary }}>Rating</Typography>
            <Typography variant="body">{profile?.rating != null ? Number(profile.rating).toFixed(1) : 'N/A'}</Typography>
          </View>
          <View style={styles.detailRow}>
            <Typography variant="caption" style={{ color: colors.textSecondary }}>Total Jobs</Typography>
            <Typography variant="body">{profile?.totalJobs ?? 0}</Typography>
          </View>
          <View style={styles.detailRow}>
            <Typography variant="caption" style={{ color: colors.textSecondary }}>Status</Typography>
            <Typography variant="body" style={{ color: profile?.isActive ? colors.success : colors.danger }}>
              {profile?.isActive ? 'Active' : 'Disabled by admin'}
            </Typography>
          </View>
          <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
            <Typography variant="caption" style={{ color: colors.textSecondary }}>Email</Typography>
            <Typography variant="body">{profile?.user?.email || 'N/A'}</Typography>
          </View>
        </Card>

        <Button title="Sign Out" onPress={handleLogout} style={{ backgroundColor: colors.danger }} />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { alignItems: 'center', padding: 32, backgroundColor: colors.surfaceHover },
  avatarPlaceholder: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
});
