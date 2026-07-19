import React, { useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { colors, Typography, Card, Loader, technicianService } from '@mechbazar/shared';
import { Booking, isNew, isAccepted, isOngoing, isCompletedBooking, isCancelledBooking } from '../utils/bookings';

type SegmentKey = 'new' | 'accepted' | 'ongoing' | 'completed' | 'cancelled';
const SEGMENTS: { key: SegmentKey; label: string }[] = [
  { key: 'new', label: 'New' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'ongoing', label: 'Ongoing' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const SEGMENT_FILTERS: Record<SegmentKey, (b: Booking) => boolean> = {
  new: isNew,
  accepted: isAccepted,
  ongoing: isOngoing,
  completed: isCompletedBooking,
  cancelled: isCancelledBooking,
};

export const BookingsScreen = () => {
  const navigation = useNavigation<any>();
  const [segment, setSegment] = useState<SegmentKey>('new');
  const isFocused = useIsFocused();

  const { data, isLoading, refetch, isRefetching } = useQuery<Booking[]>({
    queryKey: ['technician-bookings'],
    queryFn: technicianService.getMyBookings,
    refetchInterval: isFocused ? 30000 : false,
  });

  useFocusEffect(
    React.useCallback(() => {
      refetch();
    }, [refetch])
  );

  const list = data || [];
  const filtered = list.filter(SEGMENT_FILTERS[segment]);

  if (isLoading && !isRefetching) return <Loader fullScreen />;

  return (
    <View style={styles.container}>
      <Typography variant="h2" style={{ padding: 16, paddingBottom: 8 }}>My Bookings</Typography>

      <View style={styles.segmentRow}>
        {SEGMENTS.map((s) => (
          <TouchableOpacity
            key={s.key}
            style={[styles.segment, segment === s.key && styles.segmentActive]}
            onPress={() => setSegment(s.key)}
          >
            <Typography
              variant="caption"
              style={{ color: segment === s.key ? '#ffffff' : colors.textSecondary, fontWeight: '600' }}
            >
              {s.label}
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
            No bookings here.
          </Typography>
        }
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => navigation.navigate('BookingDetail', { bookingId: item.id })}>
            <Card style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Typography variant="h3">#{item.bookingNumber}</Typography>
                <Typography variant="caption" style={{ color: colors.primary, fontWeight: '600' }}>{item.status}</Typography>
              </View>
              <Typography variant="body" style={{ marginTop: 4 }}>
                {item.category?.name}{item.package?.name ? ` — ${item.package.name}` : ''}
              </Typography>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                <Typography variant="caption" style={{ color: colors.textSecondary }}>
                  {item.address?.city}
                </Typography>
                <Typography variant="caption" style={{ color: colors.textSecondary }}>
                  {new Date(item.scheduledDate).toLocaleDateString()} • {item.timeSlot?.label}
                </Typography>
              </View>
            </Card>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  segmentRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  segment: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', backgroundColor: colors.surfaceHover },
  segmentActive: { backgroundColor: colors.primary },
  card: { marginBottom: 12 },
});
