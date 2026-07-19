import React, { useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert, Modal, ScrollView, TouchableOpacity } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { colors, Typography, Card, Button, Input, Badge, Loader, adminService } from '@mechbazar/shared';
import { Trash2, Edit2 } from 'lucide-react-native';

const emptyForm = { label: '', startTime: '', endTime: '', maxBookingsPerSlot: '20', isActive: true, sortOrder: 0 };

// Mirrors apps/admin/src/pages/services/ServiceTimeSlots.tsx -- booking
// windows customers can pick from, with a per-slot daily capacity.
export const ServiceTimeSlotsScreen = () => {
  const queryClient = useQueryClient();
  const [formVisible, setFormVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['admin-time-slots'],
    queryFn: adminService.getTimeSlots,
  });

  const slots = [...(data || [])].sort((a: any, b: any) => a.sortOrder - b.sortOrder);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-time-slots'] });

  const saveMutation = useMutation({
    mutationFn: (payload: any) => (editingId ? adminService.updateTimeSlot(editingId, payload) : adminService.createTimeSlot(payload)),
    onSuccess: () => { invalidate(); closeForm(); },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.error || 'Failed to save time slot'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminService.deleteTimeSlot(id),
    onSuccess: invalidate,
    onError: (err: any) => Alert.alert('Error', err.response?.data?.error || 'Failed to delete time slot'),
  });

  const toggleMutation = useMutation({
    mutationFn: (slot: any) => adminService.updateTimeSlot(slot.id, { isActive: !slot.isActive }),
    onSuccess: invalidate,
  });

  const closeForm = () => {
    setFormVisible(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormVisible(true);
  };

  const openEdit = (slot: any) => {
    setEditingId(slot.id);
    setForm({
      label: slot.label, startTime: slot.startTime, endTime: slot.endTime,
      maxBookingsPerSlot: String(slot.maxBookingsPerSlot), isActive: slot.isActive, sortOrder: slot.sortOrder,
    });
    setFormVisible(true);
  };

  const handleSave = () => {
    if (!form.label.trim() || !form.startTime.trim() || !form.endTime.trim()) {
      Alert.alert('Error', 'Label, start time and end time are required.');
      return;
    }
    saveMutation.mutate({ ...form, maxBookingsPerSlot: Number(form.maxBookingsPerSlot) || 20 });
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Time Slot', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(id) },
    ]);
  };

  if (isLoading && !isRefetching) return <Loader fullScreen />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Typography variant="h2">Time Slots</Typography>
        <Button title="Add New" size="sm" onPress={openAdd} />
      </View>

      <FlatList
        data={slots}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        ListEmptyComponent={<Typography variant="body" style={{ textAlign: 'center', marginTop: 20, color: colors.textSecondary }}>No time slots configured yet.</Typography>}
        renderItem={({ item }) => (
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View>
                <Typography variant="h3">{item.label}</Typography>
                <Typography variant="caption">{item.startTime} – {item.endTime}</Typography>
                <Typography variant="caption">Max {item.maxBookingsPerSlot} bookings/day</Typography>
              </View>
              <TouchableOpacity onPress={() => toggleMutation.mutate(item)}>
                <Badge label={item.isActive ? 'Active' : 'Disabled'} variant={item.isActive ? 'success' : 'secondary'} size="sm" />
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', gap: 16, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
              <TouchableOpacity onPress={() => openEdit(item)}><Edit2 color={colors.navy} size={18} /></TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item.id)}><Trash2 color={colors.danger} size={18} /></TouchableOpacity>
            </View>
          </Card>
        )}
      />

      <Modal visible={formVisible} animationType="slide" presentationStyle="formSheet">
        <ScrollView style={styles.modalContainer} contentContainerStyle={{ padding: 24 }}>
          <Typography variant="h2" style={{ marginBottom: 16 }}>{editingId ? 'Edit Time Slot' : 'Add Time Slot'}</Typography>
          <Input label="Label" value={form.label} onChangeText={(t) => setForm({ ...form, label: t })} placeholder="e.g. 9:00 AM - 11:00 AM" containerStyle={{ marginBottom: 12 }} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Input label="Start Time (HH:MM)" value={form.startTime} onChangeText={(t) => setForm({ ...form, startTime: t })} placeholder="09:00" containerStyle={{ flex: 1 }} />
            <Input label="End Time (HH:MM)" value={form.endTime} onChangeText={(t) => setForm({ ...form, endTime: t })} placeholder="11:00" containerStyle={{ flex: 1 }} />
          </View>
          <Input
            label="Max Bookings Per Day"
            keyboardType="numeric"
            value={form.maxBookingsPerSlot}
            onChangeText={(t) => setForm({ ...form, maxBookingsPerSlot: t })}
            containerStyle={{ marginTop: 12 }}
          />

          <Button title="Save Time Slot" onPress={handleSave} loading={saveMutation.isPending} style={{ marginTop: 20 }} />
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
});
