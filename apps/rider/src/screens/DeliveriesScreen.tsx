import React, { useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { colors, Typography, Card, Loader, riderService } from '@mechbazar/shared';
import { Delivery, isPendingPickup, isInProgress, isCompleted } from '../utils/deliveries';
import { formatINR } from '../utils/currency';

type SegmentKey = 'pending' | 'inProgress' | 'completed';
const SEGMENTS: { key: SegmentKey; label: string }[] = [
  { key: 'pending', label: 'Pending Pickup' },
  { key: 'inProgress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
];

export const DeliveriesScreen = () => {
  const navigation = useNavigation<any>();
  const [segment, setSegment] = useState<SegmentKey>('pending');
  const isFocused = useIsFocused();

  const { data, isLoading, refetch, isRefetching } = useQuery<Delivery[]>({
    queryKey: ['rider-deliveries'],
    queryFn: riderService.getMyDeliveries,
    refetchInterval: isFocused ? 30000 : false,
  });

  useFocusEffect(
    React.useCallback(() => {
      refetch();
    }, [refetch])
  );

  const list = data || [];
  const filtered =
    segment === 'pending' ? list.filter(isPendingPickup)
    : segment === 'inProgress' ? list.filter(isInProgress)
    : list.filter(isCompleted);

  if (isLoading && !isRefetching) return <Loader fullScreen />;

  return (
    <View style={styles.container}>
      <Typography variant="h2" style={{ padding: 16, paddingBottom: 8 }}>My Deliveries</Typography>

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
            No deliveries here.
          </Typography>
        }
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => navigation.navigate('DeliveryDetail', { orderId: item.id })}>
            <Card style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Typography variant="h3">Order #{item.id.slice(-6).toUpperCase()}</Typography>
                <Typography variant="caption" style={{ color: colors.primary, fontWeight: '600' }}>{item.status}</Typography>
              </View>
              <Typography variant="body" style={{ marginTop: 4 }}>
                Drop: {item.address.line1}, {item.address.city}
              </Typography>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                <Typography variant="caption" style={{ color: colors.textSecondary }}>
                  {item.items.length} item{item.items.length === 1 ? '' : 's'}
                </Typography>
                {item.payment?.method === 'COD' && (
                  <Typography variant="caption" style={{ color: colors.danger, fontWeight: '700' }}>
                    COD: {formatINR(item.payment.amount)}
                  </Typography>
                )}
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
