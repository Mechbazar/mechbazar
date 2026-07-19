import React, { useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert, Modal, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { colors, Typography, Card, Button, Input, Badge, Loader, adminService } from '@mechbazar/shared';

const emptyForm = { name: '', phone: '', email: '', city: '', state: '', storeName: '', gstNumber: '' };

const getStatusMeta = (status: string): { label: string; variant: 'success' | 'warning' | 'danger' | 'secondary' } => {
  switch (status) {
    case 'APPROVED':
      return { label: 'Approved', variant: 'success' };
    case 'PENDING':
    case 'UNDER_VERIFICATION':
      return { label: 'Needs Review', variant: 'warning' };
    case 'REJECTED':
      return { label: 'Rejected', variant: 'danger' };
    default:
      return { label: status, variant: 'secondary' };
  }
};

// Mirrors apps/admin/src/pages/Vendors.tsx's list + create; KYC review and
// editing existing vendors happens on the pushed VendorDetailScreen (that
// web page's "loadError" banner pattern for a failed fetch is unique to
// Vendors.tsx and is reproduced here too).
export const VendorsScreen = () => {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [formVisible, setFormVisible] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading, refetch, isRefetching, isError } = useQuery({
    queryKey: ['admin-vendors'],
    queryFn: adminService.getVendors,
  });

  const vendors = data || [];

  const createMutation = useMutation({
    mutationFn: (payload: any) => adminService.createVendor(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-vendors'] });
      setFormVisible(false);
      setForm(emptyForm);
    },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.error || 'Failed to create vendor'),
  });

  const filtered = useMemo(() => {
    if (!search) return vendors;
    const q = search.toLowerCase();
    return vendors.filter((v: any) =>
      v.name?.toLowerCase().includes(q) || v.vendorProfile?.storeName?.toLowerCase().includes(q) || v.phone?.toLowerCase().includes(q)
    );
  }, [vendors, search]);

  const handleCreate = () => {
    if (!form.name.trim() || !form.phone.trim()) {
      Alert.alert('Error', 'Name and phone are required.');
      return;
    }
    createMutation.mutate(form);
  };

  if (isLoading && !isRefetching) return <Loader fullScreen />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Typography variant="h2">Vendors</Typography>
        <Button title="Add New" size="sm" onPress={() => { setForm(emptyForm); setFormVisible(true); }} />
      </View>

      {isError && (
        <Card style={{ marginHorizontal: 16, marginBottom: 8, backgroundColor: '#FDECEA' }}>
          <Typography variant="caption" style={{ color: colors.dangerStrong }}>
            Could not load vendors. Please sign out and sign in again.
          </Typography>
        </Card>
      )}

      <View style={{ paddingHorizontal: 16 }}>
        <Input placeholder="Search name, store, phone..." value={search} onChangeText={setSearch} />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<Typography variant="body" style={{ textAlign: 'center', marginTop: 20, color: colors.textSecondary }}>No vendors found.</Typography>}
        renderItem={({ item }) => {
          const meta = getStatusMeta(item.vendorProfile?.status);
          return (
            <TouchableOpacity onPress={() => navigation.navigate('VendorDetail', { vendorId: item.id })}>
              <Card style={styles.vendorCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Typography variant="h3">{item.vendorProfile?.storeName || item.name}</Typography>
                    <Typography variant="caption">{item.name} • {item.phone}</Typography>
                  </View>
                  <Badge label={meta.label} variant={meta.variant} size="sm" />
                </View>
              </Card>
            </TouchableOpacity>
          );
        }}
      />

      <Modal visible={formVisible} animationType="slide" presentationStyle="formSheet">
        <ScrollView style={styles.modalContainer} contentContainerStyle={{ padding: 24 }}>
          <Typography variant="h2" style={{ marginBottom: 16 }}>Add Vendor</Typography>
          <Input label="Name" value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} containerStyle={{ marginBottom: 12 }} />
          <Input label="Phone" value={form.phone} onChangeText={(t) => setForm({ ...form, phone: t })} keyboardType="phone-pad" containerStyle={{ marginBottom: 12 }} />
          <Input label="Email" value={form.email} onChangeText={(t) => setForm({ ...form, email: t })} keyboardType="email-address" autoCapitalize="none" containerStyle={{ marginBottom: 12 }} />
          <Input label="Store Name" value={form.storeName} onChangeText={(t) => setForm({ ...form, storeName: t })} containerStyle={{ marginBottom: 12 }} />
          <Input label="City" value={form.city} onChangeText={(t) => setForm({ ...form, city: t })} containerStyle={{ marginBottom: 12 }} />
          <Input label="State" value={form.state} onChangeText={(t) => setForm({ ...form, state: t })} containerStyle={{ marginBottom: 12 }} />
          <Input label="GST Number" value={form.gstNumber} onChangeText={(t) => setForm({ ...form, gstNumber: t })} autoCapitalize="characters" containerStyle={{ marginBottom: 12 }} />
          <Button title="Save Vendor" onPress={handleCreate} loading={createMutation.isPending} style={{ marginTop: 8 }} />
          <Button title="Cancel" variant="outline" onPress={() => setFormVisible(false)} style={{ marginTop: 8 }} />
        </ScrollView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 8 },
  vendorCard: { marginBottom: 12 },
  modalContainer: { flex: 1, backgroundColor: colors.background },
});
