import React, { useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { colors, Typography, Card, Badge, Input, Loader, adminService } from '@mechbazar/shared';
import { Search, Clock, Package, Truck, CheckCircle } from 'lucide-react-native';

const ORDERS_POLL_INTERVAL_MS = 20000;

const TABS = ['All', 'Pending', 'Processing', 'Delivering', 'Delivered'] as const;
type Tab = (typeof TABS)[number];

// Maps the ?status= param used by Dashboard's stat-card links to this
// screen's tabs — mirrors STATUS_PARAM_TO_TAB in apps/admin/src/pages/Orders.tsx.
const STATUS_PARAM_TO_TAB: Record<string, Tab> = {
  PLACED: 'Pending',
  PENDING: 'Pending',
  ACCEPTED: 'Processing',
  PACKING: 'Processing',
  PICKUP: 'Delivering',
  ON_THE_WAY: 'Delivering',
  DELIVERED: 'Delivered',
};

const STATUS_TAB_MAP: Record<string, string[]> = {
  Pending: ['PLACED'],
  Processing: ['ACCEPTED', 'PACKING'],
  Delivering: ['PICKUP', 'ON_THE_WAY'],
  Delivered: ['DELIVERED'],
};

const getStatusMeta = (status: string): { label: string; variant: 'primary' | 'secondary' | 'warning' | 'success' | 'danger'; Icon: any } => {
  switch (status) {
    case 'PLACED':
      return { label: 'New Order', variant: 'secondary', Icon: Clock };
    case 'ACCEPTED':
      return { label: 'Accepted', variant: 'warning', Icon: Package };
    case 'PACKING':
      return { label: 'Packing', variant: 'warning', Icon: Package };
    case 'PICKUP':
      return { label: 'Awaiting Pickup', variant: 'primary', Icon: Truck };
    case 'ON_THE_WAY':
      return { label: 'Out for Delivery', variant: 'primary', Icon: Truck };
    case 'DELIVERED':
      return { label: 'Delivered', variant: 'success', Icon: CheckCircle };
    case 'CANCELLED':
      return { label: 'Cancelled', variant: 'danger', Icon: Clock };
    case 'RETURNED':
      return { label: 'Returned', variant: 'danger', Icon: Clock };
    default:
      return { label: status, variant: 'secondary', Icon: Clock };
  }
};

export const OrdersListScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const initialStatusParam = route.params?.status;
  const [activeTab, setActiveTab] = useState<Tab>(STATUS_PARAM_TO_TAB[initialStatusParam || ''] || 'All');
  const [search, setSearch] = useState('');

  // Live refresh -- no push channel on this deployment, so poll instead of
  // waiting for a manual refresh/navigation to pick up new orders.
  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['admin-orders'],
    queryFn: adminService.getAllOrders,
    refetchOnMount: 'always',
    refetchInterval: ORDERS_POLL_INTERVAL_MS,
  });

  useFocusEffect(
    React.useCallback(() => {
      refetch();
      if (route.params?.status) {
        setActiveTab(STATUS_PARAM_TO_TAB[route.params.status] || 'All');
      }
    }, [refetch, route.params?.status])
  );

  const orders = Array.isArray(data) ? data : [];

  const filtered = useMemo(() => {
    return orders.filter((order: any) => {
      const allowed = STATUS_TAB_MAP[activeTab];
      if (allowed && !allowed.includes(order.status)) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchesId = order.id.toLowerCase().includes(q);
        const matchesUser = order.user?.name?.toLowerCase().includes(q);
        const matchesPhone = order.shippingAddress?.phone?.toLowerCase().includes(q) || order.user?.phone?.toLowerCase().includes(q);
        if (!matchesId && !matchesUser && !matchesPhone) return false;
      }
      return true;
    });
  }, [orders, activeTab, search]);

  const counts = {
    new: orders.filter((o: any) => o.status === 'PLACED').length,
    processing: orders.filter((o: any) => o.status === 'ACCEPTED' || o.status === 'PACKING').length,
    delivering: orders.filter((o: any) => o.status === 'PICKUP' || o.status === 'ON_THE_WAY').length,
    delivered: orders.filter((o: any) => o.status === 'DELIVERED').length,
  };

  if (isLoading && !isRefetching) return <Loader fullScreen />;

  return (
    <View style={styles.container}>
      <Typography variant="h2" style={{ padding: 16, paddingBottom: 8 }}>Orders Dashboard</Typography>

      <View style={styles.statRow}>
        <TouchableOpacity style={styles.statCard} onPress={() => setActiveTab('Pending')}>
          <Typography variant="caption">New</Typography>
          <Typography variant="h3">{counts.new}</Typography>
        </TouchableOpacity>
        <TouchableOpacity style={styles.statCard} onPress={() => setActiveTab('Processing')}>
          <Typography variant="caption">Processing</Typography>
          <Typography variant="h3">{counts.processing}</Typography>
        </TouchableOpacity>
        <TouchableOpacity style={styles.statCard} onPress={() => setActiveTab('Delivering')}>
          <Typography variant="caption">Delivering</Typography>
          <Typography variant="h3">{counts.delivering}</Typography>
        </TouchableOpacity>
        <TouchableOpacity style={styles.statCard} onPress={() => setActiveTab('Delivered')}>
          <Typography variant="caption">Delivered</Typography>
          <Typography variant="h3">{counts.delivered}</Typography>
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: 16 }}>
        <Input
          placeholder="Search ID, name, phone..."
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View style={styles.tabRow}>
        {TABS.map((tab) => (
          <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab)}>
            <Typography variant="caption" style={{ color: activeTab === tab ? '#ffffff' : colors.textSecondary, fontWeight: '600' }}>
              {tab}
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
            {isError ? `Could not load orders. ${((error as any)?.response?.data?.error || (error as any)?.message || 'Please try again.')}` : 'No orders found.'}
          </Typography>
        }
        renderItem={({ item }) => {
          const meta = getStatusMeta(item.status);
          const itemCount = item.items?.reduce((acc: number, cur: any) => acc + cur.quantity, 0) || 0;
          return (
            <TouchableOpacity onPress={() => navigation.navigate('OrderDetail', { orderId: item.id })}>
              <Card style={styles.orderCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Typography variant="h3">Order #{item.id.slice(-6).toUpperCase()}</Typography>
                  <Badge label={meta.label} variant={meta.variant} size="sm" />
                </View>
                <Typography variant="caption" style={{ marginTop: 4 }}>{new Date(item.createdAt).toLocaleString()}</Typography>
                <Typography variant="body" style={{ marginTop: 8 }}>{item.user?.name || 'Unknown'}</Typography>
                <Typography variant="caption">{itemCount} items • ₹{item.finalAmount}</Typography>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                  <Typography variant="caption" style={{ color: colors.textSecondary }}>
                    {item.deliveryPartner ? `Driver: ${item.deliveryPartner.user?.name}` : 'Unassigned'}
                  </Typography>
                </View>
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
  statRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: colors.card, borderRadius: 12, padding: 10, alignItems: 'center', elevation: 1 },
  tabRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 6, marginTop: 12, marginBottom: 4, flexWrap: 'wrap' },
  tab: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.surfaceHover },
  tabActive: { backgroundColor: colors.primary },
  orderCard: { marginBottom: 12 },
});
