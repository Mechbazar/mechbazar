import React from 'react';
import { View, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { colors, Typography, Card, Loader, vendorService } from '@mechbazar/shared';
import { Package, IndianRupee, ShoppingCart, Wallet } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { RootState } from '../store';

export const DashboardScreen = () => {
  const user = useSelector((state: RootState) => state.auth.user);
  
  const { data: stats, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['vendor-dashboard'],
    queryFn: vendorService.getDashboardStats,
  });

  const onRefresh = () => {
    refetch();
  };

  if (isLoading && !isRefetching) {
    return <Loader size="large" color={colors.primary} style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <Typography variant="h2" style={styles.title}>Welcome back, {user?.name || 'Seller'}!</Typography>
      
      <View style={styles.grid}>
        <Card style={styles.statCard}>
          <IndianRupee color={colors.primary} size={24} />
          <Typography variant="h3" style={{ marginTop: 8 }}>₹ {stats?.totalRevenue?.toFixed(2) || '0.00'}</Typography>
          <Typography variant="caption">Total Revenue</Typography>
        </Card>
        <Card style={styles.statCard}>
          <ShoppingCart color={colors.info} size={24} />
          <Typography variant="h3" style={{ marginTop: 8 }}>{stats?.totalOrders || 0}</Typography>
          <Typography variant="caption">Total Orders</Typography>
        </Card>
        <Card style={styles.statCard}>
          <Package color={colors.success} size={24} />
          <Typography variant="h3" style={{ marginTop: 8 }}>{stats?.totalProducts || 0} ({stats?.lowStockProducts || 0} low)</Typography>
          <Typography variant="caption">Live Products</Typography>
        </Card>
        <Card style={styles.statCard}>
          <Wallet color={colors.warning} size={24} />
          <Typography variant="h3" style={{ marginTop: 8 }}>₹ {stats?.walletBalance?.toFixed(2) || '0.00'}</Typography>
          <Typography variant="caption">Wallet Balance</Typography>
        </Card>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 16,
  },
  title: {
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    marginBottom: 16,
    alignItems: 'center',
    paddingVertical: 24,
  }
});
