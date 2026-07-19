import React from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert } from 'react-native';
import { colors, Typography, Card, Button, vendorService, Loader } from '@mechbazar/shared';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export const OrdersScreen = () => {
  const queryClient = useQueryClient();

  const { data: orders, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['vendor-orders'],
    queryFn: vendorService.getOrders,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => vendorService.updateOrderStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-orders'] });
      Alert.alert('Success', 'Order status updated');
    },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.message || err.message)
  });

  const handleStatusChange = (orderId: string, currentStatus: string) => {
    let nextStatus = '';
    if (currentStatus === 'PENDING' || currentStatus === 'PLACED') nextStatus = 'ACCEPTED';
    else if (currentStatus === 'ACCEPTED') nextStatus = 'PACKING';
    else if (currentStatus === 'PACKING') nextStatus = 'SHIPPED';
    else if (currentStatus === 'SHIPPED') nextStatus = 'DELIVERED';
    
    if (!nextStatus) return;

    Alert.alert('Update Status', `Change order status to ${nextStatus}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Update', onPress: () => statusMutation.mutate({ id: orderId, status: nextStatus }) }
    ]);
  };

  if (isLoading && !isRefetching) return <Loader size="large" style={{flex:1, backgroundColor: colors.background}} />;

  return (
    <View style={styles.container}>
      <Typography variant="h2" style={{padding: 16}}>Orders</Typography>
      <FlatList
        data={orders}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<Typography variant="body" style={{textAlign:'center', marginTop:20}}>No orders yet.</Typography>}
        renderItem={({ item }) => (
          <Card style={styles.orderCard}>
            <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom: 8}}>
              <Typography variant="h3">Order #{item.id.slice(-6).toUpperCase()}</Typography>
              <Typography variant="caption" style={{color: colors.primary}}>{item.status}</Typography>
            </View>
            <Typography variant="body">Total Amount: ₹{item.totalAmount}</Typography>
            <Typography variant="caption" style={{color: colors.textSecondary}}>Date: {new Date(item.createdAt).toLocaleDateString()}</Typography>
            
            {['PLACED', 'PENDING', 'ACCEPTED', 'PACKING', 'SHIPPED'].includes(item.status) && (
              <Button 
                title="Update Status" 
                variant="outline" 
                onPress={() => handleStatusChange(item.id, item.status)} 
                style={{marginTop: 12}} 
              />
            )}
          </Card>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  orderCard: { marginBottom: 12 }
});
