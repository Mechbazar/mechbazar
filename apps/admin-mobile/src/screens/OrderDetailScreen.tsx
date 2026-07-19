import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Alert, Image, TouchableOpacity, Share } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { colors, Typography, Card, Button, Badge, Loader, adminService, getApiBaseUrl } from '@mechbazar/shared';
import { UserPlus, X } from 'lucide-react-native';

const getUploadUrl = (path: string) => `${getApiBaseUrl().replace(/\/api\/?$/, '')}${path}`;

const getStatusMeta = (status: string): { label: string; variant: 'primary' | 'secondary' | 'warning' | 'success' | 'danger' } => {
  switch (status) {
    case 'PLACED':
      return { label: 'New Order', variant: 'secondary' };
    case 'ACCEPTED':
      return { label: 'Accepted', variant: 'warning' };
    case 'PACKING':
      return { label: 'Packing', variant: 'warning' };
    case 'PICKUP':
      return { label: 'Awaiting Pickup', variant: 'primary' };
    case 'ON_THE_WAY':
      return { label: 'Out for Delivery', variant: 'primary' };
    case 'DELIVERED':
      return { label: 'Delivered', variant: 'success' };
    case 'CANCELLED':
      return { label: 'Cancelled', variant: 'danger' };
    case 'RETURNED':
      return { label: 'Returned', variant: 'danger' };
    default:
      return { label: status, variant: 'secondary' };
  }
};

