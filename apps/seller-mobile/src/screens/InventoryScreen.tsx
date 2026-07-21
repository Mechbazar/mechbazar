import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { colors, Typography, Card, Badge, Loader, vendorService } from '@mechbazar/shared';
import { Warehouse, AlertTriangle, TrendingDown, CheckCircle } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';

type Filter = 'all' | 'low' | 'out';

const getStockStatus = (inv: any): { label: string; variant: 'danger' | 'warning' | 'success'; icon: any } => {
  if (inv.availableStock === 0) return { label: 'Out of Stock', variant: 'danger', icon: AlertTriangle };
  if (inv.availableStock < inv.reorderLevel) return { label: 'Low Stock', variant: 'warning', icon: TrendingDown };
  return { label: 'In Stock', variant: 'success', icon: CheckCircle };
};

export const InventoryScreen = () => {
  const [filter, setFilter] = useState<Filter>('all');

  const { data: inventory = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['vendor-inventory'],
    queryFn: vendorService.getInventory,
  });

  const lowCount = inventory.filter((i: any) => i.availableStock < i.reorderLevel && i.availableStock > 0).length;
  const outCount = inventory.filter((i: any) => i.availableStock === 0).length;

  const filtered = inventory.filter((inv: any) => {
    if (filter === 'low') return inv.availableStock < inv.reorderLevel && inv.availableStock > 0;
    if (filter === 'out') return inv.availableStock === 0;
    return true;
  });

  if (isLoading && !isRefetching) {
    return <Loader size="large" color={colors.primary} style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
    >
      <Typography variant="h2" style={{ marginBottom: 4 }}>Inventory</Typography>
      <Typography variant="body" style={{ color: colors.textSecondary, marginBottom: 16 }}>
        Live stock levels for your products across warehouses
      </Typography>

      <View style={styles.filterRow}>
        {([
          { key: 'all', label: `All (${inventory.length})` },
          { key: 'low', label: `Low (${lowCount})` },
          { key: 'out', label: `Out (${outCount})` },
        ] as { key: Filter; label: string }[]).map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            onPress={() => setFilter(key)}
            style={[styles.chip, filter === key && styles.chipActive]}
          >
            <Typography variant="caption" style={{ color: filter === key ? '#ffffff' : colors.text }}>{label}</Typography>
          </TouchableOpacity>
        ))}
      </View>

      {filtered.length === 0 ? (
        <Card style={{ alignItems: 'center', padding: 32 }}>
          <Warehouse color={colors.textSecondary} size={40} />
          <Typography variant="body" style={{ marginTop: 12, textAlign: 'center', color: colors.textSecondary }}>
            No inventory records yet. Once your products are stocked in a warehouse, levels will appear here.
          </Typography>
        </Card>
      ) : (
        filtered.map((inv: any) => {
          const status = getStockStatus(inv);
          return (
            <Card key={inv.id} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Typography variant="body" style={{ fontWeight: '700' }}>{inv.product?.name}</Typography>
                  <Typography variant="caption" style={{ color: colors.textSecondary, marginTop: 2 }}>
                    {inv.warehouse?.name || 'N/A'} {inv.warehouse?.city ? `• ${inv.warehouse.city}` : ''}
                  </Typography>
                </View>
                <Badge label={status.label} variant={status.variant} size="sm" />
              </View>
              <View style={styles.statsRow}>
                <View>
                  <Typography variant="h3">{inv.availableStock}</Typography>
                  <Typography variant="caption" style={{ color: colors.textSecondary }}>Available</Typography>
                </View>
                <View>
                  <Typography variant="h3">{inv.reservedStock ?? 0}</Typography>
                  <Typography variant="caption" style={{ color: colors.textSecondary }}>Reserved</Typography>
                </View>
                <View>
                  <Typography variant="h3">{inv.reorderLevel ?? 10}</Typography>
                  <Typography variant="caption" style={{ color: colors.textSecondary }}>Reorder At</Typography>
                </View>
              </View>
            </Card>
          );
        })
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.surfaceHover },
  chipActive: { backgroundColor: colors.primary },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
});
