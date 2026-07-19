import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Alert, Linking, Modal, TouchableOpacity } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { colors, Typography, Card, Button, Input, Badge, Loader, adminService, getApiBaseUrl } from '@mechbazar/shared';

const getUploadUrl = (path: string) => `${getApiBaseUrl().replace(/\/api\/?$/, '')}${path}`;

const getStatusMeta = (status: string): { label: string; variant: 'success' | 'warning' | 'danger' | 'secondary' } => {
  switch (status) {
    case 'APPROVED':
      return { label: 'Approved', variant: 'success' };
    case 'PENDING':
    case 'UNDER_VERIFICATION':
      return { label: 'Needs Review', variant: 'warning' };
    case 'REJECTED':
      return { label: 'Rejected', variant: 'danger' };
    default:
      return { label: status, variant: 'secondary' };
  }
};

// Mirrors apps/admin/src/pages/Vendors.tsx's KYC-review modal + basic-edit
// modal, combined into one pushed detail screen.
export const VendorDetailScreen = () => {
  const route = useRoute<any>();
  const queryClient = useQueryClient();
  const { vendorId } = route.params;
  const [editVisible, setEditVisible] = useState(false);
  const [editForm, setEditForm] = useState<any>(null);

  const { data: vendors, isLoading } = useQuery({
    queryKey: ['admin-vendors'],
    queryFn: adminService.getVendors,
  });

  const vendor = vendors?.find((v: any) => v.id === vendorId);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-vendors'] });

  const statusMutation = useMutation({
    mutationFn: (status: string) => adminService.updateVendorStatus(vendor.vendorProfile.id, status),
    onSuccess: invalidate,
    onError: () => Alert.alert('Error', 'Failed to update vendor status'),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: any) => adminService.updateVendor(vendor.id, payload),
    onSuccess: () => {
      invalidate();
      setEditVisible(false);
    },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.error || 'Failed to update vendor'),
  });

  if (isLoading || !vendor) return <Loader fullScreen />;

  const profile = vendor.vendorProfile || {};
  const meta = getStatusMeta(profile.status);
  const bankAccount = profile.bankAccounts?.[0];
  const isReviewable = profile.status === 'PENDING' || profile.status === 'UNDER_VERIFICATION';

  const openEdit = () => {
    setEditForm({
      id: vendor.id,
      name: vendor.name || '',
      phone: vendor.phone || '',
      email: vendor.email || '',
      city: vendor.city || '',
      state: vendor.state || '',
      storeName: profile.storeName || '',
      gstNumber: profile.gstNumber || '',
      isActive: profile.isActive !== false,
    });
    setEditVisible(true);
  };

  const handleReject = () => {
    Alert.alert('Reject Vendor', 'Are you sure you want to reject this vendor?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reject', style: 'destructive', onPress: () => statusMutation.mutate('REJECTED') },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Typography variant="h3">{profile.storeName || vendor.name}</Typography>
          <Badge label={meta.label} variant={meta.variant} size="sm" />
        </View>
        <Typography variant="caption" style={{ marginTop: 4 }}>{vendor.name} • {vendor.phone}</Typography>
        <Button title="Edit Details" variant="outline" size="sm" onPress={openEdit} style={{ marginTop: 12 }} />
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Typography variant="h3">Business Details</Typography>
        <View style={styles.row}><Typography variant="caption">Business Type</Typography><Typography variant="body">{profile.businessType || 'N/A'}</Typography></View>
        <View style={styles.row}><Typography variant="caption">GST Number</Typography><Typography variant="body">{profile.gstNumber || 'N/A'}</Typography></View>
        <View style={[styles.row, { borderBottomWidth: 0 }]}><Typography variant="caption">PAN Number</Typography><Typography variant="body">{profile.panNumber || 'N/A'}</Typography></View>
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
          <Typography variant="body" style={{ color: colors.textSecondary }}>No verified bank account found.</Typography>
        )}
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Typography variant="h3">Documents</Typography>
        {(!profile.documents || profile.documents.length === 0) ? (
          <Typography variant="body" style={{ color: colors.textSecondary }}>No documents uploaded.</Typography>
        ) : (
          profile.documents.map((doc: any) => (
            <TouchableOpacity key={doc.id} onPress={() => Linking.openURL(getUploadUrl(doc.url))} style={styles.row}>
              <Typography variant="body" style={{ color: colors.navy, fontWeight: '600' }}>{doc.type}</Typography>
              <Typography variant="caption">{doc.status}</Typography>
            </TouchableOpacity>
          ))
        )}
      </Card>

      {isReviewable && (
        <View style={{ marginTop: 16, gap: 8 }}>
          <Button title="Approve Vendor" onPress={() => statusMutation.mutate('APPROVED')} loading={statusMutation.isPending} style={{ backgroundColor: colors.success }} />
          <Button title="Reject Vendor" variant="danger" onPress={handleReject} />
        </View>
      )}

      <Modal visible={editVisible} animationType="slide" presentationStyle="formSheet">
        <ScrollView style={styles.container} contentContainerStyle={{ padding: 24 }}>
          <Typography variant="h2" style={{ marginBottom: 16 }}>Edit Vendor</Typography>
          {editForm && (
            <>
              <Input label="Name" value={editForm.name} onChangeText={(t) => setEditForm({ ...editForm, name: t })} containerStyle={{ marginBottom: 12 }} />
              <Input label="Phone" value={editForm.phone} onChangeText={(t) => setEditForm({ ...editForm, phone: t })} keyboardType="phone-pad" containerStyle={{ marginBottom: 12 }} />
              <Input label="Email" value={editForm.email} onChangeText={(t) => setEditForm({ ...editForm, email: t })} keyboardType="email-address" autoCapitalize="none" containerStyle={{ marginBottom: 12 }} />
              <Input label="Store Name" value={editForm.storeName} onChangeText={(t) => setEditForm({ ...editForm, storeName: t })} containerStyle={{ marginBottom: 12 }} />
              <Input label="City" value={editForm.city} onChangeText={(t) => setEditForm({ ...editForm, city: t })} containerStyle={{ marginBottom: 12 }} />
              <Input label="State" value={editForm.state} onChangeText={(t) => setEditForm({ ...editForm, state: t })} containerStyle={{ marginBottom: 12 }} />
              <Input label="GST Number" value={editForm.gstNumber} onChangeText={(t) => setEditForm({ ...editForm, gstNumber: t })} autoCapitalize="characters" containerStyle={{ marginBottom: 12 }} />
              <Button title="Save Changes" onPress={() => updateMutation.mutate(editForm)} loading={updateMutation.isPending} style={{ marginTop: 8 }} />
              <Button title="Cancel" variant="outline" onPress={() => setEditVisible(false)} style={{ marginTop: 8 }} />
            </>
          )}
        </ScrollView>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
});
