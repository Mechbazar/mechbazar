import React, { useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert, Modal, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { colors, Typography, Card, Button, Input, Badge, Loader, adminService } from '@mechbazar/shared';
import { Wrench, Phone } from 'lucide-react-native';

const TABS = ['ALL', 'ONLINE', 'OFFLINE'] as const;
const KYC_REVIEWABLE = new Set(['PENDING', 'UNDER_VERIFICATION', 'RESUBMISSION_REQUIRED']);
const kycBadgeVariant = (status: string): 'success' | 'warning' | 'danger' | 'secondary' => {
  if (status === 'APPROVED') return 'success';
  if (status === 'PENDING' || status === 'UNDER_VERIFICATION' || status === 'RESUBMISSION_REQUIRED') return 'warning';
  if (!status) return 'secondary';
  return 'danger';
};

const emptyForm = { id: '', name: '', phone: '', email: '', city: '', state: '', specializations: ['CAR', 'BIKE'] as string[], skills: '', experienceYears: '', isActive: true, isOnline: false };

// Mirrors apps/admin/src/pages/services/Technicians.tsx exactly, including its
// client-side validateForm(): 10-digit phone, optional-but-validated email,
// required name, at-least-one specialization. Phone is locked on edit, same
// as the web form. Same list/detail split as RidersScreen.tsx/RiderDetailScreen.tsx.
export const TechniciansScreen = () => {
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
    queryKey: ['admin-technicians'],
    queryFn: adminService.getTechnicians,
  });

  const technicians = data || [];
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-technicians'] });

  const saveMutation = useMutation({
    mutationFn: (payload: any) => (isEditing ? adminService.updateTechnician(form.id, payload) : adminService.createTechnician(payload)),
    onSuccess: () => { invalidate(); closeForm(); },
    onError: (err: any) => setFormError(err.response?.data?.error || 'Failed to save technician'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => adminService.updateTechnician(id, payload),
    onSuccess: invalidate,
    onError: () => Alert.alert('Error', 'Failed to update technician'),
  });

  const filtered = useMemo(() => {
    return technicians.filter((t: any) => {
      if (tab === 'ONLINE' && !t.technicianProfile?.isOnline) return false;
      if (tab === 'OFFLINE' && t.technicianProfile?.isOnline) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !t.name?.toLowerCase().includes(q) &&
          !t.phone?.toLowerCase().includes(q) &&
          !(t.technicianProfile?.skills || []).some((sk: string) => sk.toLowerCase().includes(q))
        ) return false;
      }
      return true;
    });
  }, [technicians, tab, search]);

  const closeForm = () => {
    setFormVisible(false);
    setForm(emptyForm);
    setFieldErrors({});
    setFormError('');
  };

  const openEdit = (t: any) => {
    setForm({
      id: t.id,
      name: t.name || '',
      phone: t.phone || '',
      email: t.email || '',
      city: t.city || '',
      state: t.state || '',
      specializations: t.technicianProfile?.specializations || [],
      skills: (t.technicianProfile?.skills || []).join(', '),
      experienceYears: t.technicianProfile?.experienceYears != null ? String(t.technicianProfile.experienceYears) : '',
      isActive: t.technicianProfile?.isActive ?? true,
      isOnline: t.technicianProfile?.isOnline ?? false,
    });
    setFieldErrors({});
    setFormError('');
    setFormVisible(true);
  };

  const toggleSpecialization = (type: string) => {
    setForm((prev) => ({
      ...prev,
      specializations: prev.specializations.includes(type)
        ? prev.specializations.filter((s) => s !== type)
        : [...prev.specializations, type],
    }));
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    const name = form.name.trim();
    const normalizedPhone = form.phone.replace(/\D/g, '');
    const email = form.email.trim().toLowerCase();

    if (!name) errors.name = 'Name is required';
    if (!/^\d{10}$/.test(normalizedPhone)) errors.phone = 'Phone must be exactly 10 digits';
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address';
    if (form.specializations.length === 0) errors.specializations = 'Select at least one vehicle specialization';

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = () => {
    setFormError('');
    if (!validate()) return;

    const payload: any = {
      name: form.name.trim(),
      phone: form.phone.replace(/\D/g, ''),
      email: form.email.trim().toLowerCase() || undefined,
      city: form.city.trim(),
      state: form.state.trim(),
      specializations: form.specializations,
      skills: form.skills.split(',').map((s) => s.trim()).filter(Boolean),
      experienceYears: form.experienceYears ? Number(form.experienceYears) : null,
    };
    if (isEditing) {
      payload.isActive = form.isActive;
      payload.isOnline = form.isOnline;
    }
    saveMutation.mutate(payload);
  };

  // Sends the full technician record with only the active flag flipped --
  // mirrors Technicians.tsx (web)'s handleToggleStatus exactly, since the
  // backend's partial update isn't undefined-guarded.
  const handleToggleActive = (technician: any) => {
    toggleMutation.mutate({
      id: technician.id,
      payload: {
        ...technician,
        specializations: technician.technicianProfile?.specializations,
        skills: technician.technicianProfile?.skills,
        experienceYears: technician.technicianProfile?.experienceYears,
        isOnline: technician.technicianProfile?.isOnline,
        isActive: !technician.technicianProfile?.isActive,
      },
    });
  };

  if (isLoading && !isRefetching) return <Loader fullScreen />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Typography variant="h2">Technicians</Typography>
        <Button title="Add New" size="sm" onPress={() => { setForm(emptyForm); setFieldErrors({}); setFormError(''); setFormVisible(true); }} />
      </View>

      <View style={{ paddingHorizontal: 16 }}>
        <Input placeholder="Search name, phone, skill..." value={search} onChangeText={setSearch} />
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
        ListEmptyComponent={<Typography variant="body" style={{ textAlign: 'center', marginTop: 20, color: colors.textSecondary }}>No technicians found.</Typography>}
        renderItem={({ item }) => {
          const isActive = item.technicianProfile?.isActive !== false;
          const kycStatus = item.technicianProfile?.status;
          return (
            <Card style={styles.card}>
              <View style={{ flexDirection: 'row' }}>
                <View style={styles.iconWrap}><Wrench color={colors.navy} size={20} /></View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Typography variant="h3">{item.name || 'Unnamed Technician'}</Typography>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                    <Phone color={colors.textSecondary} size={12} />
                    <Typography variant="caption" style={{ marginLeft: 4 }}>{item.phone} • {(item.technicianProfile?.specializations || []).join(', ') || 'N/A'}</Typography>
                  </View>
                </View>
                <Badge label={item.technicianProfile?.isOnline ? 'Online' : 'Offline'} variant={item.technicianProfile?.isOnline ? 'success' : 'secondary'} size="sm" />
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                <Typography variant="caption" style={{ color: colors.textSecondary }}>Rating</Typography>
                <Typography variant="caption">★ {(item.technicianProfile?.rating || 0).toFixed(1)} ({item.technicianProfile?.totalJobs || 0} jobs)</Typography>
              </View>

              {!!kycStatus && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                  <Typography variant="caption" style={{ color: colors.textSecondary }}>KYC Status</Typography>
                  <Badge label={kycStatus.replace(/_/g, ' ')} variant={kycBadgeVariant(kycStatus)} size="sm" />
                </View>
              )}

              {KYC_REVIEWABLE.has(kycStatus) && (
                <Button
                  title="Review KYC Application"
                  variant="outline"
                  size="sm"
                  onPress={() => navigation.navigate('TechnicianDetail', { technicianId: item.id })}
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
          <Typography variant="h2" style={{ marginBottom: 16 }}>{isEditing ? 'Edit Technician' : 'Add Technician'}</Typography>

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
          <Input label="City" value={form.city} onChangeText={(t) => setForm({ ...form, city: t })} containerStyle={{ marginBottom: 12 }} />
          <Input label="State" value={form.state} onChangeText={(t) => setForm({ ...form, state: t })} containerStyle={{ marginBottom: 12 }} />

          <Typography variant="caption" style={{ marginBottom: 8 }}>Vehicle Specializations</Typography>
          <View style={styles.chipRow}>
            {['CAR', 'BIKE'].map((v) => (
              <TouchableOpacity key={v} style={[styles.chip, form.specializations.includes(v) && styles.chipActive]} onPress={() => toggleSpecialization(v)}>
                <Typography variant="caption" style={{ color: form.specializations.includes(v) ? '#fff' : colors.text }}>{v}</Typography>
              </TouchableOpacity>
            ))}
          </View>
          {!!fieldErrors.specializations && <Typography variant="caption" style={{ color: colors.dangerStrong, marginTop: 4 }}>{fieldErrors.specializations}</Typography>}

          <Input label="Skills (comma separated)" value={form.skills} onChangeText={(t) => setForm({ ...form, skills: t })} containerStyle={{ marginTop: 12, marginBottom: 12 }} placeholder="e.g. Battery, Brakes, AC Repair" />
          <Input label="Years of Experience" value={form.experienceYears} onChangeText={(t) => setForm({ ...form, experienceYears: t.replace(/\D/g, '') })} keyboardType="number-pad" containerStyle={{ marginBottom: 12 }} />

          {isEditing && (
            <>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Typography variant="body">Account Active</Typography>
                <Switch value={form.isActive} onValueChange={(v) => setForm({ ...form, isActive: v })} trackColor={{ false: colors.border, true: colors.success }} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Typography variant="body">Mark as Online</Typography>
                <Switch value={form.isOnline} onValueChange={(v) => setForm({ ...form, isOnline: v })} trackColor={{ false: colors.border, true: colors.success }} />
              </View>
            </>
          )}

          <Button title="Save Technician" onPress={handleSave} loading={saveMutation.isPending} style={{ marginTop: 8 }} />
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
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: colors.surfaceHover },
  chipActive: { backgroundColor: colors.primary },
});
