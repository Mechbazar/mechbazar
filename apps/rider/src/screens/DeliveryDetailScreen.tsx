import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Linking, Alert, Image, TouchableOpacity, Switch } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { colors, Typography, Card, Button, Loader, riderService } from '@mechbazar/shared';
import { Phone, Navigation as NavigationIcon, Camera } from 'lucide-react-native';
import { Delivery } from '../utils/deliveries';
import { formatINR } from '../utils/currency';

// Backend RIDER_STATUS_FLOW: PICKUP -> ON_THE_WAY -> DELIVERED (or -> RETURNED
// as a "report issue" branch from either in-flight state). There is no
// separate "out for delivery" status distinct from ON_THE_WAY in the schema —
// see the final gaps report for why these map to 2 button presses, not 3.
export const DeliveryDetailScreen = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const { orderId } = route.params;

  const [proofUri, setProofUri] = useState<string | null>(null);
  const [codCollected, setCodCollected] = useState(false);
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [issueReason, setIssueReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: deliveries, isLoading } = useQuery<Delivery[]>({
    queryKey: ['rider-deliveries'],
    queryFn: riderService.getMyDeliveries,
  });

  const order = deliveries?.find((d) => d.id === orderId);

  const statusMutation = useMutation({
    mutationFn: (payload: { status: string; proofImageUrl?: string; codCollected?: boolean; issueReason?: string }) =>
      riderService.updateDeliveryStatus(orderId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rider-deliveries'] });
      navigation.goBack();
    },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.error || err.message),
  });

  if (isLoading || !order) return <Loader fullScreen />;

  const callNumber = (phone: string) => Linking.openURL(`tel:${phone}`);

  const openNavigation = () => {
    const { lat, lng } = order.address as any;
    const url = lat && lng
      ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
      : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
          `${order.address.line1}, ${order.address.city}, ${order.address.state} ${order.address.pincode}`
        )}`;
    Linking.openURL(url);
  };

  const handleMarkPickedUp = () => {
    statusMutation.mutate({ status: 'ON_THE_WAY' });
  };

  const handleTakeProofPhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera permission required', 'Enable camera access to take a delivery photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.6 });
    if (!result.canceled) setProofUri(result.assets[0].uri);
  };

  const handleConfirmDelivered = async () => {
    if (!proofUri) {
      Alert.alert('Photo required', 'Take a photo as proof of delivery.');
      return;
    }
    if (order.payment?.method === 'COD' && !codCollected) {
      Alert.alert('Confirm collection', 'Please confirm you have collected the COD amount.');
      return;
    }
    try {
      setSubmitting(true);
      const upload = await riderService.uploadImage(proofUri, 'image/jpeg', `proof-${orderId}.jpg`);
      await statusMutation.mutateAsync({
        status: 'DELIVERED',
        proofImageUrl: upload.url,
        codCollected: order.payment?.method === 'COD' ? codCollected : undefined,
      });
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitIssue = () => {
    if (!issueReason.trim()) {
      Alert.alert('Reason required', "Please describe why this delivery can't be completed.");
      return;
    }
    statusMutation.mutate({ status: 'RETURNED', issueReason: issueReason.trim() });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Card>
        <Typography variant="h3">Order #{order.id.slice(-6).toUpperCase()}</Typography>
        <Typography variant="caption" style={{ color: colors.primary, fontWeight: '700', marginTop: 4 }}>{order.status}</Typography>
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Typography variant="h3">Drop-off</Typography>
        <Typography variant="body" style={{ marginTop: 4 }}>
          {order.address.line1}{order.address.line2 ? `, ${order.address.line2}` : ''}
        </Typography>
        <Typography variant="body">{order.address.city}, {order.address.state} {order.address.pincode}</Typography>
        <Typography variant="caption" style={{ color: colors.textSecondary, marginTop: 4 }}>
          Contact: {order.user?.name || 'Customer'} — {order.user?.phone}
        </Typography>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <Button
            title="Call"
            variant="outline"
            onPress={() => callNumber(order.user.phone)}
            style={{ flex: 1, flexDirection: 'row', gap: 6 }}
          >
            <Phone color={colors.primary} size={16} />
            <Typography variant="body" style={{ color: colors.primary, marginLeft: 6, fontWeight: '600' }}>Call</Typography>
          </Button>
          <Button title="Navigate" onPress={openNavigation} style={{ flex: 1 }}>
            <NavigationIcon color="#ffffff" size={16} />
            <Typography variant="body" style={{ color: '#ffffff', marginLeft: 6, fontWeight: '600' }}>Navigate</Typography>
          </Button>
        </View>
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Typography variant="h3">Items ({order.items.length})</Typography>
        {order.items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <Typography variant="body">{item.product.name}</Typography>
            <Typography variant="body" style={{ color: colors.textSecondary }}>x{item.quantity}</Typography>
          </View>
        ))}
      </Card>

      <Card style={{ marginTop: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Typography variant="h3">Payment</Typography>
          <Typography variant="body">{order.payment?.method || 'N/A'}</Typography>
        </View>
        {order.payment?.method === 'COD' && (
          <View style={styles.codBox}>
            <Typography variant="caption" style={{ color: '#ffffff' }}>COLLECT ON DELIVERY</Typography>
            <Typography variant="h2" style={{ color: '#ffffff', marginTop: 4 }}>{formatINR(order.payment.amount)}</Typography>
          </View>
        )}
      </Card>

      {order.status === 'PICKUP' && (
        <Button title="Mark Picked Up" onPress={handleMarkPickedUp} loading={statusMutation.isPending} style={{ marginTop: 16 }} />
      )}

      {order.status === 'ON_THE_WAY' && !showIssueForm && (
        <Card style={{ marginTop: 16 }}>
          <Typography variant="h3">Mark as Delivered</Typography>
          {proofUri ? (
            <Image source={{ uri: proofUri }} style={styles.proofImage} />
          ) : (
            <TouchableOpacity onPress={handleTakeProofPhoto} style={styles.photoButton}>
              <Camera color={colors.textSecondary} size={28} />
              <Typography variant="caption" style={{ color: colors.textSecondary, marginTop: 4 }}>Take delivery photo</Typography>
            </TouchableOpacity>
          )}
          {proofUri && (
            <Button title="Retake Photo" variant="outline" onPress={handleTakeProofPhoto} style={{ marginTop: 8 }} />
          )}

          {order.payment?.method === 'COD' && (
            <View style={styles.codConfirmRow}>
              <Typography variant="body">I have collected {formatINR(order.payment.amount)}</Typography>
              <Switch value={codCollected} onValueChange={setCodCollected} trackColor={{ false: colors.border, true: colors.success }} />
            </View>
          )}

          <Button
            title="Confirm Delivered"
            onPress={handleConfirmDelivered}
            loading={submitting || statusMutation.isPending}
            style={{ marginTop: 16 }}
          />
          <Button
            title="Report Issue / Can't Deliver"
            variant="outline"
            onPress={() => setShowIssueForm(true)}
            style={{ marginTop: 8, borderColor: colors.danger }}
            textStyle={{ color: colors.danger }}
          />
        </Card>
      )}

      {showIssueForm && (
        <Card style={{ marginTop: 16 }}>
          <Typography variant="h3" style={{ color: colors.danger }}>Report Issue</Typography>
          <Typography variant="caption" style={{ color: colors.textSecondary, marginTop: 4 }}>
            This will mark the delivery as returned. A reason is required.
          </Typography>
          <View style={styles.reasonBox}>
            {['Customer unavailable', 'Address not found', 'Customer refused', 'Other'].map((reason) => (
              <TouchableOpacity
                key={reason}
                style={[styles.reasonChip, issueReason === reason && styles.reasonChipActive]}
                onPress={() => setIssueReason(reason)}
              >
                <Typography variant="caption" style={{ color: issueReason === reason ? '#ffffff' : colors.text }}>{reason}</Typography>
              </TouchableOpacity>
            ))}
          </View>
          <Button
            title="Submit"
            onPress={handleSubmitIssue}
            loading={statusMutation.isPending}
            style={{ marginTop: 16, backgroundColor: colors.danger }}
          />
          <Button title="Cancel" variant="outline" onPress={() => setShowIssueForm(false)} style={{ marginTop: 8 }} />
        </Card>
      )}

      {(order.status === 'DELIVERED' || order.status === 'RETURNED') && (
        <Card style={{ marginTop: 16 }}>
          <Typography variant="h3">{order.status === 'DELIVERED' ? 'Delivered' : 'Returned'}</Typography>
          {order.proofImageUrl && <Image source={{ uri: order.proofImageUrl }} style={styles.proofImage} />}
          {order.issueReason && <Typography variant="body" style={{ marginTop: 8 }}>Reason: {order.issueReason}</Typography>}
        </Card>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  codBox: { backgroundColor: colors.danger, borderRadius: 8, padding: 12, marginTop: 12, alignItems: 'center' },
  photoButton: { alignItems: 'center', justifyContent: 'center', height: 140, borderRadius: 8, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', marginTop: 12 },
  proofImage: { width: '100%', height: 180, borderRadius: 8, marginTop: 12 },
  codConfirmRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  reasonBox: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  reasonChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: colors.surfaceHover },
  reasonChipActive: { backgroundColor: colors.danger },
});
