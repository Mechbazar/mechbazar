import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import { colors, Typography, Card, Button, Input, vendorService, Loader } from '@mechbazar/shared';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import { logout } from '../store';
import * as SecureStore from 'expo-secure-store';

export const ProfileScreen = () => {
  const queryClient = useQueryClient();
  const dispatch = useDispatch();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ storeName: '', panNumber: '', gstNumber: '' });

  const { data: profile, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['vendor-profile'],
    queryFn: vendorService.getProfile,
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => vendorService.updateProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-profile'] });
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated');
    },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.message || err.message)
  });

  const handleEdit = () => {
    setEditForm({
      storeName: profile?.storeName || '',
      panNumber: profile?.panNumber || '',
      gstNumber: profile?.gstNumber || ''
    });
    setIsEditing(true);
  };

  const handleSave = () => {
    updateMutation.mutate(editForm);
  };

  const handleLogout = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => {
        await SecureStore.deleteItemAsync('token');
        dispatch(logout());
      }}
    ]);
  };

  if (isLoading && !isRefetching) return <Loader size="large" style={{flex:1, backgroundColor: colors.background}} />;

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
    >
      <View style={styles.header}>
        <View style={styles.avatarPlaceholder}>
          <Typography variant="h2" style={{color: '#000'}}>{profile?.storeName?.charAt(0) || 'S'}</Typography>
        </View>
        <Typography variant="h2" style={{marginTop: 16}}>{profile?.storeName}</Typography>
        <Typography variant="body" style={{color: colors.textSecondary}}>{profile?.user?.email}</Typography>
      </View>

      <View style={{padding: 16}}>
        <Card style={{marginBottom: 24}}>
          {isEditing ? (
            <View>
              <Input label="Store Name" value={editForm.storeName} onChangeText={t => setEditForm({...editForm, storeName: t})} />
              <Input label="PAN Number" value={editForm.panNumber} onChangeText={t => setEditForm({...editForm, panNumber: t})} />
              <Input label="GST Number" value={editForm.gstNumber} onChangeText={t => setEditForm({...editForm, gstNumber: t})} />
              
              <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 16}}>
                <Button title="Cancel" variant="outline" onPress={() => setIsEditing(false)} style={{flex: 1, marginRight: 8}} />
                <Button title="Save" onPress={handleSave} loading={updateMutation.isPending} style={{flex: 1, marginLeft: 8}} />
              </View>
            </View>
          ) : (
            <View>
              <View style={styles.detailRow}>
                <Typography variant="caption" style={{color: colors.textSecondary}}>Phone</Typography>
                <Typography variant="body">{profile?.user?.phone || 'N/A'}</Typography>
              </View>
              <View style={styles.detailRow}>
                <Typography variant="caption" style={{color: colors.textSecondary}}>PAN Number</Typography>
                <Typography variant="body">{profile?.panNumber || 'N/A'}</Typography>
              </View>
              <View style={styles.detailRow}>
                <Typography variant="caption" style={{color: colors.textSecondary}}>GST Number</Typography>
                <Typography variant="body">{profile?.gstNumber || 'N/A'}</Typography>
              </View>
              <View style={styles.detailRow}>
                <Typography variant="caption" style={{color: colors.textSecondary}}>Status</Typography>
                <Typography variant="body" style={{color: profile?.status === 'APPROVED' ? colors.success : colors.warning}}>{profile?.status}</Typography>
              </View>
              
              <Button title="Edit Profile" onPress={handleEdit} variant="outline" style={{marginTop: 16}} />
            </View>
          )}
        </Card>

        <Button title="Sign Out" onPress={handleLogout} style={{backgroundColor: colors.danger}} />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { alignItems: 'center', padding: 32, backgroundColor: colors.surfaceHover },
  avatarPlaceholder: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }
});
