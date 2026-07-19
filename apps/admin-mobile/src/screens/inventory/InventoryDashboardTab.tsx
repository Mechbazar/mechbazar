import React, { useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert, Modal, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { colors, Typography, Card, Button, Input, Badge, Loader, adminService, getApiBaseUrl } from '@mechbazar/shared';
import { Package } from 'lucide-react-native';

const getUploadUrl = (path: string) => `${getApiBaseUrl().replace(/\/api\/?$/, '')}${path}`;

const FILTERS = ['ALL', 'IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK'] as const;
const ACTION_TYPES = ['ADJUSTMENT', 'DAMAGE', 'RETURN'];

const getStockMeta = (inv: any): { label: string; variant: 'success' | 'warning' | 'danger' } => {
  if (inv.availableStock === 0) return { label: 'Out of Stock', variant: 'danger' };
  if (inv.availableStock <= inv.reorderLevel) return { label: 'Low Stock', variant: 'warning' };
  return { label: 'In Stock', variant: 'success' };
};

// Mirrors apps/admin/src/pages/inventory/InventoryDashboard.tsx: same KPI
// definitions (Total Products, Available Stock, Low Stock, Out of Stock),
// same ALL/IN_STOCK/LOW_STOCK/OUT_OF_STOCK filter, same Adjust Stock modal.
export const InventoryDashboardTab = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('ALL');
  const [adjustTarget, setAdjustTarget] = useState<any>(null);
  const [newQuantity, setNewQuantity] = useState('');
  const [actionType, setActionType] = useState('ADJUSTMENT');
  const [reason, setReason] = useState('');

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['admin-inventory'],
    queryFn: adminService.getInventory,
  });

  const inventory = data || [];

  const adjustMutation = useMutation({
    mutationFn: (payload: any) => adminService.adjustStock(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-inventory'] });
      setAdjustTarget(null);
    },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.error || 'Failed to adjust stock'),
  });

  const kpis = useMemo(() => ({
    total: inventory.length,
    available: inventory.reduce((sum: number, i: any) => sum + (i.availableStock || 0), 0),
    low: inventory.filter((i: any) => i.availableStock > 0 && i.availableStock <= i.reorderLevel).length,
    out: inventory.filter((i: any) => i.availableStock === 0).length,
  }), [inventory]);

  const filtered = useMemo(() => {
    return inventory.filter((inv: any) => {
      if (filter === 'IN_STOCK' && !(inv.availableStock > inv.reorderLevel)) return false;
      if (filter === 'LOW_STOCK' && !(inv.availableStock > 0 && inv.availableStock <= inv.reorderLevel)) return false;
      if (filter === 'OUT_OF_STOCK' && inv.availableStock !== 0) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!inv.product?.name?.toLowerCase().includes(q) && !inv.product?.sku?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [inventory, filter, search]);

  const openAdjust = (inv: any) => {
    setAdjustTarget(inv);
    setNewQuantity(String(inv.availableStock));
    setActionType('ADJUSTMENT');
    setReason('');
  };

  const handleAdjust = () => {
    if (!reason.trim()) {
      Alert.alert('Error', 'Reason is required.');
      return;
    }
    adjustMutation.mutate({
      inventoryId: adjustTarget.id,
      newQuantity: Number(newQuantity) || 0,
      reason: reason.trim(),
      actionType,
    });
  };

  if (isLoading && !isRefetching) return <Loader fullScreen />;

  return (
    <View style={styles.container}>
      <View style={styles.kpiRow}>
        <Card style={styles.kpiCard}><Typography variant="caption">Total Products</Typography><Typography variant="h3">{kpis.total}</Typography></Card>
        <Card style={styles.kpiCard}><Typography variant="caption">Available Stock</Typography><Typography variant="h3">{kpis.available}</Typography></Card>
      </View>
      <View style={styles.kpiRow}>
        <Card style={styles.kpiCard}><Typography variant="caption">Low Stock</Typography><Typography variant="h3" style={{ color: colors.warning }}>{kpis.low}</Typography></Card>
        <Card style={styles.kpiCard}><Typography variant="caption">Out of Stock</Typography><Typography variant="h3" style={{ color: colors.danger }}>{kpis.out}</Typography></Card>
      </View>

      <View style={{ paddingHorizontal: 16 }}>
        <Input placeholder="Search product, SKU..." value={search} onChangeText={setSearch} />
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity key={f} style={[styles.filterChip, filter === f && styles.filterChipActive]} onPress={() => setFilter(f)}>
            <Typography variant="caption" style={{ color: filter === f ? '#fff' : colors.text }}>{f.replace(/_/g, ' ')}</Typography>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<Typography variant="body" style={{ textAlign: 'center', marginTop: 20, color: colors.textSecondary }}>No inventory records found.</Typography>}
        renderItem={({ item }) => {
          const meta = getStockMeta(item);
          return (
            <Card style={styles.card}>
              <View style={{ flexDirection: 'row' }}>
                {item.product?.images?.[0] ? (
                  <Image source={{ uri: getUploadUrl(item.product.images[0]) }} style={styles.productImg} />
                ) : (
                  <View style={[styles.productImg, styles.productImgFallback]}><Package color={colors.textSecondary} size={20} /></View>
                )}
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Typography variant="h3" numberOfLines={1}>{item.product?.name}</Typography>
                  <Typography variant="caption">{item.warehouse?.name} • SKU: {item.product?.sku || 'N/A'}</Typography>
                </View>
                <Badge label={meta.label} variant={meta.variant} size="sm" />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
                <Typography variant="caption">Available: {item.availableStock}</Typography>
                <Typography variant="caption">Reserved: {item.reservedStock}</Typography>
                <Typography variant="caption">Damaged: {item.damagedStock}</Typography>
              </View>
              <Button title="Manage" variant="outline" size="sm" onPress={() => openAdjust(item)} style={{ marginTop: 12 }} />
            </Card>
          );
        }}
      />

      <Modal visible={!!adjustTarget} animationType="slide" presentationStyle="formSheet">
        <ScrollView style={styles.modalContainer} contentContainerStyle={{ padding: 24 }}>
          <Typography variant="h2" style={{ marginBottom: 16 }}>Adjust Stock</Typography>
          {adjustTarget && (
            <>
              <Typography variant="body" style={{ marginBottom: 12 }}>{adjustTarget.product?.name} — {adjustTarget.warehouse?.name}</Typography>
              <Input label="New Quantity" value={newQuantity} onChangeText={setNewQuantity} keyboardType="numeric" containerStyle={{ marginBottom: 12 }} />

              <Typography variant="caption" style={{ marginBottom: 8 }}>Action Type</Typography>
              <View style={styles.filterRow}>
                {ACTION_TYPES.map((a) => (
                  <TouchableOpacity key={a} style={[styles.filterChip, actionType === a && styles.filterChipActive]} onPress={() => setActionType(a)}>
                    <Typography variant="caption" style={{ color: actionType === a ? '#fff' : colors.text }}>{a}</Typography>
                  </TouchableOpacity>
                ))}
              </View>

              <Input label="Reason" value={reason} onChangeText={setReason} multiline containerStyle={{ marginVertical: 12 }} />
              <Button title="Save Adjustment" onPress={handleAdjust} loading={adjustMutation.isPending} />
              <Button title="Cancel" variant="outline" onPress={() => setAdjustTarget(null)} style={{ marginTop: 8 }} />
            </>
          )}
        </ScrollView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  kpiRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, marginBottom: 12 },
  kpiCard: { flex: 1, alignItems: 'center' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 8, marginTop: 12 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: colors.surfaceHover },
  filterChipActive: { backgroundColor: colors.primary },
  card: { marginBottom: 12 },
  productImg: { width: 44, height: 44, borderRadius: 8 },
  productImgFallback: { backgroundColor: colors.surfaceHover, justifyContent: 'center', alignItems: 'center' },
  modalContainer: { flex: 1, backgroundColor: colors.background },
});
