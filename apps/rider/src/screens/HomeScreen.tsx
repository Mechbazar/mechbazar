import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Switch, Alert } from 'react-native';
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { colors, Typography, Card, Button, Loader, riderService } from '@mechbazar/shared';
import { Package, Truck } from 'lucide-react-native';
import { Delivery, isPendingPickup, isInProgress, isDeliveredToday } from '../utils/deliveries';
import { pingLocationOnce } from '../services/location';

export const HomeScreen = () => {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const isFocused = useIsFocused();

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['rider-profile'],
    queryFn: riderService.getProfile,
  });

  const {
    data: deliveries,
    isLoading: deliveriesLoading,
    refetch,
    isRefetching,
  } = useQuery<Delivery[]>({
    queryKey: ['rider-deliveries'],
    queryFn: riderService.getMyDeliveries,
    refetchInterval: isFocused ? 30000 : false,
  });

  useFocusEffect(
    React.useCallback(() => {
      refetch();
    }, [refetch])
  );

  const availabilityMutation = useMutation({
    mutationFn: (isOnline: boolean) => riderService.updateAvailability(isOnline),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rider-profile'] }),
    onError: (err: any) => Alert.alert('Error', err.response?.data?.error || err.message),
  });

  // Location ping only runs while the app is open and foregrounded (no
  // background-task support exists here — see the final gaps report).
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (profile?.isOnline) {
      pingLocationOnce();
      intervalRef.current = setInterval(pingLocationOnce, 60000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [profile?.isOnline]);

  if (profileLoading || (deliveriesLoading && !isRefetching)) {
    return <Loader fullScreen />;
  }

  const list = deliveries || [];
  const pendingPickup = list.filter(isPendingPickup);
  const inProgress = list.filter(isInProgress);
  const completedToday = list.filter(isDeliveredToday);
  // "On Delivery" is system-driven (ON_THE_WAY), never a rider-chosen toggle —
  // the only rider-controlled state here is Available/Offline (isOnline).
  const activeDelivery = inProgress[0] || pendingPickup[0];

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
    >
      <View style={styles.header}>
        <Typography variant="h2">Hello, {profile?.user?.name || 'Rider'}</Typography>
        <Typography variant="caption" style={{ color: colors.textSecondary }}>{profile?.vehicleType}</Typography>
      </View>

      <View style={{ padding: 16 }}>
        <Card style={styles.availabilityCard}>
          <View style={{ flex: 1 }}>
            <Typography variant="h3">{profile?.isOnline ? 'Available' : 'Offline'}</Typography>
            <Typography variant="caption" style={{ color: colors.textSecondary }}>
              {profile?.isOnline ? "You'll receive new delivery assignments" : 'Go online to receive deliveries'}
            </Typography>
          </View>
          <Switch
            value={!!profile?.isOnline}
            onValueChange={(val) => availabilityMutation.mutate(val)}
            disabled={availabilityMutation.isPending}
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </Card>

        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <Package color={colors.navy} size={22} />
            <Typography variant="h2" style={{ marginTop: 8 }}>{completedToday.length}</Typography>
            <Typography variant="caption" style={{ color: colors.textSecondary }}>Delivered today</Typography>
          </Card>
          <Card style={styles.statCard}>
            <Truck color={colors.primary} size={22} />
            <Typography variant="h2" style={{ marginTop: 8 }}>{inProgress.length + pendingPickup.length}</Typography>
            <Typography variant="caption" style={{ color: colors.textSecondary }}>Active deliveries</Typography>
          </Card>
        </View>

        {activeDelivery && (
          <Card style={{ marginTop: 8 }}>
            <Typography variant="h3">Continue delivery</Typography>
            <Typography variant="body" style={{ marginTop: 4 }}>
              Order #{activeDelivery.id.slice(-6).toUpperCase()} — {activeDelivery.address.city}
            </Typography>
            <Button
              title="Open"
              onPress={() => navigation.navigate('DeliveryDetail', { orderId: activeDelivery.id })}
              style={{ marginTop: 12 }}
            />
          </Card>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: 16, backgroundColor: colors.surfaceHover },
  availabilityCard: { flexDirection: 'row', alignItems: 'center' },
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  statCard: { flex: 1, alignItems: 'center' },
});
