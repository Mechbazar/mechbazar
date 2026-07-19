import React, { useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert, Modal, ScrollView, TouchableOpacity, Switch, Image } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { colors, Typography, Card, Button, Input, Badge, Loader, adminService } from '@mechbazar/shared';
import { Trash2, Edit2 } from 'lucide-react-native';

const emptyForm = {
  categoryId: '', name: '', description: '', image: '', price: '', discountPrice: '',
  estimatedMinutes: '60', includedServices: '', isActive: true,
  isPopular: false, isRecommended: false, isEmergency: false,
};

// Mirrors apps/admin/src/pages/services/ServicePackages.tsx -- pricing,
// duration and inclusions for each doorstep-service package, same list/modal
// shape as ServiceCategoriesScreen.tsx.
export const ServicePackagesScreen = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [formVisible, setFormVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['admin-service-packages'],
    queryFn: adminService.getServicePackages,
  });
  const { data: categoriesData } = useQuery({
    queryKey: ['admin-service-categories'],
    queryFn: adminService.getServiceCategories,
  });

  const packages = data || [];
  const categories = categoriesData || [];
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-service-packages'] });

  const saveMutation = useMutation({
    mutationFn: (payload: any) => (editingId ? adminService.updateServicePackage(editingId, payload) : adminService.createServicePackage(payload)),
    onSuccess: () => { invalidate(); closeForm(); },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.error || 'Failed to save package'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminService.deleteServicePackage(id),
    onSuccess: invalidate,
    onError: (err: any) => Alert.alert('Error', err.response?.data?.error || 'Failed to delete package'),
  });

  const filtered = useMemo(() => {
    if (!search) return packages;
    const q = search.toLowerCase();
    return packages.filter((p: any) => p.name?.toLowerCase().includes(q));
  }, [packages, search]);

  const closeForm = () => {
    setFormVisible(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const openAdd = () => {
    if (categories.length === 0) {
      Alert.alert('No categories', 'Create a service category first before adding packages.');
      return;
    }
    setEditingId(null);
    setForm({ ...emptyForm, categoryId: categories[0].id });
    setFormVisible(true);
  };

  const openEdit = (pkg: any) => {
    setEditingId(pkg.id);
    setForm({
      categoryId: pkg.categoryId,
      name: pkg.name || '',
      description: pkg.description || '',
      image: pkg.image || '',
      price: String(pkg.price ?? ''),
      discountPrice: pkg.discountPrice != null ? String(pkg.discountPrice) : '',
      estimatedMinutes: String(pkg.estimatedMinutes ?? 60),
      includedServices: (pkg.includedServices || []).join(', '),
      isActive: pkg.isActive,
      isPopular: !!pkg.isPopular,
      isRecommended: !!pkg.isRecommended,
      isEmergency: !!pkg.isEmergency,
    });
    setFormVisible(true);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (result.canceled) return;
    try {
      setUploading(true);
      const uri = result.assets[0].uri;
      const upload = await adminService.uploadImage(uri, 'image/jpeg', `package-${Date.now()}.jpg`);
      setForm((f) => ({ ...f, image: upload.url }));
    } catch (err: any) {
      Alert.alert('Upload failed', err.response?.data?.error || err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = () => {
    if (!form.categoryId || !form.name.trim() || !form.price) {
      Alert.alert('Error', 'Category, name and price are required.');
      return;
    }
    saveMutation.mutate({
      categoryId: form.categoryId,
      name: form.name,
      description: form.description,
      image: form.image || null,
      price: Number(form.price),
      discountPrice: form.discountPrice ? Number(form.discountPrice) : null,
      estimatedMinutes: Number(form.estimatedMinutes) || 60,
      includedServices: form.includedServices.split(',').map((s) => s.trim()).filter(Boolean),
      isActive: form.isActive,
      isPopular: form.isPopular,
      isRecommended: form.isRecommended,
      isEmergency: form.isEmergency,
    });
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Package', 'Are you sure? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(id) },
    ]);
  };

  if (isLoading && !isRefetching) return <Loader fullScreen />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Typography variant="h2">Service Packages</Typography>
        <Button title="Add New" size="sm" onPress={openAdd} />
      </View>

      <View style={{ paddingHorizontal: 16 }}>
        <Input placeholder="Search packages..." value={search} onChangeText={setSearch} />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        ListEmptyComponent={<Typography variant="body" style={{ textAlign: 'center', marginTop: 20, color: colors.textSecondary }}>No service packages found.</Typography>}
        renderItem={({ item }) => (
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Typography variant="h3">{item.name}</Typography>
                <Typography variant="caption" numberOfLines={2}>{item.description || 'No description'}</Typography>
              </View>
              <Badge label={item.isActive ? 'Active' : 'Disabled'} variant={item.isActive ? 'success' : 'secondary'} size="sm" />
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {item.isPopular && <Badge label="Popular" variant="warning" size="sm" />}
              {item.isRecommended && <Badge label="Recommended" variant="info" size="sm" />}
              {item.isEmergency && <Badge label="Emergency" variant="danger" size="sm" />}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
              <Typography variant="body" style={{ fontWeight: '700' }}>
                ₹{item.discountPrice ?? item.price} <Typography variant="caption">· {item.estimatedMinutes} mins</Typography>
              </Typography>
              <View style={{ flexDirection: 'row', gap: 16 }}>
                <TouchableOpacity onPress={() => openEdit(item)}><Edit2 color={colors.navy} size={18} /></TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item.id)}><Trash2 color={colors.danger} size={18} /></TouchableOpacity>
              </View>
            </View>
          </Card>
        )}
      />

      <Modal visible={formVisible} animationType="slide" presentationStyle="formSheet">
        <ScrollView style={styles.modalContainer} contentContainerStyle={{ padding: 24 }}>
          <Typography variant="h2" style={{ marginBottom: 16 }}>{editingId ? 'Edit Package' : 'Add Package'}</Typography>

          <Typography variant="caption" style={{ marginBottom: 8 }}>Category</Typography>
          <View style={styles.chipRow}>
            {categories.map((c: any) => (
              <TouchableOpacity key={c.id} style={[styles.chip, form.categoryId === c.id && styles.chipActive]} onPress={() => setForm({ ...form, categoryId: c.id })}>
                <Typography variant="caption" style={{ color: form.categoryId === c.id ? '#fff' : colors.text }}>{c.name}</Typography>
              </TouchableOpacity>
            ))}
          </View>

          <Input label="Package Name" value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} placeholder="e.g. Standard Battery Replacement" containerStyle={{ marginTop: 12, marginBottom: 12 }} />
          <Input label="Description" value={form.description} onChangeText={(t) => setForm({ ...form, description: t })} multiline containerStyle={{ marginBottom: 12 }} />

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Input label="Price (₹)" keyboardType="numeric" value={form.price} onChangeText={(t) => setForm({ ...form, price: t })} containerStyle={{ flex: 1 }} />
            <Input label="Discount (₹)" keyboardType="numeric" value={form.discountPrice} onChangeText={(t) => setForm({ ...form, discountPrice: t })} containerStyle={{ flex: 1 }} />
            <Input label="Mins" keyboardType="numeric" value={form.estimatedMinutes} onChangeText={(t) => setForm({ ...form, estimatedMinutes: t })} containerStyle={{ flex: 1 }} />
          </View>

          <Input label="Included Services (comma separated)" value={form.includedServices} onChangeText={(t) => setForm({ ...form, includedServices: t })} placeholder="e.g. Battery testing, Replacement" containerStyle={{ marginTop: 4, marginBottom: 12 }} />

          <Typography variant="caption" style={{ marginBottom: 8 }}>Service Image</Typography>
          {form.image ? <Image source={{ uri: form.image }} style={{ width: '100%', height: 140, borderRadius: 12, marginBottom: 8 }} /> : null}
          <Button title={uploading ? 'Uploading...' : form.image ? 'Replace Image' : 'Upload Image'} variant="outline" onPress={pickImage} loading={uploading} />

          <View style={{ marginTop: 16, gap: 10 }}>
            <View style={styles.switchRow}>
              <Typography variant="body">Popular</Typography>
              <Switch value={form.isPopular} onValueChange={(v) => setForm({ ...form, isPopular: v })} trackColor={{ false: colors.border, true: colors.success }} />
            </View>
            <View style={styles.switchRow}>
              <Typography variant="body">Recommended</Typography>
              <Switch value={form.isRecommended} onValueChange={(v) => setForm({ ...form, isRecommended: v })} trackColor={{ false: colors.border, true: colors.success }} />
            </View>
            <View style={styles.switchRow}>
              <Typography variant="body">Emergency</Typography>
              <Switch value={form.isEmergency} onValueChange={(v) => setForm({ ...form, isEmergency: v })} trackColor={{ false: colors.border, true: colors.success }} />
            </View>
            <View style={styles.switchRow}>
              <Typography variant="body">Active</Typography>
              <Switch value={form.isActive} onValueChange={(v) => setForm({ ...form, isActive: v })} trackColor={{ false: colors.border, true: colors.success }} />
            </View>
          </View>

          <Button title="Save Package" onPress={handleSave} loading={saveMutation.isPending} style={{ marginTop: 20 }} />
          <Button title="Cancel" variant="outline" onPress={closeForm} style={{ marginTop: 8 }} />
        </ScrollView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 8 },
  modalContainer: { flex: 1, backgroundColor: colors.background },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: colors.surfaceHover },
  chipActive: { backgroundColor: colors.primary },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
