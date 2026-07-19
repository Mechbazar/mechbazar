import React, { useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert, Modal, ScrollView, TouchableOpacity } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { colors, Typography, Card, Button, Input, Badge, Loader, adminService } from '@mechbazar/shared';
import { Edit2 } from 'lucide-react-native';

const emptyForm = { id: '', name: '', code: '', address: '', managerName: '', phone: '', capacity: '', isActive: true };

// Mirrors apps/admin/src/pages/inventory/Warehouses.tsx's list + create.
// The web page also has a `phone` field in its form state that never gets a
// visible input (it's silently submitted as undefined) and an "Edit" button
// with no handler — both are bugs; here phone is actually collected and
// Edit actually works, per the "make functional" decision in the plan.
export const WarehousesTab = () => {
  const queryClient = useQueryClient();
  const [formVisible, setFormVisible] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['admin-warehouses'],
    queryFn: adminService.getWarehouses,
  });

  const warehouses = data || [];
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-warehouses'] });

  const saveMutation = useMutation({
    mutationFn: (payload: any) => (form.id ? adminService.updateWarehouse(form.id, payload) : adminService.createWarehouse(payload)),
    onSuccess: () => { invalidate(); closeForm(); },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.error || 'Please check the code is unique.'),
  });

  const closeForm = () => {
    setFormVisible(false);
    setForm(emptyForm);
  };

  const openEdit = (w: any) => {
    setForm({
      id: w.id,
      name: w.name || '',
      code: w.code || '',
      address: w.address || '',
      managerName: w.managerName || '',
      phone: w.phone || '',
      capacity: String(w.capacity ?? ''),
      isActive: w.isActive !== false,
    });
    setFormVisible(true);
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.code.trim() || !form.address.trim()) {
      Alert.alert('Error', 'Name, code, and address are required.');
      return;
    }
    saveMutation.mutate({
      name: form.name,
      code: form.code.toUpperCase(),
      address: form.address,
      managerName: form.managerName,
      phone: form.phone,
      capacity: Number(form.capacity) || 0,
      ...(form.id ? { isActive: form.isActive } : {}),
    });
  };

  if (isLoading && !isRefetching) return <Loader fullScreen />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Typography variant="h3">Warehouses</Typography>
        <Button title="Add New" size="sm" onPress={() => { setForm(emptyForm); setFormVisible(true); }} />
      </View>

      <FlatList
        data={warehouses}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<Typography variant="body" style={{ textAlign: 'center', marginTop: 20, color: colors.textSecondary }}>No warehouses found.</Typography>}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Typography variant="h3">{item.name}</Typography>
                <Typography variant="caption" style={{ fontFamily: 'monospace' }}>{item.code}</Typography>
              </View>
              <Badge label={item.isActive !== false ? 'Active' : 'Inactive'} variant={item.isActive !== false ? 'success' : 'secondary'} size="sm" />
            </View>
            <Typography variant="body" style={{ marginTop: 8 }}>{item.address}</Typography>
            <Typography variant="caption" style={{ marginTop: 4 }}>
              Capacity: {item.capacity?.toLocaleString()} • {item._count?.inventory ?? 0} SKUs
            </Typography>
            <TouchableOpacity onPress={() => openEdit(item)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
              <Edit2 color={colors.navy} size={16} />
              <Typography variant="caption" style={{ color: colors.navy, fontWeight: '600' }}>Edit</Typography>
            </TouchableOpacity>
          </Card>
        )}
      />

      <Modal visible={formVisible} animationType="slide" presentationStyle="formSheet">
        <ScrollView style={styles.modalContainer} contentContainerStyle={{ padding: 24 }}>
          <Typography variant="h2" style={{ marginBottom: 16 }}>{form.id ? 'Edit Warehouse' : 'Add Warehouse'}</Typography>
          <Input label="Name" value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} containerStyle={{ marginBottom: 12 }} />
          <Input label="Code (unique)" value={form.code} onChangeText={(t) => setForm({ ...form, code: t.toUpperCase() })} autoCapitalize="characters" containerStyle={{ marginBottom: 12 }} />
          <Input label="Address" value={form.address} onChangeText={(t) => setForm({ ...form, address: t })} multiline containerStyle={{ marginBottom: 12 }} />
          <Input label="Manager Name" value={form.managerName} onChangeText={(t) => setForm({ ...form, managerName: t })} containerStyle={{ marginBottom: 12 }} />
          <Input label="Phone" value={form.phone} onChangeText={(t) => setForm({ ...form, phone: t })} keyboardType="phone-pad" containerStyle={{ marginBottom: 12 }} />
          <Input label="Capacity" value={form.capacity} onChangeText={(t) => setForm({ ...form, capacity: t })} keyboardType="numeric" containerStyle={{ marginBottom: 12 }} />
          <Button title="Save Warehouse" onPress={handleSave} loading={saveMutation.isPending} style={{ marginTop: 8 }} />
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
