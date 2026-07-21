import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { colors, Typography } from '@mechbazar/shared';
import { LayoutDashboard, Warehouse, Truck, ClipboardList } from 'lucide-react-native';
import { InventoryDashboardTab } from './InventoryDashboardTab';
import { WarehousesTab } from './WarehousesTab';
import { SuppliersTab } from './SuppliersTab';
import { PurchaseOrdersTab } from './PurchaseOrdersTab';

const SEGMENTS = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'warehouses', label: 'Warehouses', icon: Warehouse },
  { key: 'suppliers', label: 'Suppliers', icon: Truck },
  { key: 'pos', label: 'Purchase Orders', icon: ClipboardList },
] as const;

// Mirrors apps/admin/src/pages/inventory/index.tsx's tab container exactly
// (dashboard/warehouses/suppliers/pos), just as a segmented control instead
// of a sidebar's secondary nav.
export const InventoryScreen = () => {
  const [active, setActive] = useState<(typeof SEGMENTS)[number]['key']>('dashboard');

  return (
    <View style={styles.container}>
      <Typography variant="h2" style={{ padding: 16, paddingBottom: 8 }}>Inventory System</Typography>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.segmentScroll} contentContainerStyle={styles.segmentRow}>
        {SEGMENTS.map((s) => (
          <TouchableOpacity key={s.key} style={[styles.segment, active === s.key && styles.segmentActive]} onPress={() => setActive(s.key)}>
            <s.icon color={active === s.key ? '#fff' : colors.textSecondary} size={16} />
            <Typography variant="caption" style={{ color: active === s.key ? '#fff' : colors.textSecondary, fontWeight: '600', marginLeft: 6 }}>
              {s.label}
            </Typography>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {active === 'dashboard' && <InventoryDashboardTab />}
      {active === 'warehouses' && <WarehousesTab />}
      {active === 'suppliers' && <SuppliersTab />}
      {active === 'pos' && <PurchaseOrdersTab />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  segmentScroll: { flexGrow: 0, flexShrink: 0 },
  segmentRow: { paddingHorizontal: 16, gap: 8, marginBottom: 8, alignItems: 'center' },
  segment: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: colors.surfaceHover },
  segmentActive: { backgroundColor: colors.primary },
});
