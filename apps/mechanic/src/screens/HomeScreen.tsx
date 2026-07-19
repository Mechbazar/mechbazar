import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Switch, Alert } from 'react-native';
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { colors, Typography, Card, Button, Loader, technicianService } from '@mechbazar/shared';
import { CheckCircle2, Wrench } from 'lucide-react-native';
import { Booking, isNew, isActiveForTechnician, isCompletedToday } from '../utils/bookings';
import { pingLocationOnce } from '../services/location';

export const HomeScreen = () => {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const isFocused = useIsFocused();

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['technician-profile'],
    queryFn: technicianService.getProfile,
  });

  const {
    data: bookings,
    isLoading: bookingsLoading,
    refetch,
    isRefetching,
  } = useQuery<Booking[]>({
    queryKey: ['technician-bookings'],
    queryFn: technicianService.getMyBookings,
    refetchInterval: isFocused ? 30000 : false,
  });

  useFocusEffect(
    React.useCallback(() => {
      refetch();
    }, [refetch])
  );

  const availabilityMutation = useMutation({
    mutationFn: (isOnline: boolean) => technicianService.updateAvailability(isOnline),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['technician-profile'] }),
    onError: (err: any) => Alert.alert('Error', err.response?.data?.error || err.message),
  });

  // Location ping only runs while the app is open and foregrounded (no
  // background-task support exists here).
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (profile?.isOnline) {
      pingLocationOnce();
      intervalRef.current = setInterval(pingLocationOnce, 10000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [profile?.isOnline]);

  if (profileLoading || (bookingsLoading && !isRefetching)) {
    return <Loader fullScreen />;
  }

  const list = bookings || [];
  const newJobs = list.filter(isNew);
  const active = list.filter(isActiveForTechnician);
  const completedToday = list.filter(isCompletedToday);
  // "On the way"/"Arrived"/etc. are system-driven (booking status), never a
  // technician-chosen toggle -- the only technician-controlled state here is
  // Available/Offline (isOnline). A brand-new unaccepted job surfaces here
  // too (as "Review") since it needs an Accept/Reject decision before
  // anything else.
  const activeBooking = active[0] || newJobs[0];

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
    >
      <View style={styles.header}>
        <Typography variant="h2">Hello, {profile?.user?.name || 'Mechanic'}</Typography>
        <Typography variant="caption" style={{ color: colors.textSecondary }}>
          {(profile?.specializations || []).join(', ') || 'No specialization set'}
        </Typography>
      </View>

      <View style={{ padding: 16 }}>
        <Card style={styles.availabilityCard}>
          <View style={{ flex: 1 }}>
            <Typography variant="h3">{profile?.isOnline ? 'Available' : 'Offline'}</Typography>
            <Typography variant="caption" style={{ color: colors.textSecondary }}>
              {profile?.isOnline ? "You'll receive new booking assignments" : 'Go online to receive bookings'}
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
            <CheckCircle2 color={colors.navy} size={22} />
            <Typography variant="h2" style={{ marginTop: 8 }}>{completedToday.length}</Typography>
            <Typography variant="caption" style={{ color: colors.textSecondary }}>Completed today</Typography>
          </Card>
          <Card style={styles.statCard}>
            <Wrench color={colors.primary} size={22} />
            <Typography variant="h2" style={{ marginTop: 8 }}>{active.length + newJobs.length}</Typography>
            <Typography variant="caption" style={{ color: colors.textSecondary }}>Active bookings</Typography>
          </Card>
        </View>

        {activeBooking && (
          <Card style={{ marginTop: 8 }}>
            <Typography variant="h3">{newJobs[0] && !active[0] ? 'New job to review' : 'Continue booking'}</Typography>
            <Typography variant="body" style={{ marginTop: 4 }}>
              #{activeBooking.bookingNumber} — {activeBooking.address.city}
            </Typography>
            <Button
              title="Open"
              onPress={() => navigation.navigate('BookingDetail', { bookingId: activeBooking.id })}
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
