import React, { useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { colors, Typography, Card, Input, Badge, Loader, adminService } from '@mechbazar/shared';

const getStatusMeta = (status: string): { label: string; variant: 'success' | 'warning' | 'danger' | 'secondary' } => {
  switch (status) {
    case 'PENDING':
    case 'PROCESSING':
      return { label: 'Pending', variant: 'warning' };
    case 'COMPLETED':
      return { label: 'Completed', variant: 'success' };
    case 'FAILED':
      return { label: 'Failed', variant: 'danger' };
    default:
      return { label: status, variant: 'secondary' };
  }
};

// Mirrors apps/admin/src/pages/RiderPayouts.tsx's list; detail/process
// actions live on the pushed RiderPayoutDetailScreen. Same shape as
// PayoutsScreen.tsx (vendor), just keyed on deliveryPartner instead of vendor.
export const RiderPayoutsScreen = () => {
  const navigation = useNavigation<any>();
  const [search, setSearch] = useState('');

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['admin-rider-settlements'],
    queryFn: adminService.getRiderSettlements,
  });

  const settlements = data || [];

  const filtered = useMemo(() => {
    if (!search) return settlements;
    const q = search.toLowerCase();
    return settlements.filter((s: any) => s.deliveryPartner?.user?.name?.toLowerCase().includes(q) || s.deliveryPartner?.user?.phone?.includes(q));
  }, [settlements, search]);

  if (isLoading && !isRefetching) return <Loader fullScreen />;

  return (
    <View style={styles.container}>
      <Typography variant="h2" style={{ padding: 16, paddingBottom: 8 }}>Rider Payouts</Typography>

      <View style={{ paddingHorizontal: 16 }}>
        <Input placeholder="Search rider, phone..." value={search} onChangeText={setSearch} />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<Typography variant="body" style={{ textAlign: 'center', marginTop: 20, color: colors.textSecondary }}>No payout requests found.</Typography>}
        renderItem={({ item }) => {
          const meta = getStatusMeta(item.status);
          return (
            <TouchableOpacity onPress={() => navigation.navigate('RiderPayoutDetail', { settlementId: item.id })}>
              <Card style={styles.card}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <View>
                    <Typography variant="h3">{item.deliveryPartner?.user?.name || 'Unknown Rider'}</Typography>
                    <Typography variant="caption">{item.deliveryPartner?.user?.phone}</Typography>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Typography variant="body" style={{ fontWeight: '700' }}>₹{item.amount?.toLocaleString()}</Typography>
                    <Badge label={meta.label} variant={meta.variant} size="sm" style={{ marginTop: 4 }} />
                  </View>
                </View>
                <Typography variant="caption" style={{ marginTop: 8 }}>{new Date(item.date).toLocaleDateString()}</Typography>
              </Card>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  card: { marginBottom: 12 },
});
