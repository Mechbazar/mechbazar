import React, { useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert, Modal, ScrollView, TouchableOpacity, Image, Switch } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { colors, Typography, Card, Button, Input, Badge, Loader, adminService, getApiBaseUrl } from '@mechbazar/shared';
import { Trash2, Edit2, Image as ImageIcon } from 'lucide-react-native';

const getUploadUrl = (path: string) => (path?.startsWith('http') ? path : `${getApiBaseUrl().replace(/\/api\/?$/, '')}${path}`);

const BANNER_TYPES = ['HOMEPAGE', 'CATEGORY', 'PROMO'];
const emptyForm = { id: '', title: '', image: '', type: 'HOMEPAGE', link: '', isActive: true, startDate: '', endDate: '' };

// Mirrors apps/admin/src/pages/Banners.tsx. The web form takes a raw image
// URL text field; mobile additionally offers picking a photo and uploading
// it via POST /upload (the same endpoint apps/rider/apps/seller-mobile
// already use for proof/product photos) since a phone has a camera roll a
// desktop browser doesn't.
export const BannersScreen = () => {
  const queryClient = useQueryClient();
  const [formVisible, setFormVisible] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['admin-banners'],
    queryFn: adminService.getBanners,
  });

  const banners = data || [];
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-banners'] });

  const saveMutation = useMutation({
    mutationFn: (payload: any) => (form.id ? adminService.updateBanner(form.id, payload) : adminService.createBanner(payload)),
    onSuccess: () => { invalidate(); closeForm(); },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.error || 'Failed to save banner'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminService.deleteBanner(id),
    onSuccess: invalidate,
    onError: () => Alert.alert('Error', 'Failed to delete banner'),
  });

  const closeForm = () => {
    setFormVisible(false);
    setForm(emptyForm);
  };

  const openEdit = (b: any) => {
    setForm({
      id: b.id,
      title: b.title || '',
      image: b.image || '',
      type: b.type || 'HOMEPAGE',
      link: b.link || '',
      isActive: b.isActive,
      startDate: b.startDate ? new Date(b.startDate).toISOString().split('T')[0] : '',
      endDate: b.endDate ? new Date(b.endDate).toISOString().split('T')[0] : '',
    });
    setFormVisible(true);
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.7 });
    if (result.canceled) return;
    try {
      setUploading(true);
      const upload = await adminService.uploadImage(result.assets[0].uri, 'image/jpeg', 'banner.jpg');
      setForm((f) => ({ ...f, image: upload.url }));
    } catch {
      Alert.alert('Error', 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = () => {
    if (!form.title.trim() || !form.image.trim()) {
      Alert.alert('Error', 'Title and image are required.');
      return;
    }
    saveMutation.mutate({
      title: form.title,
      image: form.image,
      type: form.type,
      link: form.link || undefined,
      isActive: form.isActive,
      startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
      endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
    });
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Banner', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(id) },
    ]);
  };

  if (isLoading && !isRefetching) return <Loader fullScreen />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Typography variant="h2">Banners & CMS</Typography>
        <Button title="Add New" size="sm" onPress={() => { setForm(emptyForm); setFormVisible(true); }} />
      </View>

      <FlatList
        data={banners}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<Typography variant="body" style={{ textAlign: 'center', marginTop: 20, color: colors.textSecondary }}>No banners found.</Typography>}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            {item.image ? (
              <Image source={{ uri: getUploadUrl(item.image) }} style={styles.bannerImg} />
            ) : (
              <View style={[styles.bannerImg, styles.bannerImgFallback]}><ImageIcon color={colors.textSecondary} size={24} /></View>
            )}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
              <View style={{ flex: 1 }}>
                <Typography variant="h3" numberOfLines={1}>{item.title}</Typography>
                <Typography variant="caption">{item.type} • {item.startDate || item.endDate ? `${item.startDate ? new Date(item.startDate).toLocaleDateString() : '—'} to ${item.endDate ? new Date(item.endDate).toLocaleDateString() : '—'}` : 'Always Active'}</Typography>
              </View>
              <Badge label={item.isActive ? 'Active' : 'Inactive'} variant={item.isActive ? 'success' : 'secondary'} size="sm" />
            </View>
            <View style={{ flexDirection: 'row', gap: 16, marginTop: 12 }}>
              <TouchableOpacity onPress={() => openEdit(item)}><Edit2 color={colors.navy} size={18} /></TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item.id)}><Trash2 color={colors.danger} size={18} /></TouchableOpacity>
            </View>
          </Card>
        )}
      />

      <Modal visible={formVisible} animationType="slide" presentationStyle="formSheet">
        <ScrollView style={styles.modalContainer} contentContainerStyle={{ padding: 24 }}>
          <Typography variant="h2" style={{ marginBottom: 16 }}>{form.id ? 'Edit Banner' : 'Add Banner'}</Typography>
          <Input label="Title" value={form.title} onChangeText={(t) => setForm({ ...form, title: t })} containerStyle={{ marginBottom: 12 }} />

          <Button title={uploading ? 'Uploading...' : 'Pick Image'} variant="outline" onPress={handlePickImage} loading={uploading} style={{ marginBottom: 12 }} />
          {form.image ? <Image source={{ uri: getUploadUrl(form.image) }} style={{ width: '100%', height: 140, borderRadius: 8, marginBottom: 12 }} /> : null}
          <Input label="Or paste image URL" value={form.image} onChangeText={(t) => setForm({ ...form, image: t })} autoCapitalize="none" containerStyle={{ marginBottom: 12 }} />

          <Typography variant="caption" style={{ marginBottom: 8 }}>Type</Typography>
          <View style={styles.chipRow}>
            {BANNER_TYPES.map((t) => (
              <TouchableOpacity key={t} style={[styles.chip, form.type === t && styles.chipActive]} onPress={() => setForm({ ...form, type: t })}>
                <Typography variant="caption" style={{ color: form.type === t ? '#fff' : colors.text }}>{t}</Typography>
              </TouchableOpacity>
            ))}
          </View>

          <Input label="Link (optional)" value={form.link} onChangeText={(t) => setForm({ ...form, link: t })} autoCapitalize="none" containerStyle={{ marginVertical: 12 }} />
          <Input label="Start Date (YYYY-MM-DD, optional)" value={form.startDate} onChangeText={(t) => setForm({ ...form, startDate: t })} containerStyle={{ marginBottom: 12 }} />
          <Input label="End Date (YYYY-MM-DD, optional)" value={form.endDate} onChangeText={(t) => setForm({ ...form, endDate: t })} containerStyle={{ marginBottom: 12 }} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Typography variant="body">Active</Typography>
            <Switch value={form.isActive} onValueChange={(v) => setForm({ ...form, isActive: v })} trackColor={{ false: colors.border, true: colors.success }} />
          </View>

          <Button title="Save Banner" onPress={handleSave} loading={saveMutation.isPending} style={{ marginTop: 8 }} />
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
  bannerImg: { width: '100%', height: 120, borderRadius: 8 },
  bannerImgFallback: { backgroundColor: colors.surfaceHover, justifyContent: 'center', alignItems: 'center' },
  modalContainer: { flex: 1, backgroundColor: colors.background },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: colors.surfaceHover },
  chipActive: { backgroundColor: colors.primary },
});
