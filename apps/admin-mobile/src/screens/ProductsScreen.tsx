import React, { useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert, Modal, ScrollView, TouchableOpacity } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { colors, Typography, Card, Button, Input, Badge, Loader, adminService } from '@mechbazar/shared';
import { MoreVertical } from 'lucide-react-native';

const VEHICLE_TYPE_OPTIONS = ['CAR', 'BIKE'];
const STATUS_OPTIONS = ['APPROVED', 'PENDING', 'INACTIVE'];

const emptyForm = { id: '', name: '', category: '', vehicleType: 'CAR', oem: '', price: '', mrp: '', b2bPrice: '', stock: '', lowStockThreshold: '10', status: 'APPROVED' };

const getStatusMeta = (status: string): { label: string; variant: 'success' | 'warning' | 'danger' | 'secondary' } => {
  switch (status) {
    case 'APPROVED':
      return { label: 'Live', variant: 'success' };
    case 'PENDING':
      return { label: 'Pending', variant: 'warning' };
    case 'REJECTED':
      return { label: 'Rejected', variant: 'danger' };
    case 'INACTIVE':
      return { label: 'Draft/Inactive', variant: 'secondary' };
    default:
      return { label: status, variant: 'secondary' };
  }
};

// Mirrors apps/admin/src/pages/Products.tsx: same stat-card filters (with the
// same Low Stock KPI cutoff of stock<50, distinct from the per-row
// lowStockThreshold||10 badge logic — that split is real web business logic,
// not a bug to fix), same row actions, same create/edit fields.
export const ProductsScreen = () => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [formVisible, setFormVisible] = useState(false);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['admin-products'],
    queryFn: adminService.getProducts,
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: adminService.getCategories,
  });

  const products = data || [];
  const categories = categoriesData || [];

  // Categories are unique per vehicleType -- only ever offer categories that
  // match the product's currently selected vehicle type.
  const categoriesForVehicleType = (vehicleType: string) =>
    categories.filter((c: any) => c.vehicleType === vehicleType);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-products'] });

  const saveMutation = useMutation({
    mutationFn: (payload: any) =>
      editingId ? adminService.updateProduct(editingId, payload) : adminService.createProduct(payload),
    onSuccess: () => {
      invalidate();
      closeForm();
    },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.error || 'Failed to save product'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => adminService.updateProductStatus(id, status),
    onSuccess: invalidate,
    onError: () => Alert.alert('Error', 'Failed to update status'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminService.deleteProduct(id),
    onSuccess: invalidate,
    onError: (err: any) => Alert.alert('Error', err.response?.data?.error || 'Failed to delete product'),
  });

  const duplicateMutation = useMutation({
    mutationFn: (p: any) =>
      adminService.createProduct({
        name: `${p.name} (Copy)`,
        category: p.category?.name,
        vehicleType: p.vehicleType || 'CAR',
        oem: p.oemNumber,
        price: p.price,
        b2bPrice: p.b2bPrice,
        stock: p.stock,
      }),
    onSuccess: invalidate,
    onError: () => Alert.alert('Error', 'Failed to duplicate product'),
  });

  const filtered = useMemo(() => {
    return products.filter((p: any) => {
      if (statusFilter === 'PENDING' && p.status !== 'PENDING') return false;
      if (statusFilter === 'LOW_STOCK' && !(p.stock < 50)) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !p.name?.toLowerCase().includes(q) &&
          !p.oemNumber?.toLowerCase().includes(q) &&
          !p.partNumber?.toLowerCase().includes(q) &&
          !p.vendor?.storeName?.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [products, statusFilter, search]);

  const closeForm = () => {
    setFormVisible(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const openEdit = (p: any) => {
    setEditingId(p.id);
    setForm({
      id: p.id,
      name: p.name || '',
      category: p.category?.name || '',
      vehicleType: p.vehicleType || 'CAR',
      oem: p.oemNumber || '',
      price: String(p.price ?? ''),
      mrp: String(p.mrp ?? ''),
      b2bPrice: String(p.b2bPrice ?? ''),
      stock: String(p.stock ?? ''),
      lowStockThreshold: String(p.lowStockThreshold ?? '10'),
      status: p.status || 'APPROVED',
    });
    setActionMenuId(null);
    setFormVisible(true);
  };

  const handleVehicleTypeChange = (vehicleType: string) => {
    const stillValid = categoriesForVehicleType(vehicleType).some((c: any) => c.name === form.category);
    setForm({
      ...form,
      vehicleType,
      category: stillValid ? form.category : (categoriesForVehicleType(vehicleType)[0]?.name || ''),
    });
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      Alert.alert('Error', 'Product name is required.');
      return;
    }
    const payload: any = {
      name: form.name,
      category: form.category,
      vehicleType: form.vehicleType,
      oemNumber: form.oem,
      price: Number(form.price) || 0,
      mrp: Number(form.mrp) || 0,
      b2bPrice: Number(form.b2bPrice) || 0,
      stock: Number(form.stock) || 0,
      lowStockThreshold: Number(form.lowStockThreshold) || 10,
      status: form.status,
    };
    saveMutation.mutate(payload);
  };

  const handleDelete = (id: string) => {
    setActionMenuId(null);
    Alert.alert('Delete Product', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(id) },
    ]);
  };

  if (isLoading && !isRefetching) return <Loader fullScreen />;

  const totalCount = products.length;
  const pendingCount = products.filter((p: any) => p.status === 'PENDING').length;
  const lowStockCount = products.filter((p: any) => p.stock < 50).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Typography variant="h2">Products</Typography>
        <Button title="Add New" size="sm" onPress={() => { setForm(emptyForm); setEditingId(null); setFormVisible(true); }} />
      </View>

      <View style={styles.statRow}>
        <TouchableOpacity style={[styles.statCard, !statusFilter && styles.statCardActive]} onPress={() => setStatusFilter(null)}>
          <Typography variant="caption">Total</Typography>
          <Typography variant="h3">{totalCount}</Typography>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.statCard, statusFilter === 'PENDING' && styles.statCardActive]} onPress={() => setStatusFilter('PENDING')}>
          <Typography variant="caption">Pending</Typography>
          <Typography variant="h3">{pendingCount}</Typography>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.statCard, statusFilter === 'LOW_STOCK' && styles.statCardActive]} onPress={() => setStatusFilter('LOW_STOCK')}>
          <Typography variant="caption">Low Stock</Typography>
          <Typography variant="h3">{lowStockCount}</Typography>
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: 16 }}>
        <Input placeholder="Search name, OEM, part, vendor..." value={search} onChangeText={setSearch} />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<Typography variant="body" style={{ textAlign: 'center', marginTop: 20, color: colors.textSecondary }}>No products found.</Typography>}
        renderItem={({ item }) => {
          const meta = getStatusMeta(item.status);
          const threshold = item.lowStockThreshold || 10;
          const isLow = item.stock <= threshold;
          return (
            <Card style={styles.productCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Typography variant="h3" numberOfLines={1}>{item.name}</Typography>
                  <Typography variant="caption">{item.vendor?.storeName || 'MechBazar'} · {item.vehicleType === 'BIKE' ? '🏍️ Bike' : '🚗 Car'}</Typography>
                </View>
                <TouchableOpacity onPress={() => setActionMenuId(actionMenuId === item.id ? null : item.id)}>
                  <MoreVertical color={colors.textSecondary} size={20} />
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <Typography variant="body" style={{ color: colors.primary, fontWeight: '700' }}>₹{item.price}</Typography>
                <Typography variant="caption" style={{ color: isLow ? colors.danger : colors.textSecondary }}>
                  Stock: {item.stock}{isLow ? ' (Low)' : ''}
                </Typography>
                <Badge label={meta.label} variant={meta.variant} size="sm" />
              </View>

              {actionMenuId === item.id && (
                <View style={styles.actionMenu}>
                  <TouchableOpacity style={styles.actionRow} onPress={() => openEdit(item)}>
                    <Typography variant="body">Edit</Typography>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionRow} onPress={() => { setActionMenuId(null); duplicateMutation.mutate(item); }}>
                    <Typography variant="body">Duplicate</Typography>
                  </TouchableOpacity>
                  {item.status === 'PENDING' && (
                    <TouchableOpacity style={styles.actionRow} onPress={() => { setActionMenuId(null); statusMutation.mutate({ id: item.id, status: 'APPROVED' }); }}>
                      <Typography variant="body" style={{ color: colors.success, fontWeight: '600' }}>Approve</Typography>
                    </TouchableOpacity>
                  )}
                  {item.status !== 'INACTIVE' ? (
                    <TouchableOpacity style={styles.actionRow} onPress={() => { setActionMenuId(null); statusMutation.mutate({ id: item.id, status: 'INACTIVE' }); }}>
                      <Typography variant="body">Mark Draft</Typography>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={styles.actionRow} onPress={() => { setActionMenuId(null); statusMutation.mutate({ id: item.id, status: 'APPROVED' }); }}>
                      <Typography variant="body" style={{ color: colors.success, fontWeight: '600' }}>Set Live</Typography>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={[styles.actionRow, { borderBottomWidth: 0 }]} onPress={() => handleDelete(item.id)}>
                    <Typography variant="body" style={{ color: colors.danger, fontWeight: '600' }}>Delete</Typography>
                  </TouchableOpacity>
                </View>
              )}
            </Card>
          );
        }}
      />

      <Modal visible={formVisible} animationType="slide" presentationStyle="formSheet">
        <ScrollView style={styles.modalContainer} contentContainerStyle={{ padding: 24 }}>
          <Typography variant="h2" style={{ marginBottom: 16 }}>{editingId ? 'Edit Product' : 'Add New Product'}</Typography>

          <Input label="Product Name" value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} containerStyle={{ marginBottom: 12 }} />

          <Typography variant="caption" style={{ marginBottom: 8 }}>Vehicle Type</Typography>
          <View style={styles.chipRow}>
            {VEHICLE_TYPE_OPTIONS.map((v) => (
              <TouchableOpacity key={v} style={[styles.chip, form.vehicleType === v && styles.chipActive]} onPress={() => handleVehicleTypeChange(v)}>
                <Typography variant="caption" style={{ color: form.vehicleType === v ? '#fff' : colors.text }}>{v === 'CAR' ? '🚗 Car' : '🏍️ Bike'}</Typography>
              </TouchableOpacity>
            ))}
          </View>

          <Typography variant="caption" style={{ marginTop: 12, marginBottom: 8 }}>Category</Typography>
          <View style={styles.chipRow}>
            {categoriesForVehicleType(form.vehicleType).map((c: any) => (
              <TouchableOpacity key={c.id} style={[styles.chip, form.category === c.name && styles.chipActive]} onPress={() => setForm({ ...form, category: c.name })}>
                <Typography variant="caption" style={{ color: form.category === c.name ? '#fff' : colors.text }}>{c.name}</Typography>
              </TouchableOpacity>
            ))}
          </View>

          <Input label="OEM Number" value={form.oem} onChangeText={(t) => setForm({ ...form, oem: t })} containerStyle={{ marginVertical: 12 }} />
          <Input label="Price (₹)" value={form.price} onChangeText={(t) => setForm({ ...form, price: t })} keyboardType="numeric" containerStyle={{ marginBottom: 12 }} />
          <Input label="MRP (₹)" value={form.mrp} onChangeText={(t) => setForm({ ...form, mrp: t })} keyboardType="numeric" containerStyle={{ marginBottom: 12 }} />
          <Input label="B2B Price (₹)" value={form.b2bPrice} onChangeText={(t) => setForm({ ...form, b2bPrice: t })} keyboardType="numeric" containerStyle={{ marginBottom: 12 }} />
          <Input label="Stock" value={form.stock} onChangeText={(t) => setForm({ ...form, stock: t })} keyboardType="numeric" containerStyle={{ marginBottom: 12 }} />
          <Input label="Low Stock Threshold" value={form.lowStockThreshold} onChangeText={(t) => setForm({ ...form, lowStockThreshold: t })} keyboardType="numeric" containerStyle={{ marginBottom: 12 }} />

          <Typography variant="caption" style={{ marginBottom: 8 }}>Status</Typography>
          <View style={styles.chipRow}>
            {STATUS_OPTIONS.map((s) => (
              <TouchableOpacity key={s} style={[styles.chip, form.status === s && styles.chipActive]} onPress={() => setForm({ ...form, status: s })}>
                <Typography variant="caption" style={{ color: form.status === s ? '#fff' : colors.text }}>{s}</Typography>
              </TouchableOpacity>
            ))}
          </View>

          <Button title="Save Product" onPress={handleSave} loading={saveMutation.isPending} style={{ marginTop: 20 }} />
          <Button title="Cancel" variant="outline" onPress={closeForm} style={{ marginTop: 8 }} />
        </ScrollView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 8 },
  statRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: colors.card, borderRadius: 12, padding: 10, alignItems: 'center', elevation: 1 },
  statCardActive: { borderWidth: 2, borderColor: colors.primary },
  productCard: { marginBottom: 12 },
  actionMenu: { marginTop: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 4 },
  actionRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalContainer: { flex: 1, backgroundColor: colors.background },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: colors.surfaceHover },
  chipActive: { backgroundColor: colors.primary },
});
