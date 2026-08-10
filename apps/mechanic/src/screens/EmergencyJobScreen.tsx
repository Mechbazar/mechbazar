import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Linking, Alert, Image, TouchableOpacity } from 'react-native';
import { useRoute, useNavigation, useIsFocused } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import {
  colors, Typography, Card, Button, Input, Loader, jobService, Job,
  getSocket, subscribeToJob, SERVER_EVENTS, type JobStatusEvent,
} from '@mechbazar/shared';
import { Phone, Navigation as NavigationIcon, Camera, MessageCircle } from 'lucide-react-native';
import { formatINR } from '../utils/currency';
import { startTracking, stopTracking } from '../services/jobLocation';

// Emergency job lifecycle for the mechanic -- the counterpart to
// EmergencyTrackingScreen on the customer side and the emergency-aware sibling
// of BookingDetailScreen (which stays scoped to scheduled bookings; see
// service.controller.ts's isEmergency guards on the legacy endpoints this
// screen deliberately does NOT call).
//
// Flow: MECHANIC_ACCEPTED -> [Start Journey] -> MECHANIC_ON_THE_WAY ->
// [Mark Arrived] -> ARRIVED (start OTP auto-issued to customer) ->
// [enter start OTP] -> WORK_STARTED -> [Request Completion Code] ->
// [enter completion OTP] -> COMPLETED.

const LIVE_STATUSES = new Set(['MECHANIC_ACCEPTED', 'MECHANIC_ON_THE_WAY', 'ARRIVED', 'WORK_STARTED']);

