import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert, Vibration } from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  colors, Typography, Card, Button, Loader, jobService, OfferSummary,
  getSocket, SERVER_EVENTS, OfferEvent, OfferClosedEvent,
} from '@mechbazar/shared';
import { AlertTriangle, MapPin, Clock } from 'lucide-react-native';

// Live inbox of emergency job offers for this mechanic. Distinct from
// BookingsScreen (which lists jobs already assigned) -- these are jobs an
// admin has just assigned to this mechanic specifically and are awaiting an
// explicit Accept/Reject within the countdown window. There is no automatic
// matching or multi-mechanic race any more (see dispatch.service.ts's
// createSingleOffer/acceptOffer) -- an offer here was offered to this
// mechanic alone -- but this screen still always reads the server's answer
// rather than assuming an accept succeeded, since a duplicated request or an
// admin reassigning mid-flight are still real possibilities.

function OfferCountdown({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000)));
  useEffect(() => {
    const t = setInterval(() => {
      setRemaining(Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Clock color={remaining <= 10 ? colors.danger : colors.textSecondary} size={14} />
      <Typography variant="caption" style={{ color: remaining <= 10 ? colors.danger : colors.textSecondary, fontWeight: '700' }}>
        {remaining}s left
      </Typography>
    </View>
  );
}

export const OfferInboxScreen = () => {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const isFocused = useIsFocused();
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const knownOfferIds = useRef<Set<string>>(new Set());

  const { data: offers, isLoading, refetch, isRefetching } = useQuery<OfferSummary[]>({
    queryKey: ['mechanic-offers'],
    queryFn: jobService.getMyOffers,
    // Socket delivers new offers instantly; this poll is the safety net for
    // a dropped connection, same role as the tracking screen's fallback poll.
    refetchInterval: isFocused ? 5000 : false,
  });

  useEffect(() => {
    if (isFocused) refetch();
  }, [isFocused, refetch]);

  // New offers vibrate once -- an emergency job offer is time-boxed (default
  // 30s) and a mechanic whose phone is in a pocket needs a physical cue, not
  // just a silently updated list.
  useEffect(() => {
    const ids = new Set((offers || []).map((o) => o.offerId));
    const isFirstLoad = knownOfferIds.current.size === 0;
    if (!isFirstLoad) {
      const hasNew = [...ids].some((id) => !knownOfferIds.current.has(id));
      if (hasNew) Vibration.vibrate([0, 300, 100, 300]);
    }
    knownOfferIds.current = ids;
  }, [offers]);

  useEffect(() => {
    let socket: Awaited<ReturnType<typeof getSocket>> | null = null;
    let mounted = true;
    (async () => {
      socket = await getSocket();
      if (!mounted) return;
      const onNew = (_payload: OfferEvent) => queryClient.invalidateQueries({ queryKey: ['mechanic-offers'] });
      const onClosed = (_payload: OfferClosedEvent) => queryClient.invalidateQueries({ queryKey: ['mechanic-offers'] });
      socket.on(SERVER_EVENTS.OFFER_NEW, onNew);
      socket.on(SERVER_EVENTS.OFFER_CLOSED, onClosed);
      return () => {
        socket?.off(SERVER_EVENTS.OFFER_NEW, onNew);
        socket?.off(SERVER_EVENTS.OFFER_CLOSED, onClosed);
      };
    })();
    return () => { mounted = false; };
  }, [queryClient]);

  const handleAccept = async (offer: OfferSummary) => {
    setRespondingId(offer.offerId);
    const res = await jobService.acceptJob(offer.bookingId);
    setRespondingId(null);
    if (res.job) {
      queryClient.invalidateQueries({ queryKey: ['mechanic-offers'] });
      queryClient.invalidateQueries({ queryKey: ['technician-bookings'] });
      navigation.navigate('EmergencyJob', { bookingId: offer.bookingId });
    } else {
      // ALREADY_TAKEN/OFFER_CLOSED shouldn't normally happen with a single-
      // candidate offer, but stay defensive: an admin can reassign the job to
      // someone else, or the countdown can expire, between this screen
      // loading and the mechanic tapping Accept.
      Alert.alert(
        'Could not accept',
        res.error || 'This offer is no longer available -- it may have expired or been reassigned.'
      );
      refetch();
    }
  };

  const handleDecline = async (offer: OfferSummary) => {
    setRespondingId(offer.offerId);
    await jobService.declineJob(offer.bookingId);
    setRespondingId(null);
    refetch();
  };

  if (isLoading) return <Loader fullScreen />;

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={{ padding: 16, flexGrow: 1 }}
      data={offers || []}
      keyExtractor={(o) => o.offerId}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
      ListEmptyComponent={
        <View style={styles.empty}>
          <AlertTriangle color={colors.textSecondary} size={40} />
          <Typography variant="h3" style={{ marginTop: 12, textAlign: 'center' }}>No job offers right now</Typography>
          <Typography variant="caption" style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 4 }}>
            Stay online to receive nearby emergency job requests.
          </Typography>
        </View>
      }
      renderItem={({ item }) => (
        <Card style={styles.offerCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Typography variant="h3">🚨 {item.category}</Typography>
              <Typography variant="caption" style={{ color: colors.textSecondary }}>{item.packageName}</Typography>
            </View>
            <OfferCountdown expiresAt={item.expiresAt} />
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 }}>
            <MapPin color={colors.textSecondary} size={14} />
            <Typography variant="body">
              {item.distanceKm != null ? `${item.distanceKm.toFixed(1)} km away` : 'Distance unknown'} · {item.area}
            </Typography>
          </View>

          <Typography variant="body" style={{ marginTop: 6 }}>
            {item.vehicle.brand} {item.vehicle.model} ({item.vehicle.type})
          </Typography>
          {item.issueDescription ? (
            <Typography variant="caption" style={{ color: colors.textSecondary, marginTop: 4 }}>{item.issueDescription}</Typography>
          ) : null}

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
            <Typography variant="h3" style={{ color: colors.primary }}>₹{item.estimatedCost}</Typography>
          </View>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
            <Button
              title="Decline"
              variant="outline"
              onPress={() => handleDecline(item)}
              loading={respondingId === item.offerId}
              style={{ flex: 1 }}
            />
            <Button
              title="Accept"
              onPress={() => handleAccept(item)}
              loading={respondingId === item.offerId}
              style={{ flex: 1.4 }}
            />
          </View>
        </Card>
      )}
    />
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  offerCard: { marginBottom: 12, borderWidth: 1.5, borderColor: colors.primary },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
});
