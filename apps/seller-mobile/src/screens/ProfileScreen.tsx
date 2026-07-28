import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { colors, Typography, Card, Button, Input, vendorService, geocodeService, Loader } from '@mechbazar/shared';
import type { GeocodeSuccess } from '@mechbazar/shared';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { logout } from '../store';
import * as SecureStore from 'expo-secure-store';
import { MapPin } from 'lucide-react-native';
import { getCurrentLocation } from '../services/location.service';
import AddressMapPicker from '../components/maps/AddressMapPicker';
import PlaceAutocompleteField from '../components/maps/PlaceAutocompleteField';

const emptyEditForm = {
  storeName: '', panNumber: '', gstNumber: '',
  addressLine1: '', addressLine2: '', city: '', state: '', pincode: '',
  country: null as string | null, lat: null as number | null, lng: null as number | null,
  placeId: null as string | null, formattedAddress: null as string | null,
};

export const ProfileScreen = () => {
  const queryClient = useQueryClient();
  const dispatch = useDispatch();
  const navigation = useNavigation<any>();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [locating, setLocating] = useState(false);

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
      gstNumber: profile?.gstNumber || '',
      addressLine1: profile?.addressLine1 || '',
      addressLine2: profile?.addressLine2 || '',
      city: profile?.city || profile?.user?.city || '',
      state: profile?.state || profile?.user?.state || '',
      pincode: profile?.pincode || '',
      country: profile?.country || null,
      lat: profile?.lat ?? null,
      lng: profile?.lng ?? null,
      placeId: profile?.placeId || null,
      formattedAddress: profile?.formattedAddress || null,
    });
    setIsEditing(true);
  };

  const handleSave = () => {
    updateMutation.mutate(editForm);
  };

  // Shared by "use my current location", pin drag, and Places Autocomplete
  // selection -- syncs every field to the new location, including clearing a
  // field this result has no component for (see OnboardingWizard.tsx's
  // identical helper for the same rationale).
  const applyGeocodeResult = (result: GeocodeSuccess) => {
    setEditForm((f) => ({
      ...f,
      addressLine1: result.components.line1 || '',
      city: result.components.city || '',
      state: result.components.state || '',
      pincode: result.components.pincode || '',
      country: result.components.country || null,
      lat: result.lat,
      lng: result.lng,
      placeId: result.placeId,
      formattedAddress: result.formattedAddress,
    }));
  };

  const handleUseCurrentLocation = async () => {
    setLocating(true);
    try {
      const location = await getCurrentLocation();
      if (!location) {
        Alert.alert('Location unavailable', 'Location permission denied or unavailable.');
        return;
      }
      const result = await geocodeService.reverseGeocode(location.latitude, location.longitude);
      if (result.ok) {
        applyGeocodeResult(result);
      } else {
        setEditForm((f) => ({ ...f, lat: location.latitude, lng: location.longitude }));
      }
    } finally {
      setLocating(false);
    }
  };

  const handleMapPinChange = async (c: { latitude: number; longitude: number }) => {
    setEditForm((f) => ({ ...f, lat: c.latitude, lng: c.longitude }));
    const result = await geocodeService.reverseGeocode(c.latitude, c.longitude);
    if (result.ok) applyGeocodeResult(result);
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

              <Typography variant="body" style={{ fontWeight: '600', marginTop: 8 }}>Store Location</Typography>
              <TouchableOpacity style={styles.locationBtn} onPress={handleUseCurrentLocation} disabled={locating}>
                {locating ? <ActivityIndicator color={colors.primary} /> : (
                  <>
                    <MapPin size={16} color={colors.primary} />
                    <Typography variant="caption" style={{ color: colors.primary, fontWeight: '700', marginLeft: 6 }}>Use my current location</Typography>
                  </>
                )}
              </TouchableOpacity>
              <PlaceAutocompleteField onSelect={applyGeocodeResult} placeholder="Search for your store address" />
              <AddressMapPicker latitude={editForm.lat} longitude={editForm.lng} onChange={handleMapPinChange} height={180} />

              <Input label="Address Line 1" value={editForm.addressLine1} onChangeText={t => setEditForm({...editForm, addressLine1: t})} />
              <Input label="Address Line 2 (optional)" value={editForm.addressLine2} onChangeText={t => setEditForm({...editForm, addressLine2: t})} />
              <Input label="City" value={editForm.city} onChangeText={t => setEditForm({...editForm, city: t})} />
              <Input label="State" value={editForm.state} onChangeText={t => setEditForm({...editForm, state: t})} />
              <Input label="Pincode" keyboardType="number-pad" value={editForm.pincode} onChangeText={t => setEditForm({...editForm, pincode: t})} />

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
                <Typography variant="caption" style={{color: colors.textSecondary}}>Store Address</Typography>
                <Typography variant="body" style={{textAlign: 'right', flex: 1, marginLeft: 12}} numberOfLines={2}>
                  {profile?.formattedAddress || [profile?.addressLine1, profile?.city, profile?.state].filter(Boolean).join(', ') || 'N/A'}
                </Typography>
              </View>
              <View style={styles.detailRow}>
                <Typography variant="caption" style={{color: colors.textSecondary}}>Status</Typography>
                <Typography variant="body" style={{color: profile?.status === 'APPROVED' ? colors.success : colors.warning}}>{profile?.status}</Typography>
              </View>
              
              <Button title="Edit Profile" onPress={handleEdit} variant="outline" style={{marginTop: 16}} />
            </View>
          )}
        </Card>

        <Button
          title="Change Password"
          onPress={() => navigation.navigate('ChangePassword')}
          variant="outline"
          style={{marginBottom: 12}}
        />

        <Button title="Sign Out" onPress={handleLogout} style={{backgroundColor: colors.danger}} />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { alignItems: 'center', padding: 32, backgroundColor: colors.surfaceHover },
  avatarPlaceholder: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  locationBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceHover, borderRadius: 10, paddingVertical: 12, marginBottom: 12 },
});
