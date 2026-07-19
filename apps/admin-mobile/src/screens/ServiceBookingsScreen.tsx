import React, { useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert, Modal, ScrollView, TouchableOpacity } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { colors, Typography, Card, Button, Input, Badge, Loader, adminService } from '@mechbazar/shared';
import { X, MapPin, Star, Navigation as NavigationIcon } from 'lucide-react-native';

const TABS: { label: string; statuses?: string[] }[] = [
  { label: 'All' },
  { label: 'Pending', statuses: ['PENDING', 'CONFIRMED'] },
  { label: 'Assigned', statuses: ['MECHANIC_ASSIGNED'] },
  { label: 'Accepted', statuses: ['MECHANIC_ACCEPTED'] },
  { label: 'On The Way', statuses: ['MECHANIC_ON_THE_WAY'] },
  { label: 'In Progress', statuses: ['ARRIVED', 'WORK_STARTED'] },
  { label: 'Completed', statuses: ['COMPLETED'] },
  { label: 'Cancelled', statuses: ['CANCELLED'] },
  { label: 'Rejected', statuses: ['REJECTED'] },
];

// Admin can force these transitions for support/escalation use, same as the
// web admin's ServiceBookingsPage.tsx quick-actions. Completing this way
// skips the technician-side OTP check, so it carries an extra confirmation.
const ADMIN_STATUS_ACTIONS: Record<string, { next: string; label: string }[]> = {
  MECHANIC_ACCEPTED: [{ next: 'MECHANIC_ON_THE_WAY', label: 'Start Service' }],
  MECHANIC_ON_THE_WAY: [{ next: 'ARRIVED', label: 'Mark Arrived' }],
  ARRIVED: [{ next: 'WORK_STARTED', label: 'Start Service' }],
  WORK_STARTED: [{ next: 'COMPLETED', label: 'Complete Service' }],
};

const getStatusVariant = (status: string): 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info' => {
  switch (status) {
    case 'PENDING':
    case 'CONFIRMED': return 'secondary';
    case 'MECHANIC_ASSIGNED': return 'warning';
    case 'MECHANIC_ACCEPTED':
    case 'MECHANIC_ON_THE_WAY':
    case 'ARRIVED':
    case 'WORK_STARTED': return 'primary';
    case 'COMPLETED': return 'success';
    case 'CANCELLED':
    case 'REJECTED': return 'danger';
    default: return 'secondary';
  }
};

