import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Alert, Modal, TouchableOpacity, Image } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import { colors, Typography, Card, Button, Input, Badge, Loader, adminService, getApiBaseUrl } from '@mechbazar/shared';

// Technician KYC documents are behind an authenticated route, same pattern as
// rider documents -- Image supports a `headers` option on its uri source, so
// the token can be attached directly instead of needing a blob/download step.
const getDocumentUrl = (technicianProfileId: string, documentId: string) =>
  `${getApiBaseUrl().replace(/\/api\/?$/, '')}/api/technicians/${technicianProfileId}/documents/${documentId}/file`;

const getStatusMeta = (status: string): { label: string; variant: 'success' | 'warning' | 'danger' | 'secondary' } => {
  switch (status) {
    case 'APPROVED':
      return { label: 'Approved', variant: 'success' };
    case 'PENDING':
      return { label: 'Not Submitted', variant: 'secondary' };
    case 'UNDER_VERIFICATION':
      return { label: 'Needs Review', variant: 'warning' };
    case 'RESUBMISSION_REQUIRED':
      return { label: 'Resubmission Requested', variant: 'warning' };
    default:
      return { label: status || 'Rejected', variant: 'danger' };
  }
};

const REVIEWABLE = new Set(['PENDING', 'UNDER_VERIFICATION', 'RESUBMISSION_REQUIRED']);

// Mirrors apps/admin/src/pages/services/Technicians.tsx's KYC-review modal, as
// a pushed detail screen -- same shape as RiderDetailScreen.tsx.
export const TechnicianDetailScreen = () => {
  const route = useRoute<any>();
  const queryClient = useQueryClient();
  const { technicianId } = route.params;
  const [remarks, setRemarks] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);

  useEffect(() => {
    SecureStore.getItemAsync('token').then(setToken);
  }, []);

  const { data: technicians, isLoading } = useQuery({
    queryKey: ['admin-technicians'],
    queryFn: adminService.getTechnicians,
  });

  const technician = technicians?.find((t: any) => t.id === technicianId);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-technicians'] });

  const statusMutation = useMutation({
    mutationFn: (status: string) => adminService.updateTechnicianStatus(technician.technicianProfile.id, status, remarks),
    onSuccess: invalidate,
    onError: () => Alert.alert('Error', 'Failed to update technician status'),
  });

  if (isLoading || !technician) return <Loader fullScreen />;

  const profile = technician.technicianProfile || {};
  const meta = getStatusMeta(profile.status);
  const bankAccount = profile.bankAccounts?.[0];
  const isReviewable = REVIEWABLE.has(profile.status);

  const handleReject = () => {
    Alert.alert('Reject Application', 'Are you sure you want to reject this technician application?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reject', style: 'destructive', onPress: () => statusMutation.mutate('REJECTED') },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Typography variant="h3">{technician.name || 'Unnamed Technician'}</Typography>
          <Badge label={meta.label} variant={meta.variant} size="sm" />
        </View>
        <Typography variant="caption" style={{ marginTop: 4 }}>{technician.phone} • {technician.email || 'No email'}</Typography>
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Typography variant="h3">Personal & Skill Details</Typography>
        <View style={styles.row}><Typography variant="caption">Address</Typography><Typography variant="body">{profile.addressLine || 'N/A'}, {profile.city || ''} {profile.pincode || ''}</Typography></View>
        <View style={styles.row}><Typography variant="caption">Aadhaar Number</Typography><Typography variant="body">{profile.aadhaarNumber || 'N/A'}</Typography></View>
        <View style={styles.row}><Typography variant="caption">Specializations</Typography><Typography variant="body">{(profile.specializations || []).join(', ') || 'N/A'}</Typography></View>
        <View style={styles.row}><Typography variant="caption">Skills</Typography><Typography variant="body">{(profile.skills || []).join(', ') || 'N/A'}</Typography></View>
        <View style={[styles.row, { borderBottomWidth: 0 }]}><Typography variant="caption">Experience</Typography><Typography variant="body">{profile.experienceYears != null ? `${profile.experienceYears} years` : 'N/A'}</Typography></View>
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Typography variant="h3">Emergency Contact</Typography>
        <View style={[styles.row, { borderBottomWidth: 0 }]}>
          <Typography variant="caption">{profile.emergencyContactName || 'N/A'}</Typography>
          <Typography variant="body">{profile.emergencyContactPhone || ''}</Typography>
        </View>
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Typography variant="h3">Bank Account</Typography>
        {bankAccount ? (
          <>
            <View style={styles.row}><Typography variant="caption">Account Holder</Typography><Typography variant="body">{bankAccount.accountHolderName}</Typography></View>
            <View style={styles.row}><Typography variant="caption">Bank</Typography><Typography variant="body">{bankAccount.bankName}</Typography></View>
            <View style={styles.row}><Typography variant="caption">Account No.</Typography><Typography variant="body">{bankAccount.accountNumber}</Typography></View>
            <View style={[styles.row, { borderBottomWidth: 0 }]}><Typography variant="caption">IFSC</Typography><Typography variant="body">{bankAccount.ifscCode}</Typography></View>
          </>
        ) : (
          <Typography variant="body" style={{ color: colors.textSecondary }}>No bank account on file.</Typography>
        )}
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Typography variant="h3">Documents</Typography>
        {(!profile.documents || profile.documents.length === 0) ? (
          <Typography variant="body" style={{ color: colors.textSecondary }}>No documents uploaded.</Typography>
        ) : (
          profile.documents.map((doc: any) => (
            <TouchableOpacity key={doc.id} onPress={() => setPreviewDoc(doc)} style={styles.row}>
              <Typography variant="body" style={{ color: colors.navy, fontWeight: '600' }}>{doc.type.replace(/_/g, ' ')}</Typography>
              <Typography variant="caption">{doc.status}</Typography>
            </TouchableOpacity>
          ))
        )}
      </Card>

      {isReviewable && (
        <Card style={{ marginTop: 12 }}>
          <Typography variant="h3">Remarks</Typography>
          <Input
            value={remarks}
            onChangeText={setRemarks}
            placeholder="Note for the technician (e.g. which document to resubmit)..."
            multiline
            containerStyle={{ marginTop: 8 }}
          />
        </Card>
      )}

      {isReviewable && (
        <View style={{ marginTop: 16, gap: 8, marginBottom: 24 }}>
          <Button title="Approve & Activate Technician" onPress={() => statusMutation.mutate('APPROVED')} loading={statusMutation.isPending} style={{ backgroundColor: colors.success }} />
          <Button title="Request Resubmission" variant="outline" onPress={() => statusMutation.mutate('RESUBMISSION_REQUIRED')} loading={statusMutation.isPending} />
          <Button title="Reject" variant="danger" onPress={handleReject} loading={statusMutation.isPending} />
        </View>
      )}

      <Modal visible={!!previewDoc} animationType="fade" transparent onRequestClose={() => setPreviewDoc(null)}>
        <TouchableOpacity style={styles.previewBackdrop} activeOpacity={1} onPress={() => setPreviewDoc(null)}>
          {previewDoc && token && (
            <Image
              source={{ uri: getDocumentUrl(profile.id, previewDoc.id), headers: { Authorization: `Bearer ${token}` } }}
              style={styles.previewImage}
              resizeMode="contain"
            />
          )}
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  previewBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  previewImage: { width: '90%', height: '70%' },
});
