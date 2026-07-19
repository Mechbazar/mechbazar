import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { colors, Typography, Card, Button, Input, Badge, Loader, adminService } from '@mechbazar/shared';

const getStatusMeta = (status: string): { label: string; variant: 'success' | 'warning' | 'danger' | 'secondary' } => {
  switch (status) {
    case 'PENDING':
    case 'PROCESSING':
      return { label: 'Pending', variant: 'warning' };
    case 'COMPLETED':
      return { label: 'Completed', variant: 'success' };
    case 'FAILED':
      return { label: 'Failed', variant: 'danger' };
    default:
      return { label: status, variant: 'secondary' };
  }
};

// Mirrors apps/admin/src/pages/services/TechnicianPayouts.tsx's "Process Payout" modal.
export const TechnicianPayoutDetailScreen = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const { settlementId } = route.params;
  const [transactionId, setTransactionId] = useState('');

  const { data: settlements, isLoading } = useQuery({
    queryKey: ['admin-technician-settlements'],
    queryFn: adminService.getTechnicianSettlements,
  });

  const settlement = settlements?.find((s: any) => s.id === settlementId);

  const statusMutation = useMutation({
    mutationFn: (payload: { status: string; transactionId?: string }) => adminService.updateTechnicianSettlementStatus(settlementId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-technician-settlements'] });
      navigation.goBack();
    },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.error || 'Failed to update settlement'),
  });

  if (isLoading || !settlement) return <Loader fullScreen />;

  const meta = getStatusMeta(settlement.status);
  const bankAccount = settlement.technician?.bankAccounts?.[0];
  const isPending = settlement.status === 'PENDING';

  const handleComplete = () => {
    if (!transactionId.trim()) {
      Alert.alert('Transaction ID Required', 'Transaction ID is required to mark as completed.');
      return;
    }
    statusMutation.mutate({ status: 'COMPLETED', transactionId: transactionId.trim() });
  };

  const handleFail = () => {
    Alert.alert('Fail & Refund', 'This will refund the amount to the technician wallet. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Fail & Refund', style: 'destructive', onPress: () => statusMutation.mutate({ status: 'FAILED', transactionId: transactionId.trim() || undefined }) },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Typography variant="h3">{settlement.technician?.user?.name || 'Unknown Technician'}</Typography>
          <Badge label={meta.label} variant={meta.variant} size="sm" />
        </View>
        <Typography variant="h2" style={{ marginTop: 8 }}>₹{settlement.amount?.toLocaleString()}</Typography>
        <Typography variant="caption">{new Date(settlement.date).toLocaleDateString()}</Typography>
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Typography variant="h3">Bank Details</Typography>
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

      {isPending ? (
        <Card style={{ marginTop: 12 }}>
          <Input
            label="Transaction ID"
            value={transactionId}
            onChangeText={setTransactionId}
            placeholder="Required to mark completed"
            containerStyle={{ marginBottom: 16 }}
          />
          <Button title="Mark Completed" onPress={handleComplete} loading={statusMutation.isPending} style={{ backgroundColor: colors.success, marginBottom: 8 }} />
          <Button title="Fail & Refund" variant="danger" onPress={handleFail} />
        </Card>
      ) : (
        settlement.transactionId && (
          <Card style={{ marginTop: 12 }}>
            <View style={styles.row}><Typography variant="caption">Transaction ID</Typography><Typography variant="body">{settlement.transactionId}</Typography></View>
          </Card>
        )
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
});