// Mirrors apps/admin/src/pages/ServiceBookingsPage.tsx's feature set (status
// tabs, search, Assign Mechanic candidate comparison, admin quick-actions,
// Cancel), adapted to this app's single-full-fetch-then-filter convention
// (same one adminService.getAllOrders/OrdersListScreen.tsx already uses --
// booking volume doesn't yet justify a new pagination UX in this app).
export const ServiceBookingsScreen = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('All');
  const [search, setSearch] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  const [assignMode, setAssignMode] = useState(false);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['admin-service-bookings'],
    queryFn: () => adminService.getServiceBookings(),
  });

  const bookings = Array.isArray(data) ? data : [];
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-service-bookings'] });

  const assignMutation = useMutation({
    mutationFn: ({ bookingId, technicianId }: { bookingId: string; technicianId: string }) =>
      adminService.assignTechnicianToBooking(bookingId, technicianId),
    onSuccess: () => {
      invalidate();
      setAssignMode(false);
      setSelectedBooking(null);
    },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.error || 'Failed to assign technician'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ bookingId, status }: { bookingId: string; status: string }) =>
      adminService.updateServiceBookingAdminStatus(bookingId, status),
    onSuccess: () => {
      invalidate();
      setSelectedBooking(null);
    },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.error || 'Failed to update booking'),
  });

  const filtered = useMemo(() => {
    return bookings.filter((b: any) => {
      const tab = TABS.find((t) => t.label === activeTab);
      if (tab?.statuses && !tab.statuses.includes(b.status)) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          b.bookingNumber?.toLowerCase().includes(q) ||
          b.user?.name?.toLowerCase().includes(q) ||
          b.user?.phone?.includes(q)
        );
      }
      return true;
    });
  }, [bookings, activeTab, search]);

  const openAssignMode = async (booking: any) => {
    setAssignMode(true);
    setCandidates([]);
    setCandidatesLoading(true);
    try {
      const res = await adminService.getAssignableTechniciansForBooking(booking.id);
      setCandidates(res || []);
    } catch (err) {
      Alert.alert('Error', 'Failed to load assignable technicians');
    } finally {
      setCandidatesLoading(false);
    }
  };

  const handleCancel = (bookingId: string) => {
    Alert.alert('Cancel Booking', 'Cancel this booking?', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes, Cancel', style: 'destructive', onPress: () => statusMutation.mutate({ bookingId, status: 'CANCELLED' }) },
    ]);
  };

  const handleStatusAction = (bookingId: string, next: string, label: string) => {
    const message =
      next === 'COMPLETED'
        ? `${label}? This skips the technician's OTP confirmation from the customer -- only use this for support overrides.`
        : `${label} for this booking?`;
    Alert.alert(label, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: label, onPress: () => statusMutation.mutate({ bookingId, status: next }) },
    ]);
  };

  const closeModal = () => {
    setSelectedBooking(null);
    setAssignMode(false);
    setCandidates([]);
  };

  if (isLoading && !isRefetching) return <Loader fullScreen />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Typography variant="h2">Service Bookings</Typography>
      </View>

      <View style={{ paddingHorizontal: 16 }}>
        <Input
          placeholder="Search booking #, name, phone..."
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View style={styles.tabRow}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.label}
            style={[styles.tab, activeTab === tab.label && styles.tabActive]}
            onPress={() => setActiveTab(tab.label)}
          >
            <Typography variant="caption" style={{ color: activeTab === tab.label ? '#ffffff' : colors.textSecondary, fontWeight: '600' }}>
              {tab.label}
            </Typography>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          <Typography variant="body" style={{ textAlign: 'center', marginTop: 20, color: colors.textSecondary }}>
            {isError ? `Could not load bookings. ${(error as any)?.response?.data?.error || (error as any)?.message || 'Please try again.'}` : 'No bookings found.'}
          </Typography>
        }
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => setSelectedBooking(item)}>
            <Card style={styles.bookingCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Typography variant="h3">#{item.bookingNumber}</Typography>
                <Badge label={item.status.replace(/_/g, ' ')} variant={getStatusVariant(item.status)} size="sm" />
              </View>
              <Typography variant="body" style={{ marginTop: 6 }}>{item.user?.name || 'Unknown'}</Typography>
              <Typography variant="caption">{item.user?.phone} • {item.vehicleBrand} {item.vehicleModel} ({item.vehicleType})</Typography>
              <Typography variant="caption" style={{ marginTop: 2 }}>{new Date(item.scheduledDate).toLocaleDateString()} • ₹{item.finalAmount}</Typography>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <Typography variant="caption" style={{ color: colors.textSecondary }}>
                  {item.technician ? `Mechanic: ${item.technician.user?.name}` : 'Unassigned'}
                </Typography>
                <Badge
                  label={item.payment?.status === 'SUCCESS' ? 'Paid' : item.payment?.status === 'REFUNDED' ? 'Refunded' : 'Unpaid'}
                  variant={item.payment?.status === 'SUCCESS' ? 'success' : item.payment?.status === 'REFUNDED' ? 'warning' : 'secondary'}
                  size="sm"
                />
              </View>
            </Card>
          </TouchableOpacity>
        )}
      />

      <Modal visible={!!selectedBooking} animationType="slide" presentationStyle="formSheet" onRequestClose={closeModal}>
        <ScrollView style={styles.modalContainer} contentContainerStyle={{ padding: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Typography variant="h2">Booking #{selectedBooking?.bookingNumber}</Typography>
            <TouchableOpacity onPress={closeModal}><X color={colors.textSecondary} size={24} /></TouchableOpacity>
          </View>

          {selectedBooking && !assignMode && (
            <>
              <Badge label={selectedBooking.status.replace(/_/g, ' ')} variant={getStatusVariant(selectedBooking.status)} size="md" style={{ marginBottom: 12 }} />

              <Typography variant="caption" style={{ color: colors.textSecondary }}>Customer</Typography>
              <Typography variant="body" style={{ fontWeight: '700', marginBottom: 8 }}>{selectedBooking.user?.name} • {selectedBooking.user?.phone}</Typography>

              {selectedBooking.address && (
                <>
                  <Typography variant="caption" style={{ color: colors.textSecondary }}>Address</Typography>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 }}>
                    <MapPin color={colors.textSecondary} size={14} style={{ marginTop: 2, marginRight: 4 }} />
                    <Typography variant="body" style={{ flex: 1 }}>
                      {selectedBooking.address.line1}, {selectedBooking.address.city}, {selectedBooking.address.state} {selectedBooking.address.pincode}
                    </Typography>
                  </View>
                </>
              )}

              <Typography variant="caption" style={{ color: colors.textSecondary }}>Vehicle</Typography>
              <Typography variant="body" style={{ marginBottom: 8 }}>{selectedBooking.vehicleBrand} {selectedBooking.vehicleModel} ({selectedBooking.vehicleType})</Typography>

              <Typography variant="caption" style={{ color: colors.textSecondary }}>Service</Typography>
              <Typography variant="body" style={{ marginBottom: 8 }}>{selectedBooking.package?.name}</Typography>

              <Typography variant="caption" style={{ color: colors.textSecondary }}>Scheduled</Typography>
              <Typography variant="body" style={{ marginBottom: 8 }}>{new Date(selectedBooking.scheduledDate).toLocaleDateString()}</Typography>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                <View>
                  <Typography variant="caption" style={{ color: colors.textSecondary }}>Payment</Typography>
                  <Badge
                    label={selectedBooking.payment?.status === 'SUCCESS' ? 'Paid' : selectedBooking.payment?.status === 'REFUNDED' ? 'Refunded' : 'Unpaid'}
                    variant={selectedBooking.payment?.status === 'SUCCESS' ? 'success' : selectedBooking.payment?.status === 'REFUNDED' ? 'warning' : 'secondary'}
                    size="sm"
                  />
                </View>
                <View>
                  <Typography variant="caption" style={{ color: colors.textSecondary }}>Amount</Typography>
                  <Typography variant="body" style={{ fontWeight: '700' }}>₹{selectedBooking.finalAmount}</Typography>
                </View>
              </View>

              <Typography variant="caption" style={{ color: colors.textSecondary }}>Assigned Mechanic</Typography>
              <Typography variant="body" style={{ marginBottom: 16 }}>
                {selectedBooking.technician ? selectedBooking.technician.user?.name : 'Unassigned'}
              </Typography>

              {!['COMPLETED', 'CANCELLED'].includes(selectedBooking.status) && (
                <Button
                  title={selectedBooking.technician ? 'Reassign Mechanic' : 'Assign Mechanic'}
                  onPress={() => openAssignMode(selectedBooking)}
                  style={{ marginBottom: 8 }}
                />
              )}

              {(ADMIN_STATUS_ACTIONS[selectedBooking.status] || []).map((action) => (
                <Button
                  key={action.next}
                  title={action.label}
                  variant="outline"
                  loading={statusMutation.isPending}
                  onPress={() => handleStatusAction(selectedBooking.id, action.next, action.label)}
                  style={{ marginBottom: 8 }}
                />
              ))}

              {!['COMPLETED', 'CANCELLED'].includes(selectedBooking.status) && (
                <Button
                  title="Cancel Booking"
                  variant="outline"
                  loading={statusMutation.isPending}
                  onPress={() => handleCancel(selectedBooking.id)}
                  style={{ marginBottom: 8 }}
                />
              )}
            </>
          )}

          {selectedBooking && assignMode && (
            <>
              <TouchableOpacity onPress={() => setAssignMode(false)} style={{ marginBottom: 12 }}>
                <Typography variant="body" style={{ color: colors.primary }}>{'< Back to details'}</Typography>
              </TouchableOpacity>

              {candidatesLoading ? (
                <Loader />
              ) : candidates.length === 0 ? (
                <Typography variant="body" style={{ textAlign: 'center', marginTop: 20, color: colors.textSecondary }}>
                  No approved mechanics match this booking's vehicle type.
                </Typography>
              ) : (
                candidates.map((c) => (
                  <Card key={c.id} style={{ marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flex: 1 }}>
                        <Typography variant="h3">{c.name}</Typography>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Star color={colors.warning} size={12} />
                            <Typography variant="caption" style={{ marginLeft: 2 }}>{(c.rating || 0).toFixed(1)}</Typography>
                          </View>
                          <Typography variant="caption">{c.experienceYears != null ? `${c.experienceYears} yrs exp` : 'Exp N/A'}</Typography>
                          {c.distanceKm != null && (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <NavigationIcon color={colors.textSecondary} size={12} />
                              <Typography variant="caption" style={{ marginLeft: 2 }}>{c.distanceKm.toFixed(1)} km</Typography>
                            </View>
                          )}
                          <Typography variant="caption">{c.currentJobs} active</Typography>
                          <Typography variant="caption" style={{ color: c.isOnline ? colors.success : colors.textSecondary }}>
                            {c.isOnline ? 'Online' : 'Offline'}
                          </Typography>
                        </View>
                      </View>
                      <Button
                        title="Assign"
                        size="sm"
                        loading={assignMutation.isPending}
                        onPress={() => assignMutation.mutate({ bookingId: selectedBooking.id, technicianId: c.id })}
                      />
                    </View>
                  </Card>
                ))
              )}
            </>
          )}
        </ScrollView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: 16, paddingBottom: 8 },
  tabRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 6, marginTop: 12, marginBottom: 4, flexWrap: 'wrap' },
  tab: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.surfaceHover },
  tabActive: { backgroundColor: colors.primary },
  bookingCard: { marginBottom: 12 },
  modalContainer: { flex: 1, backgroundColor: colors.background },
});