// Mirrors apps/admin/src/pages/Orders.tsx's row-action-menu + order-details
// modal combined into a single pushed screen (matching apps/rider's
// DeliveryDetailScreen pattern for consolidating actions on mobile).
export const OrderDetailScreen = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const { orderId } = route.params;
  const [showAssign, setShowAssign] = useState(false);

  const { data: orders, isLoading } = useQuery({
    queryKey: ['admin-orders'],
    queryFn: adminService.getAllOrders,
  });

  const { data: riders } = useQuery({
    queryKey: ['admin-riders'],
    queryFn: adminService.getRiders,
    enabled: showAssign,
  });

  const order = orders?.find((o: any) => o.id === orderId);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-orders'] });

  const statusMutation = useMutation({
    mutationFn: (status: string) => adminService.updateOrderStatus(orderId, status),
    onSuccess: invalidate,
    onError: (err: any) => Alert.alert('Error', err.response?.data?.error || 'Failed to update status'),
  });

  const assignMutation = useMutation({
    mutationFn: (riderId: string) => adminService.assignRider(orderId, riderId),
    onSuccess: () => {
      invalidate();
      setShowAssign(false);
    },
    onError: () => Alert.alert('Error', 'Failed to assign driver'),
  });

  if (isLoading || !order) return <Loader fullScreen />;

  const meta = getStatusMeta(order.status);
  const onlineDrivers = (riders || []).filter((r: any) => r.deliveryProfile?.isOnline);

  const handleCancel = () => {
    Alert.alert('Cancel Order', 'Are you sure you want to cancel this order?', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes, Cancel', style: 'destructive', onPress: () => statusMutation.mutate('CANCELLED') },
    ]);
  };

  const handlePrint = () => {
    Share.share({
      message: `Order #${order.id.slice(-6).toUpperCase()} — ${order.items?.length || 0} items — ₹${order.finalAmount}`,
      title: `Order #${order.id.slice(-6).toUpperCase()}`,
    });
  };

  const isTerminal = ['DELIVERED', 'CANCELLED', 'RETURNED'].includes(order.status);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Typography variant="h3">Order #{order.id.slice(-6).toUpperCase()}</Typography>
          <Badge label={meta.label} variant={meta.variant} size="sm" />
        </View>
        <Typography variant="caption" style={{ marginTop: 4 }}>{new Date(order.createdAt).toLocaleString()}</Typography>
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Typography variant="h3">Customer Details</Typography>
        <Typography variant="body" style={{ marginTop: 8, fontWeight: '700' }}>{order.user?.name}</Typography>
        <Typography variant="caption">{order.user?.email}</Typography>
        {order.address && (
          <Typography variant="caption" style={{ marginTop: 4 }}>
            {order.address.line1}{order.address.line2 ? `, ${order.address.line2}` : ''}, {order.address.city}, {order.address.state} {order.address.pincode}{'\n'}
            Phone: {order.user?.phone}
          </Typography>
        )}
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Typography variant="h3">Order Items</Typography>
        {order.items?.map((item: any) => (
          <View key={item.id} style={styles.itemRow}>
            <View style={{ flex: 1 }}>
              <Typography variant="body">{item.product?.name}</Typography>
              <Typography variant="caption">Qty: {item.quantity} × ₹{item.price}</Typography>
            </View>
            <Typography variant="body" style={{ fontWeight: '700' }}>₹{item.quantity * item.price}</Typography>
          </View>
        ))}
        <View style={[styles.itemRow, { borderBottomWidth: 0, marginTop: 8 }]}>
          <Typography variant="body" style={{ fontWeight: '700' }}>Total Amount</Typography>
          <Typography variant="h3">₹{order.finalAmount?.toLocaleString()}</Typography>
        </View>
      </Card>

      {order.payment?.method === 'COD' && (
        <Card style={{ marginTop: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Typography variant="body">COD Collection</Typography>
            <Typography variant="body" style={{ color: order.codCollected ? colors.success : colors.danger, fontWeight: '700' }}>
              {order.codCollected ? 'Collected' : 'Not yet collected'}
            </Typography>
          </View>
        </Card>
      )}

      {order.proofImageUrl && (
        <Card style={{ marginTop: 12 }}>
          <Typography variant="h3">Delivery Proof</Typography>
          <Image source={{ uri: getUploadUrl(order.proofImageUrl) }} style={styles.proofImage} />
        </Card>
      )}

      {order.issueReason && (
        <Card style={{ marginTop: 12, backgroundColor: '#FDECEA' }}>
          <Typography variant="body" style={{ color: colors.dangerStrong, fontWeight: '700' }}>Reported Issue</Typography>
          <Typography variant="caption" style={{ color: colors.dangerStrong, marginTop: 4 }}>{order.issueReason}</Typography>
        </Card>
      )}

      {!order.deliveryPartner && !isTerminal && (
        <Card style={{ marginTop: 12 }}>
          <TouchableOpacity onPress={() => setShowAssign(!showAssign)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <UserPlus color={colors.navy} size={18} />
            <Typography variant="body" style={{ color: colors.navy, fontWeight: '700' }}>Assign Driver</Typography>
          </TouchableOpacity>
          {showAssign && (
            <View style={{ marginTop: 12 }}>
              {onlineDrivers.length === 0 && <Typography variant="caption">No active drivers</Typography>}
              {onlineDrivers.map((driver: any) => (
                <TouchableOpacity
                  key={driver.id}
                  style={styles.driverRow}
                  onPress={() => assignMutation.mutate(driver.deliveryProfile.id)}
                >
                  <Typography variant="body">{driver.user?.name} - {driver.deliveryProfile?.vehicleType || 'Bike'}</Typography>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Card>
      )}

      <View style={{ marginTop: 16, gap: 8 }}>
        <Button title="Print Invoice" variant="outline" onPress={handlePrint} />
        {order.status === 'PLACED' && (
          <Button title="Accept Order" onPress={() => statusMutation.mutate('ACCEPTED')} loading={statusMutation.isPending} />
        )}
        {order.status === 'ACCEPTED' && (
          <Button title="Mark as Packing" onPress={() => statusMutation.mutate('PACKING')} loading={statusMutation.isPending} />
        )}
        {!isTerminal && (
          <Button title="Cancel Order" variant="danger" onPress={handleCancel} />
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  proofImage: { width: '100%', height: 180, borderRadius: 8, marginTop: 8 },
  driverRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
});
