import React from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { colors, Typography, Card, Button, Badge, Loader, adminService } from '@mechbazar/shared';

// The "View Details" action on apps/admin/src/pages/Customers.tsx is
// rendered disabled/no-op there (a bug) — this is the real screen behind it.
export const CustomerDetailScreen = () => {
  const route = useRoute<any>();
  const queryClient = useQueryClient();
  const { customerId } = route.params;

  const { data: customers, isLoading } = useQuery({
    queryKey: ['admin-customers'],
    queryFn: adminService.getCustomers,
  });

  const customer = customers?.find((c: any) => c.id === customerId);

  const verifyMutation = useMutation({
    mutationFn: () => adminService.updateCustomer(customerId, { isBusinessVerified: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-customers'] }),
    onError: () => Alert.alert('Error', 'Failed to verify customer'),
  });

  if (isLoading || !customer) return <Loader fullScreen />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Typography variant="h3">{customer.name}</Typography>
          <Badge label={customer.accountType} variant={customer.accountType === 'WHOLESALE' ? 'secondary' : 'primary'} size="sm" />
        </View>
        <Typography variant="caption" style={{ marginTop: 4 }}>{customer.phone}</Typography>
        {customer.email && <Typography variant="caption">{customer.email}</Typography>}
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Typography variant="h3">Account Summary</Typography>
        <View style={styles.row}><Typography variant="caption">Total Orders</Typography><Typography variant="body">{customer._count?.orders ?? 0}</Typography></View>
        <View style={[styles.row, { borderBottomWidth: 0 }]}><Typography variant="caption">City / State</Typography><Typography variant="body">{customer.city || 'N/A'}, {customer.state || 'N/A'}</Typography></View>
      </Card>

      {customer.accountType === 'WHOLESALE' && (
        <Card style={{ marginTop: 12 }}>
          <Typography variant="h3">Business (B2B) Details</Typography>
          <View style={styles.row}><Typography variant="caption">Company</Typography><Typography variant="body">{customer.companyName || 'N/A'}</Typography></View>
          <View style={styles.row}><Typography variant="caption">Contact Person</Typography><Typography variant="body">{customer.contactPerson || 'N/A'}</Typography></View>
          <View style={styles.row}><Typography variant="caption">GST Number</Typography><Typography variant="body">{customer.gstNumber || 'N/A'}</Typography></View>
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <Typography variant="caption">Verification</Typography>
            <Badge label={customer.isBusinessVerified ? 'Verified' : 'Pending'} variant={customer.isBusinessVerified ? 'success' : 'warning'} size="sm" />
          </View>
          {!customer.isBusinessVerified && (
            <Button title="Approve B2B Verification" onPress={() => verifyMutation.mutate()} loading={verifyMutation.isPending} style={{ marginTop: 16 }} />
          )}
        </Card>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
});
