import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Linking, Alert, Image, TouchableOpacity } from 'react-native';
import { useRoute, useNavigation, useIsFocused } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { colors, Typography, Card, Button, Input, Loader, technicianService } from '@mechbazar/shared';
import { Phone, Navigation as NavigationIcon, Camera, MessageCircle } from 'lucide-react-native';
import { formatINR } from '../utils/currency';

// Backend flow: MECHANIC_ASSIGNED -> (Accept/Reject) -> MECHANIC_ACCEPTED ->
// MECHANIC_ON_THE_WAY -> ARRIVED -> WORK_STARTED -> (generate OTP, customer
// reads it aloud) -> COMPLETED. Rejecting sends the booking to REJECTED and
// the backend auto-attempts reassignment to another technician -- it then
// disappears from this technician's own bookings list entirely (technicianId
// gets cleared), so there's nothing further to show here after a reject.
// The additional-work-approval request is a non-blocking flag layered on top
// of WORK_STARTED (approvalStatus), not a separate top-level status -- this
// screen keeps polling while WORK_STARTED so the customer's response to a
// pending request surfaces without the technician needing to leave and come
// back.
export const BookingDetailScreen = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const isFocused = useIsFocused();
  const { bookingId } = route.params;

  const [beforeUri, setBeforeUri] = useState<string | null>(null);
  const [afterUri, setAfterUri] = useState<string | null>(null);
  const [showApprovalForm, setShowApprovalForm] = useState(false);
  const [additionalCost, setAdditionalCost] = useState('');
  const [approvalNote, setApprovalNote] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: booking, isLoading } = useQuery<any>({
    queryKey: ['technician-booking', bookingId],
    queryFn: () => technicianService.getBookingById(bookingId),
    refetchInterval: isFocused ? 10000 : false,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['technician-booking', bookingId] });
    queryClient.invalidateQueries({ queryKey: ['technician-bookings'] });
  };

  const statusMutation = useMutation({
    mutationFn: ({ status, otp }: { status: string; otp?: string }) => technicianService.updateBookingStatus(bookingId, status, otp ? { otp } : undefined),
    onSuccess: (_data, { status }) => {
      invalidate();
      if (status === 'COMPLETED') navigation.goBack();
    },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.error || err.message),
  });

  const acceptMutation = useMutation({
    mutationFn: () => technicianService.acceptBookingJob(bookingId),
    onSuccess: invalidate,
    onError: (err: any) => Alert.alert('Error', err.response?.data?.error || err.message),
  });

  const rejectMutation = useMutation({
    mutationFn: () => technicianService.rejectBookingJob(bookingId, rejectReason.trim() || undefined),
    onSuccess: () => {
      invalidate();
      navigation.goBack();
    },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.error || err.message),
  });

  const generateOtpMutation = useMutation({
    mutationFn: () => technicianService.generateBookingOtp(bookingId),
    onSuccess: () => Alert.alert('Code sent', "A completion code was sent to the customer. Ask them to read it aloud, then enter it below to finish the job."),
    onError: (err: any) => Alert.alert('Error', err.response?.data?.error || err.message),
  });

  const approvalMutation = useMutation({
    mutationFn: () => technicianService.requestBookingApproval(bookingId, Number(additionalCost), approvalNote.trim()),
    onSuccess: () => {
      invalidate();
      setShowApprovalForm(false);
      setAdditionalCost('');
      setApprovalNote('');
    },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.error || err.message),
  });

  if (isLoading || !booking) return <Loader fullScreen />;

  const callNumber = (phone: string) => Linking.openURL(`tel:${phone}`);

  const openNavigation = () => {
    const { lat, lng } = booking.address || {};
    const url = lat && lng
      ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
      : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
          `${booking.address?.line1}, ${booking.address?.city}, ${booking.address?.state} ${booking.address?.pincode}`
        )}`;
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

  const handleStartWork = async () => {
    try {
      setSubmitting(true);
      if (beforeUri) {
        await technicianService.uploadBookingImage(bookingId, beforeUri, 'image/jpeg', `before-${bookingId}.jpg`, 'BEFORE');
      }
      await statusMutation.mutateAsync({ status: 'WORK_STARTED' });
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkCompleted = async () => {
    if (!afterUri) {
      Alert.alert('Photo required', 'Take an after-service photo before marking this booking as completed.');
      return;
    }
    if (!otpInput.trim()) {
      Alert.alert('Code required', 'Ask the customer for their completion code and enter it below.');
      return;
    }
    try {
      setSubmitting(true);
      await technicianService.uploadBookingImage(bookingId, afterUri, 'image/jpeg', `after-${bookingId}.jpg`, 'AFTER');
      await statusMutation.mutateAsync({ status: 'COMPLETED', otp: otpInput.trim() });
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = () => {
    if (!rejectReason.trim()) {
      Alert.alert('Reason required', 'Briefly describe why you are rejecting this job.');
      return;
    }
    rejectMutation.mutate();
  };

  const handleSubmitApproval = () => {
    const amt = parseFloat(additionalCost);
    if (!amt || amt <= 0) {
      Alert.alert('Invalid amount', 'Enter a valid additional cost.');
      return;
    }
    if (!approvalNote.trim()) {
      Alert.alert('Note required', 'Describe the additional work needed.');
      return;
    }
    approvalMutation.mutate();
  };

  const imageCounts = (booking.images || []).reduce((acc: Record<string, number>, img: any) => {
    acc[img.type] = (acc[img.type] || 0) + 1;
    return acc;
  }, {});

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Card>
        <Typography variant="h3">#{booking.bookingNumber}</Typography>
        <Typography variant="caption" style={{ color: colors.primary, fontWeight: '700', marginTop: 4 }}>{booking.status}</Typography>
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Typography variant="h3">Customer & Location</Typography>
        <Typography variant="body" style={{ marginTop: 4 }}>
          {booking.address?.line1}{booking.address?.line2 ? `, ${booking.address.line2}` : ''}
        </Typography>
        <Typography variant="body">{booking.address?.city}, {booking.address?.state} {booking.address?.pincode}</Typography>
        <Typography variant="caption" style={{ color: colors.textSecondary, marginTop: 4 }}>
          Contact: {booking.user?.name || 'Customer'} — {booking.user?.phone}
        </Typography>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <Button title="Call" variant="outline" onPress={() => callNumber(booking.user?.phone)} style={{ flex: 1, flexDirection: 'row', gap: 6 }}>
            <Phone color={colors.primary} size={16} />
            <Typography variant="body" style={{ color: colors.primary, marginLeft: 6, fontWeight: '600' }}>Call</Typography>
          </Button>
          <Button title="Navigate" onPress={openNavigation} style={{ flex: 1 }}>
            <NavigationIcon color="#ffffff" size={16} />
            <Typography variant="body" style={{ color: '#ffffff', marginLeft: 6, fontWeight: '600' }}>Navigate</Typography>
          </Button>
        </View>
        <Button
          title="Chat with Customer"
          variant="outline"
          onPress={() => navigation.navigate('BookingChat', { bookingId })}
          style={{ marginTop: 8, flexDirection: 'row', gap: 6 }}
        >
          <MessageCircle color={colors.primary} size={16} />
          <Typography variant="body" style={{ color: colors.primary, marginLeft: 6, fontWeight: '600' }}>Chat with Customer</Typography>
        </Button>
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Typography variant="h3">Vehicle & Service</Typography>
        <Typography variant="body" style={{ marginTop: 4 }}>
          {booking.vehicleBrand} {booking.vehicleModel} ({booking.vehicleType})
        </Typography>
        {booking.vehicleRegistrationNumber ? (
          <Typography variant="caption" style={{ color: colors.textSecondary }}>{booking.vehicleRegistrationNumber}</Typography>
        ) : null}
        <Typography variant="body" style={{ marginTop: 8, fontWeight: '600' }}>{booking.category?.name}{booking.package?.name ? ` — ${booking.package.name}` : ''}</Typography>
        <Typography variant="caption" style={{ color: colors.textSecondary, marginTop: 2 }}>
          {new Date(booking.scheduledDate).toLocaleDateString()} • {booking.timeSlot?.label}
        </Typography>
        {booking.issueDescription ? (
          <Typography variant="body" style={{ marginTop: 8 }}>{booking.issueDescription}</Typography>
        ) : null}
      </Card>

      <Card style={{ marginTop: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Typography variant="h3">Payment</Typography>
          <Typography variant="body">{booking.payment?.method || 'N/A'}</Typography>
        </View>
        <View style={{ marginTop: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Typography variant="body">Estimated Cost</Typography>
            <Typography variant="body">{formatINR(booking.estimatedCost)}</Typography>
          </View>
          {booking.additionalCost > 0 && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
              <Typography variant="body">Additional Cost</Typography>
              <Typography variant="body">{formatINR(booking.additionalCost)}</Typography>
            </View>
          )}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
            <Typography variant="body" style={{ fontWeight: '700' }}>Final Amount</Typography>
            <Typography variant="body" style={{ fontWeight: '700' }}>{formatINR(booking.finalAmount)}</Typography>
          </View>
        </View>
      </Card>

      {booking.status === 'MECHANIC_ASSIGNED' && !showRejectForm && (
        <View style={{ marginTop: 16, gap: 8 }}>
          <Button title="Accept Job" onPress={() => acceptMutation.mutate()} loading={acceptMutation.isPending} />
          <Button title="Reject Job" variant="outline" onPress={() => setShowRejectForm(true)} />
        </View>
      )}

      {showRejectForm && (
        <Card style={{ marginTop: 16 }}>
          <Typography variant="h3">Reject Job</Typography>
          <Input
            label="Reason"
            value={rejectReason}
            onChangeText={setRejectReason}
            multiline
            placeholder="Why can't you take this job?"
            containerStyle={{ marginTop: 12 }}
          />
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
            <Button title="Cancel" variant="outline" onPress={() => setShowRejectForm(false)} style={{ flex: 1 }} />
            <Button title="Confirm Reject" onPress={handleReject} loading={rejectMutation.isPending} style={{ flex: 1 }} />
          </View>
        </Card>
      )}

      {booking.status === 'MECHANIC_ACCEPTED' && (
        <Button title="Start Journey" onPress={() => statusMutation.mutate({ status: 'MECHANIC_ON_THE_WAY' })} loading={statusMutation.isPending} style={{ marginTop: 16 }} />
      )}

      {booking.status === 'MECHANIC_ON_THE_WAY' && (
        <Button title="Mark Arrived" onPress={() => statusMutation.mutate({ status: 'ARRIVED' })} loading={statusMutation.isPending} style={{ marginTop: 16 }} />
      )}

      {booking.status === 'ARRIVED' && (
        <Card style={{ marginTop: 16 }}>
          <Typography variant="h3">Start Work</Typography>
          <Typography variant="caption" style={{ color: colors.textSecondary, marginTop: 4 }}>
            Optionally take a "before" photo of the vehicle.
          </Typography>
          {beforeUri ? (
            <Image source={{ uri: beforeUri }} style={styles.photoPreview} />
          ) : (
            <TouchableOpacity onPress={() => takePhoto(setBeforeUri)} style={styles.photoButton}>
              <Camera color={colors.textSecondary} size={28} />
              <Typography variant="caption" style={{ color: colors.textSecondary, marginTop: 4 }}>Take before photo (optional)</Typography>
            </TouchableOpacity>
          )}
          <Button title="Start Work" onPress={handleStartWork} loading={submitting || statusMutation.isPending} style={{ marginTop: 16 }} />
        </Card>
      )}

      {booking.status === 'WORK_STARTED' && (
        <Card style={{ marginTop: 16 }}>
          <Typography variant="h3">Work in Progress</Typography>

          {booking.approvalStatus === 'PENDING' ? (
            <View style={{ marginTop: 8, padding: 12, borderRadius: 8, backgroundColor: colors.surfaceHover }}>
              <Typography variant="body" style={{ fontWeight: '700' }}>Waiting for customer approval (+{formatINR(booking.additionalCost)})</Typography>
              {booking.approvalNote ? <Typography variant="caption" style={{ color: colors.textSecondary, marginTop: 4 }}>{booking.approvalNote}</Typography> : null}
            </View>
          ) : !showApprovalForm ? (
            <Button title="Request Additional Work Approval" variant="outline" onPress={() => setShowApprovalForm(true)} style={{ marginTop: 12 }} />
          ) : (
            <View style={{ marginTop: 12 }}>
              <Input
                label="Additional Cost"
                keyboardType="numeric"
                value={additionalCost}
                onChangeText={setAdditionalCost}
                placeholder="0.00"
              />
              <Input
                label="Note describing the additional work"
                value={approvalNote}
                onChangeText={setApprovalNote}
                multiline
                containerStyle={{ marginTop: 12 }}
              />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
                <Button title="Cancel" variant="outline" onPress={() => setShowApprovalForm(false)} style={{ flex: 1 }} />
                <Button title="Send Request" onPress={handleSubmitApproval} loading={approvalMutation.isPending} style={{ flex: 1 }} />
              </View>
            </View>
          )}

          <View style={{ marginTop: 20, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16 }}>
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
            <Button
              title="Generate OTP Verification"
              variant="outline"
              onPress={() => generateOtpMutation.mutate()}
              loading={generateOtpMutation.isPending}
              style={{ marginTop: 16 }}
            />
            <Input
              label="Completion code (from customer)"
              keyboardType="numeric"
              value={otpInput}
              onChangeText={setOtpInput}
              placeholder="0000"
              containerStyle={{ marginTop: 12 }}
            />
            <Button title="Mark Completed" onPress={handleMarkCompleted} loading={submitting || statusMutation.isPending} style={{ marginTop: 16 }} />
          </View>
        </Card>
      )}

      {booking.status === 'COMPLETED' && (
        <Card style={{ marginTop: 16 }}>
          <Typography variant="h3">Completed</Typography>
          <Typography variant="body" style={{ marginTop: 8 }}>Final amount: {formatINR(booking.finalAmount)}</Typography>
          <Button
            title="View Invoice"
            variant="outline"
            onPress={async () => {
              try {
                await technicianService.getBookingInvoice(bookingId);
                Alert.alert('Invoice', 'Invoice generated. Ask the customer to view it from their app, or check the admin panel.');
              } catch (err: any) {
                Alert.alert('Error', err.response?.data?.error || err.message);
              }
            }}
            style={{ marginTop: 12 }}
          />
        </Card>
      )}

      {booking.status === 'CANCELLED' && (
        <Card style={{ marginTop: 16 }}>
          <Typography variant="h3">Cancelled</Typography>
          {booking.cancelReason ? <Typography variant="body" style={{ marginTop: 8 }}>Reason: {booking.cancelReason}</Typography> : null}
        </Card>
      )}

      {Object.keys(imageCounts).length > 0 && (
        <Card style={{ marginTop: 12, marginBottom: 24 }}>
          <Typography variant="h3">Photos</Typography>
          {Object.entries(imageCounts).map(([type, count]) => (
            <View key={type} style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
              <Typography variant="body">{type}</Typography>
              <Typography variant="caption" style={{ color: colors.textSecondary }}>{count as number} uploaded</Typography>
            </View>
          ))}
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
