import React, { useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert, Modal, ScrollView, TouchableOpacity } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { colors, Typography, Card, Button, Input, Badge, Loader, adminService } from '@mechbazar/shared';

const emptyForm = { supplierId: '', totalCost: '', expectedDate: '' };

const getStatusMeta = (status: string): { variant: 'secondary' | 'primary' | 'info' | 'success' } => {
  switch (status) {
    case 'APPROVED':
      return { variant: 'secondary' };
    case 'ORDERED':
      return { variant: 'info' };
    case 'RECEIVED':
      return { variant: 'success' };
    default:
      return { variant: 'secondary' };
  }
};

// Mirrors apps/admin/src/pages/inventory/PurchaseOrders.tsx: same
// DRAFT->APPROVED->ORDERED->RECEIVED status badges (the web page only
// creates POs in DRAFT — there's no UI anywhere, web or here, to transition
// between those states, since the backend doesn't expose that either).
export const PurchaseOrdersTab = () => {
  const queryClient = useQueryClient();
  const [formVisible, setFormVisible] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data: purchaseOrders, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['admin-purchase-orders'],
    queryFn: adminService.getPurchaseOrders,
  });

  const { data: suppliers } = useQuery({
    queryKey: ['admin-suppliers'],
    queryFn: adminService.getSuppliers,
  });

  const pos = purchaseOrders || [];
  const supplierList = suppliers || [];

  const createMutation = useMutation({
    mutationFn: (payload: any) => adminService.createPurchaseOrder(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-purchase-orders'] });
      setFormVisible(false);
      setForm(emptyForm);
    },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.error || 'Failed to create purchase order'),
  });

  const handleCreate = () => {
    if (!form.supplierId) {
      Alert.alert('Error', 'Please select a supplier.');
      return;
    }
    createMutation.mutate({
      supplierId: form.supplierId,
      totalCost: Number(form.totalCost) || 0,
      expectedDate: form.expectedDate ? new Date(form.expectedDate).toISOString() : undefined,
    });
  };

  if (isLoading && !isRefetching) return <Loader fullScreen />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Typography variant="h3">Purchase Orders</Typography>
        <Button title="Add New" size="sm" onPress={() => { setForm(emptyForm); setFormVisible(true); }} />
      </View>

      <FlatList
        data={pos}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<Typography variant="body" style={{ textAlign: 'center', marginTop: 20, color: colors.textSecondary }}>No purchase orders found.</Typography>}
        renderItem={({ item }) => {
          const meta = getStatusMeta(item.status);
          return (
            <Card style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Typography variant="h3">PO-{item.id.slice(0, 8).toUpperCase()}</Typography>
                <Badge label={item.status} variant={meta.variant} size="sm" />
              </View>
              <Typography variant="body" style={{ marginTop: 4 }}>{item.supplier?.name}</Typography>
              <Typography variant="caption" style={{ marginTop: 4 }}>
                {item._count?.items ?? 0} items • Expected: {item.expectedDate ? new Date(item.expectedDate).toLocaleDateString() : 'N/A'}
              </Typography>
              <Typography variant="body" style={{ marginTop: 8, fontWeight: '700', color: colors.primary }}>₹{item.totalCost?.toLocaleString()}</Typography>
            </Card>
          );
        }}
      />

      <Modal visible={formVisible} animationType="slide" presentationStyle="formSheet">
        <ScrollView style={styles.modalContainer} contentContainerStyle={{ padding: 24 }}>
          <Typography variant="h2" style={{ marginBottom: 16 }}>Create Purchase Order</Typography>

          {supplierList.length === 0 && (
            <Typography variant="caption" style={{ color: colors.warning, marginBottom: 12 }}>You must add a supplier first.</Typography>
          )}

          <Typography variant="caption" style={{ marginBottom: 8 }}>Supplier</Typography>
          <View style={styles.chipRow}>
            {supplierList.map((s: any) => (
              <TouchableOpacity key={s.id} style={[styles.chip, form.supplierId === s.id && styles.chipActive]} onPress={() => setForm({ ...form, supplierId: s.id })}>
                <Typography variant="caption" style={{ color: form.supplierId === s.id ? '#fff' : colors.text }}>{s.name}</Typography>
              </TouchableOpacity>
            ))}
          </View>

          <Input label="Total Cost (₹)" value={form.totalCost} onChangeText={(t) => setForm({ ...form, totalCost: t })} keyboardType="numeric" containerStyle={{ marginVertical: 12 }} />
          <Input label="Expected Date (YYYY-MM-DD)" value={form.expectedDate} onChangeText={(t) => setForm({ ...form, expectedDate: t })} containerStyle={{ marginBottom: 12 }} />

          <Button title="Create" onPress={handleCreate} loading={createMutation.isPending} disabled={!form.supplierId} />
          <Button title="Cancel" variant="outline" onPress={() => setFormVisible(false)} style={{ marginTop: 8 }} />
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
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: colors.surfaceHover },
  chipActive: { backgroundColor: colors.primary },
});
