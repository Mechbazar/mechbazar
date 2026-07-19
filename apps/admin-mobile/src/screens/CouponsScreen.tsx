import React, { useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert, Modal, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { colors, Typography, Card, Button, Input, Badge, Loader, adminService } from '@mechbazar/shared';
import { Trash2, Edit2 } from 'lucide-react-native';

const DISCOUNT_TYPES = ['PERCENTAGE', 'FLAT'];
const emptyForm = { id: '', code: '', discountType: 'PERCENTAGE', discountValue: '', minOrderValue: '', isActive: true };

// Mirrors apps/admin/src/pages/Coupons.tsx: code is force-uppercased on
// input and again on submit; the active toggle re-sends the full coupon
// object via PUT (no dedicated PATCH endpoint on the backend), same as web.
export const CouponsScreen = () => {
  const queryClient = useQueryClient();
  const [formVisible, setFormVisible] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['admin-coupons'],
    queryFn: adminService.getCoupons,
  });

  const coupons = data || [];
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-coupons'] });

  const saveMutation = useMutation({
    mutationFn: (payload: any) => (form.id ? adminService.updateCoupon(form.id, payload) : adminService.createCoupon(payload)),
    onSuccess: () => { invalidate(); closeForm(); },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.error || 'Failed to save coupon'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminService.deleteCoupon(id),
    onSuccess: invalidate,
    onError: () => Alert.alert('Error', 'Failed to delete coupon'),
  });

  const toggleMutation = useMutation({
    mutationFn: (coupon: any) =>
      adminService.updateCoupon(coupon.id, {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        minOrderValue: coupon.minOrderValue,
        isActive: !coupon.isActive,
      }),
    onSuccess: invalidate,
    onError: () => Alert.alert('Error', 'Failed to update coupon'),
  });

  const closeForm = () => {
    setFormVisible(false);
    setForm(emptyForm);
  };

  const openEdit = (c: any) => {
    setForm({
      id: c.id,
      code: c.code,
      discountType: c.discountType,
      discountValue: String(c.discountValue ?? ''),
      minOrderValue: String(c.minOrderValue ?? ''),
      isActive: c.isActive,
    });
    setFormVisible(true);
  };

  const handleSave = () => {
    if (!form.code.trim() || !form.discountValue) {
      Alert.alert('Error', 'Code and discount value are required.');
      return;
    }
    saveMutation.mutate({
      code: form.code.toUpperCase(),
      discountType: form.discountType,
      discountValue: Number(form.discountValue),
      minOrderValue: Number(form.minOrderValue) || 0,
      isActive: form.isActive,
    });
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Coupon', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(id) },
    ]);
  };

  if (isLoading && !isRefetching) return <Loader fullScreen />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Typography variant="h2">Coupons</Typography>
        <Button title="Add New" size="sm" onPress={() => { setForm(emptyForm); setFormVisible(true); }} />
      </View>

      <FlatList
        data={coupons}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<Typography variant="body" style={{ textAlign: 'center', marginTop: 20, color: colors.textSecondary }}>No coupons found.</Typography>}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View>
                <Typography variant="h3">{item.code}</Typography>
                <Typography variant="caption">
                  {item.discountType === 'PERCENTAGE' ? `${item.discountValue}% off` : `₹${item.discountValue} off`} • Min order ₹{item.minOrderValue}
                </Typography>
              </View>
              <Badge label={item.isActive ? 'Active' : 'Inactive'} variant={item.isActive ? 'success' : 'secondary'} size="sm" />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
              <View style={{ flexDirection: 'row', gap: 16 }}>
                <TouchableOpacity onPress={() => openEdit(item)}><Edit2 color={colors.navy} size={18} /></TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item.id)}><Trash2 color={colors.danger} size={18} /></TouchableOpacity>
              </View>
              <Switch value={item.isActive} onValueChange={() => toggleMutation.mutate(item)} trackColor={{ false: colors.border, true: colors.success }} />
            </View>
          </Card>
        )}
      />

      <Modal visible={formVisible} animationType="slide" presentationStyle="formSheet">
        <ScrollView style={styles.modalContainer} contentContainerStyle={{ padding: 24 }}>
          <Typography variant="h2" style={{ marginBottom: 16 }}>{form.id ? 'Edit Coupon' : 'Add Coupon'}</Typography>
          <Input label="Code" value={form.code} onChangeText={(t) => setForm({ ...form, code: t.toUpperCase() })} autoCapitalize="characters" containerStyle={{ marginBottom: 12 }} />

          <Typography variant="caption" style={{ marginBottom: 8 }}>Discount Type</Typography>
          <View style={styles.chipRow}>
            {DISCOUNT_TYPES.map((d) => (
              <TouchableOpacity key={d} style={[styles.chip, form.discountType === d && styles.chipActive]} onPress={() => setForm({ ...form, discountType: d })}>
                <Typography variant="caption" style={{ color: form.discountType === d ? '#fff' : colors.text }}>{d}</Typography>
              </TouchableOpacity>
            ))}
          </View>

          <Input label={form.discountType === 'PERCENTAGE' ? 'Discount (%)' : 'Discount (₹)'} value={form.discountValue} onChangeText={(t) => setForm({ ...form, discountValue: t })} keyboardType="numeric" containerStyle={{ marginVertical: 12 }} />
          <Input label="Minimum Order Value (₹)" value={form.minOrderValue} onChangeText={(t) => setForm({ ...form, minOrderValue: t })} keyboardType="numeric" containerStyle={{ marginBottom: 12 }} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Typography variant="body">Active</Typography>
            <Switch value={form.isActive} onValueChange={(v) => setForm({ ...form, isActive: v })} trackColor={{ false: colors.border, true: colors.success }} />
          </View>

          <Button title="Save Coupon" onPress={handleSave} loading={saveMutation.isPending} style={{ marginTop: 8 }} />
          <Button title="Cancel" variant="outline" onPress={closeForm} style={{ marginTop: 8 }} />
        </ScrollView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 8 },
  card: { marginBottom: 12 },
  modalContainer: { flex: 1, backgroundColor: colors.background },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: colors.surfaceHover },
  chipActive: { backgroundColor: colors.primary },
});
