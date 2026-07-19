import React, { useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert, Modal, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { colors, Typography, Card, Button, Input, Badge, Loader, adminService } from '@mechbazar/shared';
import { Bike, Truck, Car } from 'lucide-react-native';

const TABS = ['ALL', 'ONLINE', 'OFFLINE'] as const;
const KYC_REVIEWABLE = new Set(['PENDING', 'UNDER_VERIFICATION', 'RESUBMISSION_REQUIRED']);
const kycBadgeVariant = (status: string): 'success' | 'warning' | 'danger' | 'secondary' => {
  if (status === 'APPROVED') return 'success';
  if (status === 'PENDING' || status === 'UNDER_VERIFICATION' || status === 'RESUBMISSION_REQUIRED') return 'warning';
  if (!status) return 'secondary';
  return 'danger';
};

const emptyForm = { id: '', name: '', phone: '', email: '', city: '', vehicleType: '', licenseNumber: '', isActive: true, isOnline: false };

const vehicleIcon = (vehicleType?: string) => {
  const v = (vehicleType || '').toLowerCase();
  if (v.includes('bike') || v.includes('scooter')) return Bike;
  if (v.includes('truck') || v.includes('tempo')) return Truck;
  return Car;
};

// Mirrors apps/admin/src/pages/Riders.tsx exactly, including its client-side
// validateForm(): 10-digit phone, optional-but-validated email, required
// city/vehicleType, license-number format, and duplicate phone/email
// pre-checks against the already-loaded rider list. Phone is locked on edit,
// same as the web form.
export const RidersScreen = () => {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number]>('ALL');
  const [search, setSearch] = useState('');
  const [formVisible, setFormVisible] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const isEditing = !!form.id;

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['admin-riders'],
    queryFn: adminService.getRiders,
  });

  const riders = data || [];
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-riders'] });

  const saveMutation = useMutation({
    mutationFn: (payload: any) => (isEditing ? adminService.updateRider(form.id, payload) : adminService.createRider(payload)),
    onSuccess: () => {
      invalidate();
      closeForm();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error || 'Failed to save rider';
      setFormError(msg);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => adminService.updateRider(id, payload),
    onSuccess: invalidate,
    onError: () => Alert.alert('Error', 'Failed to update rider'),
  });

  const filtered = useMemo(() => {
    return riders.filter((r: any) => {
      if (tab === 'ONLINE' && !r.deliveryProfile?.isOnline) return false;
      if (tab === 'OFFLINE' && r.deliveryProfile?.isOnline) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !r.name?.toLowerCase().includes(q) &&
          !r.phone?.toLowerCase().includes(q) &&
          !r.deliveryProfile?.vehicleType?.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [riders, tab, search]);

  const closeForm = () => {
    setFormVisible(false);
    setForm(emptyForm);
    setFieldErrors({});
    setFormError('');
  };

  const openEdit = (r: any) => {
    setForm({
      id: r.id,
      name: r.name || '',
      phone: r.phone || '',
      email: r.email || '',
      city: r.city || '',
      vehicleType: r.deliveryProfile?.vehicleType || '',
      licenseNumber: r.deliveryProfile?.licenseNumber || '',
      isActive: r.deliveryProfile?.isActive !== false,
      isOnline: !!r.deliveryProfile?.isOnline,
    });
    setFieldErrors({});
    setFormError('');
    setFormVisible(true);
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    const normalizedPhone = form.phone.replace(/\D/g, '');
    const name = form.name.trim();
    const city = form.city.trim();
    const vehicleType = form.vehicleType.trim().toUpperCase();
    const licenseNumber = form.licenseNumber.trim().toUpperCase();

    if (!name) errors.name = 'Name is required';
    if (!/^\d{10}$/.test(normalizedPhone)) errors.phone = 'Phone must be exactly 10 digits';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Invalid email format';
    if (!city) errors.city = 'City is required';
    if (!vehicleType) errors.vehicleType = 'Vehicle type is required';
    if (!/^[A-Z0-9-]{6,15}$/.test(licenseNumber)) errors.licenseNumber = 'License number must be 6-15 characters (letters, numbers, hyphens)';

    const duplicatePhone = riders.some((r: any) => r.id !== form.id && r.phone === normalizedPhone);
    if (duplicatePhone) errors.phone = 'A rider with this phone number already exists';
    if (form.email) {
      const duplicateEmail = riders.some((r: any) => r.id !== form.id && r.email === form.email);
      if (duplicateEmail) errors.email = 'A rider with this email already exists';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = () => {
    setFormError('');
    if (!validate()) return;

    const payload: any = {
      name: form.name.trim(),
      phone: form.phone.replace(/\D/g, ''),
      email: form.email.trim() || undefined,
      city: form.city.trim(),
      vehicleType: form.vehicleType.trim().toUpperCase(),
      licenseNumber: form.licenseNumber.trim().toUpperCase(),
    };
    if (isEditing) {
      payload.isActive = form.isActive;
      payload.isOnline = form.isOnline;
    }
    saveMutation.mutate(payload);
  };

  const handleToggleActive = (rider: any) => {
    toggleMutation.mutate({
      id: rider.id,
      payload: {
        name: rider.name,
        phone: rider.phone,
        email: rider.email,
        city: rider.city,
        vehicleType: rider.deliveryProfile?.vehicleType,
        licenseNumber: rider.deliveryProfile?.licenseNumber,
        isActive: !(rider.deliveryProfile?.isActive !== false),
        isOnline: rider.deliveryProfile?.isOnline,
      },
    });
  };

  if (isLoading && !isRefetching) return <Loader fullScreen />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Typography variant="h2">Riders</Typography>
        <Button title="Add New" size="sm" onPress={() => { setForm(emptyForm); setFieldErrors({}); setFormError(''); setFormVisible(true); }} />
      </View>

      <View style={{ paddingHorizontal: 16 }}>
        <Input placeholder="Search name, phone, vehicle..." value={search} onChangeText={setSearch} />
      </View>

      <View style={styles.tabRow}>
        {TABS.map((t) => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Typography variant="caption" style={{ color: tab === t ? '#fff' : colors.textSecondary, fontWeight: '600' }}>{t}</Typography>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<Typography variant="body" style={{ textAlign: 'center', marginTop: 20, color: colors.textSecondary }}>No riders found.</Typography>}
        renderItem={({ item }) => {
          const Icon = vehicleIcon(item.deliveryProfile?.vehicleType);
          const isActive = item.deliveryProfile?.isActive !== false;
          const kycStatus = item.deliveryProfile?.status;
          return (
            <Card style={styles.card}>
              <View style={{ flexDirection: 'row' }}>
                <View style={styles.iconWrap}><Icon color={colors.navy} size={20} /></View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Typography variant="h3">{item.name}</Typography>
                  <Typography variant="caption">{item.phone} • {item.deliveryProfile?.vehicleType || 'N/A'}</Typography>
                </View>
                <Badge label={item.deliveryProfile?.isOnline ? 'Online' : 'Offline'} variant={item.deliveryProfile?.isOnline ? 'success' : 'secondary'} size="sm" />
              </View>

              {!!kycStatus && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                  <Typography variant="caption" style={{ color: colors.textSecondary }}>KYC Status</Typography>
                  <Badge label={kycStatus.replace(/_/g, ' ')} variant={kycBadgeVariant(kycStatus)} size="sm" />
                </View>
              )}

              {KYC_REVIEWABLE.has(kycStatus) && (
                <Button
                  title="Review KYC Application"
                  variant="outline"
                  size="sm"
                  onPress={() => navigation.navigate('RiderDetail', { riderId: item.id })}
                  style={{ marginTop: 10 }}
                />
              )}

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                <TouchableOpacity onPress={() => openEdit(item)}>
                  <Typography variant="body" style={{ color: colors.navy, fontWeight: '600' }}>Edit</Typography>
                </TouchableOpacity>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Typography variant="caption">{isActive ? 'Enabled' : 'Disabled'}</Typography>
                  <Switch value={isActive} onValueChange={() => handleToggleActive(item)} trackColor={{ false: colors.border, true: colors.success }} />
                </View>
              </View>
            </Card>
          );
        }}
      />

      <Modal visible={formVisible} animationType="slide" presentationStyle="formSheet">
        <ScrollView style={styles.modalContainer} contentContainerStyle={{ padding: 24 }}>
          <Typography variant="h2" style={{ marginBottom: 16 }}>{isEditing ? 'Edit Rider' : 'Add Rider'}</Typography>

          {!!formError && (
            <View style={{ backgroundColor: '#FDECEA', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <Typography variant="caption" style={{ color: colors.dangerStrong }}>{formError}</Typography>
            </View>
          )}

          <Input label="Name" value={form.name} onChangeText={(t) => { setForm({ ...form, name: t }); setFieldErrors({ ...fieldErrors, name: '' }); }} error={fieldErrors.name} containerStyle={{ marginBottom: 12 }} />
          <Input
            label="Phone (10 digits)"
            value={form.phone}
            onChangeText={(t) => { setForm({ ...form, phone: t.replace(/\D/g, '').slice(0, 10) }); setFieldErrors({ ...fieldErrors, phone: '' }); }}
            keyboardType="phone-pad"
            editable={!isEditing}
            error={fieldErrors.phone}
            containerStyle={{ marginBottom: 12 }}
          />
          <Input label="Email (optional)" value={form.email} onChangeText={(t) => { setForm({ ...form, email: t }); setFieldErrors({ ...fieldErrors, email: '' }); }} keyboardType="email-address" autoCapitalize="none" error={fieldErrors.email} containerStyle={{ marginBottom: 12 }} />
          <Input label="City" value={form.city} onChangeText={(t) => { setForm({ ...form, city: t }); setFieldErrors({ ...fieldErrors, city: '' }); }} error={fieldErrors.city} containerStyle={{ marginBottom: 12 }} />
          <Input label="Vehicle Type" value={form.vehicleType} onChangeText={(t) => { setForm({ ...form, vehicleType: t }); setFieldErrors({ ...fieldErrors, vehicleType: '' }); }} error={fieldErrors.vehicleType} containerStyle={{ marginBottom: 12 }} />
          <Input label="License Number" value={form.licenseNumber} onChangeText={(t) => { setForm({ ...form, licenseNumber: t }); setFieldErrors({ ...fieldErrors, licenseNumber: '' }); }} autoCapitalize="characters" error={fieldErrors.licenseNumber} containerStyle={{ marginBottom: 12 }} />

          {isEditing && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Typography variant="body">Enabled</Typography>
              <Switch value={form.isActive} onValueChange={(v) => setForm({ ...form, isActive: v })} trackColor={{ false: colors.border, true: colors.success }} />
            </View>
          )}

          <Button title="Save Rider" onPress={handleSave} loading={saveMutation.isPending} style={{ marginTop: 8 }} />
          <Button title="Cancel" variant="outline" onPress={closeForm} style={{ marginTop: 8 }} />
        </ScrollView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 8 },
  tabRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginTop: 12, marginBottom: 4 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', backgroundColor: colors.surfaceHover },
  tabActive: { backgroundColor: colors.primary },
  card: { marginBottom: 12 },
  iconWrap: { width: 40, height: 40, borderRadius: 8, backgroundColor: colors.surfaceHover, justifyContent: 'center', alignItems: 'center' },
  modalContainer: { flex: 1, backgroundColor: colors.background },
});
