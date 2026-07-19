import React from 'react';
import { View, ScrollView, StyleSheet, RefreshControl, Alert, TouchableOpacity, Image } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { colors, Typography, Card, Button, Badge, Loader, adminService, getApiBaseUrl } from '@mechbazar/shared';
import { IndianRupee, Package, Users, Store, ShoppingBag, AlertTriangle, TrendingUp, ShoppingCart } from 'lucide-react-native';

const getUploadUrl = (path: string) => `${getApiBaseUrl().replace(/\/api\/?$/, '')}${path}`;

const getStatusBadgeVariant = (status: string): 'success' | 'danger' | 'warning' => {
  if (status === 'DELIVERED') return 'success';
  if (status === 'CANCELLED') return 'danger';
  return 'warning';
};

// Mirrors apps/admin/src/pages/Dashboard.tsx exactly: same 6 stat cards, same
// click-through destinations, same Recent Orders / Top Selling Products
// lists, same fake "Generate Report" success alert (the web's alert() call
// doesn't generate a real report either).
export const DashboardScreen = () => {
  const navigation = useNavigation<any>();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: adminService.getDashboardStats,
    refetchOnMount: 'always',
  });

  useFocusEffect(
    React.useCallback(() => {
      refetch();
    }, [refetch])
  );

  if (isLoading && !isRefetching) return <Loader fullScreen />;

  const stats = data?.stats || { users: 0, orders: 0, products: 0, revenue: 0, vendors: 0, lowStock: 0 };
  const recentOrders = data?.recentOrders || [];
  const topProducts = data?.topSellingProducts || [];

  const statCards = [
    { title: "Today's Sales", value: `₹${stats.revenue.toLocaleString()}`, icon: IndianRupee, color: colors.success, onPress: undefined },
    { title: 'Pending Orders', value: stats.orders, icon: Package, color: colors.primary, onPress: () => navigation.navigate('Tabs', { screen: 'Orders', params: { status: 'PENDING' } }) },
    { title: 'Total Customers', value: stats.users, icon: Users, color: colors.info, onPress: () => navigation.navigate('Customers') },
    { title: 'Total Vendors', value: stats.vendors, icon: Store, color: colors.navy, onPress: () => navigation.navigate('Vendors') },
    { title: 'Inventory Count', value: stats.products, icon: ShoppingBag, color: colors.info, onPress: () => navigation.navigate('Tabs', { screen: 'Products' }) },
    { title: 'Low Stock Items', value: stats.lowStock, icon: AlertTriangle, color: colors.danger, onPress: () => navigation.navigate('Inventory') },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
    >
      <View style={styles.header}>
        <View>
          <Typography variant="h2">Dashboard Overview</Typography>
          <Typography variant="caption" style={{ marginTop: 4 }}>Welcome back, Super Admin</Typography>
        </View>
        <Button
          title="Generate Report"
          size="sm"
          onPress={() => Alert.alert('Report Generated', 'Report generated successfully and sent to your registered email.')}
        />
      </View>

      <View style={styles.grid}>
        {statCards.map((stat, idx) => (
          <TouchableOpacity
            key={idx}
            style={styles.statCardWrapper}
            activeOpacity={stat.onPress ? 0.7 : 1}
            onPress={stat.onPress}
            disabled={!stat.onPress}
          >
            <Card style={styles.statCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Typography variant="caption">{stat.title}</Typography>
                  <Typography variant="h2" style={{ marginTop: 4 }}>{stat.value}</Typography>
                </View>
                <View style={[styles.iconWrap, { backgroundColor: `${stat.color}20` }]}>
                  <stat.icon color={stat.color} size={22} />
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12 }}>
                <TrendingUp color={colors.success} size={12} />
                <Typography variant="caption" style={{ color: colors.success, fontWeight: '600' }}>+12.5%</Typography>
                <Typography variant="caption">from last month</Typography>
              </View>
            </Card>
          </TouchableOpacity>
        ))}
      </View>

      <Typography variant="h3" style={{ marginTop: 8, marginBottom: 12 }}>Recent Orders</Typography>
      <Card>
        {recentOrders.length === 0 ? (
          <Typography variant="body" style={{ color: colors.textSecondary }}>No recent orders found.</Typography>
        ) : (
          recentOrders.map((order: any, idx: number) => (
            <View key={order.id} style={[styles.listRow, idx === recentOrders.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={styles.listIcon}>
                <Package color={colors.primary} size={18} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Typography variant="body" style={{ fontWeight: '700' }}>Order #{order.id.slice(-6).toUpperCase()}</Typography>
                <Typography variant="caption">{order.items?.length || 0} items • ₹{order.finalAmount?.toLocaleString()}</Typography>
              </View>
              <Badge label={order.status} variant={getStatusBadgeVariant(order.status)} size="sm" />
            </View>
          ))
        )}
      </Card>

      <Typography variant="h3" style={{ marginTop: 24, marginBottom: 12 }}>Top Selling Products</Typography>
      <Card>
        {topProducts.length === 0 ? (
          <Typography variant="body" style={{ color: colors.textSecondary }}>No sales data available yet.</Typography>
        ) : (
          topProducts.map((product: any, idx: number) => (
            <View key={product.id} style={[styles.listRow, idx === topProducts.length - 1 && { borderBottomWidth: 0 }]}>
              {product.images?.[0] ? (
                <Image source={{ uri: getUploadUrl(product.images[0]) }} style={styles.productImg} />
              ) : (
                <View style={[styles.productImg, styles.productImgFallback]}>
                  <ShoppingBag color={colors.textSecondary} size={20} />
                </View>
              )}
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Typography variant="body" style={{ fontWeight: '700' }} numberOfLines={1}>{product.name}</Typography>
                <Typography variant="caption" numberOfLines={1}>
                  {product.vendor?.storeName || 'MechBazar'} • {product._count?.orderItems || 0} Sales
                </Typography>
              </View>
              <Typography variant="body" style={{ color: colors.primary, fontWeight: '700' }}>
                ₹{product.price?.toLocaleString()}
              </Typography>
            </View>
          ))
        )}
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  statCardWrapper: { width: '48%' },
  statCard: { padding: 16 },
  iconWrap: { padding: 10, borderRadius: 999 },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  listIcon: { width: 36, height: 36, borderRadius: 8, backgroundColor: `${colors.primary}15`, justifyContent: 'center', alignItems: 'center' },
  productImg: { width: 40, height: 40, borderRadius: 8 },
  productImgFallback: { backgroundColor: colors.surfaceHover, justifyContent: 'center', alignItems: 'center' },
});
