import React, { useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert, Modal, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { colors, Typography, Card, Button, Input, Loader, adminService } from '@mechbazar/shared';
import { Trash2, Edit2 } from 'lucide-react-native';

const VEHICLE_TYPES = ['CAR', 'BIKE'];
const STATUS_OPTIONS = ['Active', 'Inactive'];

const emptyForm = { name: '', icon: '', description: '', vehicleType: 'CAR', status: 'Active', isEmergency: false };

// Mirrors apps/admin/src/pages/services/ServiceCategories.tsx -- doorstep
// service categories (distinct from CategoriesScreen.tsx's product categories),
// same list/modal shape.
export const ServiceCategoriesScreen = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [formVisible, setFormVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['admin-service-categories'],
    queryFn: adminService.getServiceCategories,
  });

  const categories = data || [];
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-service-categories'] });

  const saveMutation = useMutation({
    mutationFn: (payload: any) => (editingId ? adminService.updateServiceCategory(editingId, payload) : adminService.createServiceCategory(payload)),
    onSuccess: () => { invalidate(); closeForm(); },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.error || 'Failed to save service category'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminService.deleteServiceCategory(id),
    onSuccess: invalidate,
    onError: (err: any) => Alert.alert('Error', err.response?.data?.error || 'Failed to delete category. It may still have packages assigned.'),
  });

  const filtered = useMemo(() => {
    if (!search) return categories;
    const q = search.toLowerCase();
    return categories.filter((c: any) => c.name?.toLowerCase().includes(q));
  }, [categories, search]);

  const closeForm = () => {
    setFormVisible(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const openEdit = (c: any) => {
    setEditingId(c.id);
    setForm({
      name: c.name || '',
      icon: c.icon || '',
      description: c.description || '',
      vehicleType: c.vehicleType || 'CAR',
      status: c.status || 'Active',
      isEmergency: !!c.isEmergency,
    });
    setFormVisible(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      Alert.alert('Error', 'Category name is required.');
      return;
    }
    saveMutation.mutate(form);
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Service Category', 'Are you sure? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(id) },
    ]);
  };

  if (isLoading && !isRefetching) return <Loader fullScreen />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Typography variant="h2">Service Categories</Typography>
        <Button title="Add New" size="sm" onPress={() => { setForm(emptyForm); setEditingId(null); setFormVisible(true); }} />
      </View>

      <View style={{ paddingHorizontal: 16 }}>
        <Input placeholder="Search service categories..." value={search} onChangeText={setSearch} />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        ListEmptyComponent={<Typography variant="body" style={{ textAlign: 'center', marginTop: 20, color: colors.textSecondary }}>No service categories found.</Typography>}
        renderItem={({ item }) => (
          <Card style={styles.categoryCard}>
            <Typography variant="h1" style={{ fontSize: 32 }}>{item.icon || '🔧'}</Typography>
            <Typography variant="h3" style={{ marginTop: 8 }} numberOfLines={1}>{item.name}</Typography>
            <Typography variant="caption">{item._count?.packages ?? 0} packages • {item.vehicleType}</Typography>
            {!!item.isEmergency && <Typography variant="caption" style={{ color: colors.danger }}>Emergency</Typography>}
            <Typography variant="caption" style={{ color: item.status === 'Active' ? colors.success : colors.textSecondary }}>{item.status}</Typography>
            <View style={{ flexDirection: 'row', gap: 16, marginTop: 12 }}>
              <TouchableOpacity onPress={() => openEdit(item)}>
                <Edit2 color={colors.navy} size={18} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item.id)}>
                <Trash2 color={colors.danger} size={18} />
              </TouchableOpacity>
            </View>
          </Card>
        )}
      />

      <Modal visible={formVisible} animationType="slide" presentationStyle="formSheet">
        <ScrollView style={styles.modalContainer} contentContainerStyle={{ padding: 24 }}>
          <Typography variant="h2" style={{ marginBottom: 16 }}>{editingId ? 'Edit Service Category' : 'Add Service Category'}</Typography>
          <Input label="Name" value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} placeholder="e.g. Battery Replacement" containerStyle={{ marginBottom: 12 }} />
          <Input label="Description" value={form.description} onChangeText={(t) => setForm({ ...form, description: t })} placeholder="Shown as a short subtitle in the app" multiline containerStyle={{ marginBottom: 12 }} />
          <Input label="Icon (emoji or image URL)" value={form.icon} onChangeText={(t) => setForm({ ...form, icon: t })} placeholder="e.g. 🔋" containerStyle={{ marginBottom: 12 }} />

          <Typography variant="caption" style={{ marginBottom: 8 }}>Vehicle Type</Typography>
          <View style={styles.chipRow}>
            {VEHICLE_TYPES.map((v) => (
              <TouchableOpacity key={v} style={[styles.chip, form.vehicleType === v && styles.chipActive]} onPress={() => setForm({ ...form, vehicleType: v })}>
                <Typography variant="caption" style={{ color: form.vehicleType === v ? '#fff' : colors.text }}>{v}</Typography>
              </TouchableOpacity>
            ))}
          </View>

          <Typography variant="caption" style={{ marginVertical: 8 }}>Status</Typography>
          <View style={styles.chipRow}>
            {STATUS_OPTIONS.map((s) => (
              <TouchableOpacity key={s} style={[styles.chip, form.status === s && styles.chipActive]} onPress={() => setForm({ ...form, status: s })}>
                <Typography variant="caption" style={{ color: form.status === s ? '#fff' : colors.text }}>{s}</Typography>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
            <Typography variant="body">Show under Emergency Assistance</Typography>
            <Switch value={form.isEmergency} onValueChange={(v) => setForm({ ...form, isEmergency: v })} trackColor={{ false: colors.border, true: colors.success }} />
          </View>

          <Button title="Save Category" onPress={handleSave} loading={saveMutation.isPending} style={{ marginTop: 20 }} />
          <Button title="Cancel" variant="outline" onPress={closeForm} style={{ marginTop: 8 }} />
        </ScrollView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 8 },
  categoryCard: { flex: 1, alignItems: 'flex-start' },
  modalContainer: { flex: 1, backgroundColor: colors.background },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: colors.surfaceHover },
  chipActive: { backgroundColor: colors.primary },
});
