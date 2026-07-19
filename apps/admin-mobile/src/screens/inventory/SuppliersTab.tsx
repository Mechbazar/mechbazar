import React, { useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert, Modal, ScrollView, TouchableOpacity } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { colors, Typography, Card, Button, Input, Badge, Loader, adminService } from '@mechbazar/shared';
import { Edit2 } from 'lucide-react-native';

const emptyForm = { id: '', name: '', companyName: '', phone: '', email: '', contactPerson: '', gstNumber: '', address: '', isActive: true };

// Mirrors apps/admin/src/pages/inventory/Suppliers.tsx's list + create. The
// web page's "Edit" link has no handler (a bug); here it's wired to a real
// PUT /suppliers/:id call, per the "make functional" decision in the plan.
export const SuppliersTab = () => {
  const queryClient = useQueryClient();
  const [formVisible, setFormVisible] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['admin-suppliers'],
    queryFn: adminService.getSuppliers,
  });

  const suppliers = data || [];
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-suppliers'] });

  const saveMutation = useMutation({
    mutationFn: (payload: any) => (form.id ? adminService.updateSupplier(form.id, payload) : adminService.createSupplier(payload)),
    onSuccess: () => { invalidate(); closeForm(); },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.error || 'Failed to save supplier'),
  });

  const closeForm = () => {
    setFormVisible(false);
    setForm(emptyForm);
  };

  const openEdit = (s: any) => {
    setForm({
      id: s.id,
      name: s.name || '',
      companyName: s.companyName || '',
      phone: s.phone || '',
      email: s.email || '',
      contactPerson: s.contactPerson || '',
      gstNumber: s.gstNumber || '',
      address: s.address || '',
      isActive: s.isActive !== false,
    });
    setFormVisible(true);
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.companyName.trim()) {
      Alert.alert('Error', 'Name and company name are required.');
      return;
    }
    saveMutation.mutate({
      name: form.name,
      companyName: form.companyName,
      phone: form.phone,
      email: form.email,
      contactPerson: form.contactPerson,
      gstNumber: form.gstNumber,
      address: form.address,
      ...(form.id ? { isActive: form.isActive } : {}),
    });
  };

  if (isLoading && !isRefetching) return <Loader fullScreen />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Typography variant="h3">Suppliers</Typography>
        <Button title="Add New" size="sm" onPress={() => { setForm(emptyForm); setFormVisible(true); }} />
      </View>

      <FlatList
        data={suppliers}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<Typography variant="body" style={{ textAlign: 'center', marginTop: 20, color: colors.textSecondary }}>No suppliers found.</Typography>}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Typography variant="h3">{item.companyName}</Typography>
                <Typography variant="caption">{item.name} • {item.phone}</Typography>
              </View>
              <Badge label={item.isActive !== false ? 'Active' : 'Inactive'} variant={item.isActive !== false ? 'success' : 'secondary'} size="sm" />
            </View>
            <Typography variant="caption" style={{ marginTop: 8 }}>GST: {item.gstNumber || 'N/A'} • {item._count?.purchaseOrders ?? 0} POs</Typography>
            <TouchableOpacity onPress={() => openEdit(item)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
              <Edit2 color={colors.navy} size={16} />
              <Typography variant="caption" style={{ color: colors.navy, fontWeight: '600' }}>Edit</Typography>
            </TouchableOpacity>
          </Card>
        )}
      />

      <Modal visible={formVisible} animationType="slide" presentationStyle="formSheet">
        <ScrollView style={styles.modalContainer} contentContainerStyle={{ padding: 24 }}>
          <Typography variant="h2" style={{ marginBottom: 16 }}>{form.id ? 'Edit Supplier' : 'Add Supplier'}</Typography>
          <Input label="Name" value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} containerStyle={{ marginBottom: 12 }} />
          <Input label="Company Name" value={form.companyName} onChangeText={(t) => setForm({ ...form, companyName: t })} containerStyle={{ marginBottom: 12 }} />
          <Input label="Phone" value={form.phone} onChangeText={(t) => setForm({ ...form, phone: t })} keyboardType="phone-pad" containerStyle={{ marginBottom: 12 }} />
          <Input label="Email" value={form.email} onChangeText={(t) => setForm({ ...form, email: t })} keyboardType="email-address" autoCapitalize="none" containerStyle={{ marginBottom: 12 }} />
          <Input label="Contact Person" value={form.contactPerson} onChangeText={(t) => setForm({ ...form, contactPerson: t })} containerStyle={{ marginBottom: 12 }} />
          <Input label="GST Number" value={form.gstNumber} onChangeText={(t) => setForm({ ...form, gstNumber: t.toUpperCase() })} autoCapitalize="characters" containerStyle={{ marginBottom: 12 }} />
          <Input label="Address" value={form.address} onChangeText={(t) => setForm({ ...form, address: t })} multiline containerStyle={{ marginBottom: 12 }} />
          <Button title="Save Supplier" onPress={handleSave} loading={saveMutation.isPending} style={{ marginTop: 8 }} />
          <Button title="Cancel" variant="outline" onPress={closeForm} style={{ marginTop: 8 }} />
        </ScrollView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 8 },
  card: { marginBottom: 12 },
  modalContainer: { flex: 1, backgroundColor: colors.background },
});