export const EmergencyJobScreen = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const isFocused = useIsFocused();
  const { bookingId } = route.params;

  const [beforeUri, setBeforeUri] = useState<string | null>(null);
  const [afterUri, setAfterUri] = useState<string | null>(null);
  const [startOtp, setStartOtp] = useState('');
  const [completionOtp, setCompletionOtp] = useState('');
  const [completionRequested, setCompletionRequested] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: job, isLoading } = useQuery<Job>({
    queryKey: ['mechanic-job', bookingId],
    queryFn: async () => {
      const j = await jobService.getJob(bookingId);
      if (!j) throw new Error('Job not found');
      return j;
    },
    refetchInterval: isFocused ? 8000 : false,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['mechanic-job', bookingId] });
    queryClient.invalidateQueries({ queryKey: ['technician-bookings'] });
  };

  // Background GPS runs for exactly as long as the job is in a live-tracking
  // status. This is the only place startTracking/stopTracking are called for
  // this job -- leaving LIVE_STATUSES (any terminal status) stops it
  // uniformly rather than needing a separate "stop on complete" branch.
  useEffect(() => {
    if (!job) return;
    if (LIVE_STATUSES.has(job.status)) {
      startTracking(bookingId).then((ok) => {
        if (!ok) Alert.alert('Location permission needed', 'Enable location access so the customer can track you.');
      });
    } else {
      stopTracking(bookingId);
    }
  }, [job?.status, bookingId]);

  // Belt-and-braces: if this screen unmounts entirely (mechanic navigates
  // away) while a job is still live, tracking keeps running via the
  // background task regardless -- it is not tied to this component's
  // lifecycle. This cleanup only fires on a genuine app-level teardown path
  // some platforms use before unmount; harmless either way since
  // startTracking/stopTracking are idempotent.
  useEffect(() => () => { /* intentionally no-op: see comment above */ }, []);

  // Joins the job's socket room so status changes (customer cancels, admin
  // force-transitions, etc.) reach this screen instantly instead of waiting
  // up to 8s for the poll -- mirrors EmergencyTrackingScreen's subscription
  // on the customer side. The 8s poll above stays as a fallback for when the
  // socket is reconnecting, so this is additive, not a replacement.
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let mounted = true;

    (async () => {
      const socket = await getSocket();
      cleanup = await subscribeToJob(bookingId);
      if (!mounted) return;

      const onStatus = (payload: JobStatusEvent) => {
        if (payload.bookingId !== bookingId) return;
        invalidate();
      };
      socket.on(SERVER_EVENTS.JOB_STATUS, onStatus);

      const prevCleanup = cleanup;
      cleanup = () => {
        socket.off(SERVER_EVENTS.JOB_STATUS, onStatus);
        prevCleanup?.();
      };
    })();

    return () => {
      mounted = false;
      cleanup?.();
    };
  }, [bookingId]);

  const enRouteMutation = useMutation({
    mutationFn: () => jobService.markEnRoute(bookingId),
    onSuccess: invalidate,
    onError: (err: any) => Alert.alert('Error', err?.error || err?.message || 'Failed'),
  });
  const arrivedMutation = useMutation({
    mutationFn: () => jobService.markArrived(bookingId),
    onSuccess: invalidate,
    onError: (err: any) => Alert.alert('Error', err?.error || err?.message || 'Failed'),
  });
  const startWorkMutation = useMutation({
    mutationFn: () => jobService.startWork(bookingId, startOtp.trim()),
    onSuccess: (res) => {
      if (res.job) { invalidate(); setStartOtp(''); }
      else Alert.alert('Incorrect code', res.error || 'That code is not valid.');
    },
    onError: (err: any) => Alert.alert('Error', err?.error || err?.message || 'Failed'),
  });
  const requestCompletionMutation = useMutation({
    mutationFn: () => jobService.requestCompletion(bookingId),
    onSuccess: (res) => {
      if ('error' in res && res.error) Alert.alert('Error', res.error);
      else setCompletionRequested(true);
    },
  });
  const completeMutation = useMutation({
    mutationFn: () => jobService.completeJob(bookingId, completionOtp.trim()),
    onSuccess: (res) => {
      if (res.job) { invalidate(); navigation.navigate('Tabs', { screen: 'Bookings' }); }
      else Alert.alert('Incorrect code', res.error || 'That code is not valid.');
    },
    onError: (err: any) => Alert.alert('Error', err?.error || err?.message || 'Failed'),
  });

  if (isLoading || !job) return <Loader fullScreen />;

  const handleCall = async () => {
    const res = await jobService.callCounterparty(bookingId);
    if ('error' in res) Alert.alert('Cannot call right now', res.error);
    else Alert.alert('Connecting…', res.message);
  };

  const openNavigation = () => {
    const { lat, lng } = job.location;
    const url = lat && lng
      ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
      : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job.location.addressText)}`;
    Linking.openURL(url);
  };

  const takePhoto = async (setter: (uri: string) => void) => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera permission required', 'Enable camera access to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.6 });
    if (!result.canceled) setter(result.assets[0].uri);
  };

  const uploadWithLocation = async (uri: string, type: 'BEFORE' | 'AFTER') => {
    setUploading(true);
    try {
      let coords: { lat: number; lng: number } | undefined;
      try {
        const pos = await Location.getLastKnownPositionAsync();
        if (pos) coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      } catch {
        // Photo provenance is best-effort on location -- a missing GPS fix
        // must not block uploading the photo itself.
      }
      const res = await jobService.uploadPhoto(bookingId, uri, type, coords);
      if (!res.ok) Alert.alert('Upload failed', res.error || 'Could not upload photo.');
    } finally {
      setUploading(false);
    }
  };

  const handleStartWork = async () => {
    if (startOtp.trim().length !== 6) {
      Alert.alert('Enter the code', 'Ask the customer for their 6-digit start code.');
      return;
    }
    if (beforeUri) await uploadWithLocation(beforeUri, 'BEFORE');
    startWorkMutation.mutate();
  };

  const handleComplete = async () => {
    if (!afterUri) {
      Alert.alert('Photo required', 'Take an after-service photo before completing.');
      return;
    }
    if (completionOtp.trim().length !== 6) {
      Alert.alert('Enter the code', 'Ask the customer for their 6-digit completion code.');
      return;
    }
    await uploadWithLocation(afterUri, 'AFTER');
    completeMutation.mutate();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Card style={{ borderWidth: 1.5, borderColor: colors.primary }}>
        <Typography variant="h3">🚨 #{job.bookingNumber}</Typography>
        <Typography variant="caption" style={{ color: colors.primary, fontWeight: '700', marginTop: 4 }}>
          {job.statusMessage}
        </Typography>
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Typography variant="h3">Customer & Location</Typography>
        <Typography variant="body" style={{ marginTop: 4 }}>{job.location.addressText}</Typography>
        {!!job.landmark && <Typography variant="caption" style={{ color: colors.textSecondary }}>Landmark: {job.landmark}</Typography>}
        <Typography variant="caption" style={{ color: colors.textSecondary, marginTop: 4 }}>
          Contact: {job.customer?.name || 'Customer'}
        </Typography>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          {job.contact.canCall && (
            <Button title="Call" variant="outline" onPress={handleCall} style={{ flex: 1, flexDirection: 'row', gap: 6 }}>
              <Phone color={colors.primary} size={16} />
              <Typography variant="body" style={{ color: colors.primary, marginLeft: 6, fontWeight: '600' }}>Call</Typography>
            </Button>
          )}
          <Button title="Navigate" onPress={openNavigation} style={{ flex: 1 }}>
            <NavigationIcon color="#ffffff" size={16} />
            <Typography variant="body" style={{ color: '#ffffff', marginLeft: 6, fontWeight: '600' }}>Navigate</Typography>
          </Button>
        </View>
        {job.contact.canChat && (
          <Button
            title="Chat with Customer"
            variant="outline"
            onPress={() => navigation.navigate('BookingChat', { bookingId })}
            style={{ marginTop: 8, flexDirection: 'row', gap: 6 }}
          >
            <MessageCircle color={colors.primary} size={16} />
            <Typography variant="body" style={{ color: colors.primary, marginLeft: 6, fontWeight: '600' }}>Chat with Customer</Typography>
          </Button>
        )}
        {!job.contact.canCall && !job.contact.canChat && job.contact.reason && (
          <Typography variant="caption" style={{ color: colors.textSecondary, marginTop: 8 }}>{job.contact.reason}</Typography>
        )}
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Typography variant="h3">Vehicle & Service</Typography>
        <Typography variant="body" style={{ marginTop: 4 }}>
          {job.vehicle.brand} {job.vehicle.model} ({job.vehicle.type})
        </Typography>
        {job.vehicle.registrationNumber ? (
          <Typography variant="caption" style={{ color: colors.textSecondary }}>{job.vehicle.registrationNumber}</Typography>
        ) : null}
        <Typography variant="body" style={{ marginTop: 8, fontWeight: '600' }}>{job.category.name} — {job.package.name}</Typography>
        {job.issueDescription ? (
          <Typography variant="body" style={{ marginTop: 8 }}>{job.issueDescription}</Typography>
        ) : null}
      </Card>

      <Card style={{ marginTop: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Typography variant="h3">Payment</Typography>
          <Typography variant="body">{job.payment?.method || 'COD'}</Typography>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
          <Typography variant="body" style={{ fontWeight: '700' }}>Final Amount</Typography>
          <Typography variant="body" style={{ fontWeight: '700' }}>{formatINR(job.pricing.finalAmount)}</Typography>
        </View>
      </Card>

      {job.status === 'MECHANIC_ACCEPTED' && (
        <Button title="Start Journey" onPress={() => enRouteMutation.mutate()} loading={enRouteMutation.isPending} style={{ marginTop: 16 }} />
      )}

      {job.status === 'MECHANIC_ON_THE_WAY' && (
        <Button title="Mark Arrived" onPress={() => arrivedMutation.mutate()} loading={arrivedMutation.isPending} style={{ marginTop: 16 }} />
      )}

      {job.status === 'ARRIVED' && (
        <Card style={{ marginTop: 16 }}>
          <Typography variant="h3">Start Work</Typography>
          <Typography variant="caption" style={{ color: colors.textSecondary, marginTop: 4 }}>
            A start code was sent to the customer. Ask them to read it aloud.
          </Typography>
          {beforeUri ? (
            <Image source={{ uri: beforeUri }} style={styles.photoPreview} />
          ) : (
            <TouchableOpacity onPress={() => takePhoto(setBeforeUri)} style={styles.photoButton}>
              <Camera color={colors.textSecondary} size={28} />
              <Typography variant="caption" style={{ color: colors.textSecondary, marginTop: 4 }}>Take before photo (optional)</Typography>
            </TouchableOpacity>
          )}
          <Input
            label="Start code (from customer)"
            keyboardType="numeric"
            value={startOtp}
            onChangeText={setStartOtp}
            placeholder="000000"
            maxLength={6}
            containerStyle={{ marginTop: 12 }}
          />
          <Button
            title="Start Work"
            onPress={handleStartWork}
            loading={uploading || startWorkMutation.isPending}
            style={{ marginTop: 16 }}
          />
        </Card>
      )}

      {job.status === 'WORK_STARTED' && (
        <Card style={{ marginTop: 16 }}>
          <Typography variant="h3">Work in Progress</Typography>

          <View style={{ marginTop: 16, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16 }}>
            <Typography variant="h3">Finish the Job</Typography>
            {afterUri ? (
              <Image source={{ uri: afterUri }} style={styles.photoPreview} />
            ) : (
              <TouchableOpacity onPress={() => takePhoto(setAfterUri)} style={styles.photoButton}>
                <Camera color={colors.textSecondary} size={28} />
                <Typography variant="caption" style={{ color: colors.textSecondary, marginTop: 4 }}>Take after-service photo</Typography>
              </TouchableOpacity>
            )}
            {afterUri && (
              <Button title="Retake Photo" variant="outline" onPress={() => takePhoto(setAfterUri)} style={{ marginTop: 8 }} />
            )}
            {!completionRequested ? (
              <Button
                title="Request Completion Code"
                variant="outline"
                onPress={() => requestCompletionMutation.mutate()}
                loading={requestCompletionMutation.isPending}
                style={{ marginTop: 16 }}
              />
            ) : (
              <Typography variant="caption" style={{ color: colors.success, marginTop: 16, fontWeight: '700' }}>
                Completion code sent to the customer.
              </Typography>
            )}
            <Input
              label="Completion code (from customer)"
              keyboardType="numeric"
              value={completionOtp}
              onChangeText={setCompletionOtp}
              placeholder="000000"
              maxLength={6}
              containerStyle={{ marginTop: 12 }}
            />
            <Button title="Mark Completed" onPress={handleComplete} loading={uploading || completeMutation.isPending} style={{ marginTop: 16 }} />
          </View>
        </Card>
      )}

      {job.status === 'COMPLETED' && (
        <Card style={{ marginTop: 16 }}>
          <Typography variant="h3">Completed</Typography>
          <Typography variant="body" style={{ marginTop: 8 }}>Final amount: {formatINR(job.pricing.finalAmount)}</Typography>
          <Typography variant="caption" style={{ color: colors.textSecondary, marginTop: 4 }}>
            Credited to your wallet.
          </Typography>
        </Card>
      )}

      {job.status === 'CANCELLED' && (
        <Card style={{ marginTop: 16 }}>
          <Typography variant="h3">Cancelled</Typography>
          {job.cancelReason ? <Typography variant="body" style={{ marginTop: 8 }}>Reason: {job.cancelReason}</Typography> : null}
        </Card>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  photoButton: { alignItems: 'center', justifyContent: 'center', height: 140, borderRadius: 8, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', marginTop: 12 },
  photoPreview: { width: '100%', height: 180, borderRadius: 8, marginTop: 12 },
});
