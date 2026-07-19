import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { colors, Typography, Card, Badge, Button, Input, Loader, riderService } from '@mechbazar/shared';
import { WalletCards, Building2 } from 'lucide-react-native';
import { Delivery, isCompleted, isDeliveredToday } from '../utils/deliveries';
import { formatINR } from '../utils/currency';

interface BankAccount {
  id: string;
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
}

interface Settlement {
  id: string;
  amount: number;
  status: string;
  transactionId: string | null;
  date: string;
}

interface Earnings {
  walletBalance: number;
  totalEarned: number;
  todayEarned: number;
  bankAccounts: BankAccount[];
  settlements: Settlement[];
}

const settlementBadge = (status: string) => {
  switch (status) {
    case 'COMPLETED':
      return <Badge label="Completed" variant="success" size="sm" />;
    case 'FAILED':
      return <Badge label="Failed" variant="danger" size="sm" />;
    default:
      return <Badge label="Pending" variant="warning" size="sm" />;
  }
};

export const EarningsScreen = () => {
  const queryClient = useQueryClient();

  const { data: earnings, isLoading: earningsLoading, refetch, isRefetching } = useQuery<Earnings>({
    queryKey: ['rider-earnings'],
    queryFn: riderService.getMyEarnings,
  });

  const { data: deliveries } = useQuery<Delivery[]>({
    queryKey: ['rider-deliveries'],
    queryFn: riderService.getMyDeliveries,
  });

  const [showPayoutForm, setShowPayoutForm] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');

  const [showBankForm, setShowBankForm] = useState(false);
  const [bankForm, setBankForm] = useState({ accountHolderName: '', bankName: '', accountNumber: '', ifscCode: '' });

  const payoutMutation = useMutation({
    mutationFn: (amount: number) => riderService.requestPayout(amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rider-earnings'] });
      setShowPayoutForm(false);
      setPayoutAmount('');
    },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.error || err.message),
  });

  const bankMutation = useMutation({
    mutationFn: () => riderService.addBankAccount(bankForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rider-earnings'] });
      setShowBankForm(false);
      setBankForm({ accountHolderName: '', bankName: '', accountNumber: '', ifscCode: '' });
    },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.error || err.message),
  });

  if (earningsLoading && !isRefetching) return <Loader fullScreen />;

  const list = deliveries || [];
  const completedTotal = list.filter(isCompleted).length;
  const completedToday = list.filter(isDeliveredToday).length;

  const walletBalance = earnings?.walletBalance || 0;
  const bankAccount = earnings?.bankAccounts?.[0];

  const handleRequestPayout = () => {
    const amt = parseFloat(payoutAmount);
    if (!amt || amt <= 0) {
      Alert.alert('Invalid amount', 'Enter a valid amount to withdraw.');
      return;
    }
    if (amt > walletBalance) {
      Alert.alert('Insufficient balance', 'Amount exceeds your available balance.');
      return;
    }
    payoutMutation.mutate(amt);
  };

  const handleAddBankAccount = () => {
    const { accountHolderName, bankName, accountNumber, ifscCode } = bankForm;
    if (!accountHolderName.trim() || !bankName.trim() || !accountNumber.trim() || !ifscCode.trim()) {
      Alert.alert('Missing details', 'Fill in all bank account fields.');
      return;
    }
    bankMutation.mutate();
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
    >
      <Typography variant="h2" style={{ padding: 16 }}>Earnings</Typography>

      <View style={{ paddingHorizontal: 16 }}>
        <Card style={styles.walletCard}>
          <WalletCards color="#ffffff" size={26} />
          <Typography variant="caption" style={{ color: '#ffffffcc', marginTop: 8 }}>Available Balance</Typography>
          <Typography variant="h1" style={{ color: '#ffffff', marginTop: 4 }}>{formatINR(walletBalance)}</Typography>
          {!showPayoutForm && (
            <Button
              title="Request Payout"
              onPress={() => setShowPayoutForm(true)}
              style={{ backgroundColor: '#ffffff', marginTop: 16, alignSelf: 'stretch' }}
              textStyle={{ color: colors.primary }}
              disabled={walletBalance <= 0}
            />
          )}
        </Card>

        {showPayoutForm && (
          <Card style={{ marginTop: -4 }}>
            <Typography variant="h3">Request Payout</Typography>
            <Input
              label={`Amount (Available: ${formatINR(walletBalance)})`}
              keyboardType="numeric"
              value={payoutAmount}
              onChangeText={setPayoutAmount}
              placeholder="0.00"
              containerStyle={{ marginTop: 12 }}
            />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
              <Button title="Cancel" variant="outline" onPress={() => setShowPayoutForm(false)} style={{ flex: 1 }} />
              <Button
                title="Withdraw"
                onPress={handleRequestPayout}
                loading={payoutMutation.isPending}
                style={{ flex: 1 }}
              />
            </View>
          </Card>
        )}

        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <Typography variant="h2">{formatINR(earnings?.todayEarned || 0)}</Typography>
            <Typography variant="caption" style={{ color: colors.textSecondary }}>Earned today</Typography>
            <Typography variant="caption" style={{ color: colors.textSecondary, marginTop: 2 }}>{completedToday} deliveries</Typography>
          </Card>
          <Card style={styles.statCard}>
            <Typography variant="h2">{formatINR(earnings?.totalEarned || 0)}</Typography>
            <Typography variant="caption" style={{ color: colors.textSecondary }}>Earned all-time</Typography>
            <Typography variant="caption" style={{ color: colors.textSecondary, marginTop: 2 }}>{completedTotal} deliveries</Typography>
          </Card>
        </View>

        <Card style={{ marginTop: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Building2 color={colors.textSecondary} size={20} />
            <Typography variant="h3">Bank Account</Typography>
          </View>

          {bankAccount && !showBankForm ? (
            <View style={{ marginTop: 12 }}>
              <Typography variant="body" style={{ fontWeight: '600' }}>{bankAccount.bankName}</Typography>
              <Typography variant="caption" style={{ color: colors.textSecondary, marginTop: 2 }}>
                {bankAccount.accountHolderName} • •••• {bankAccount.accountNumber.slice(-4)}
              </Typography>
            </View>
          ) : !showBankForm ? (
            <View style={{ marginTop: 12 }}>
              <Typography variant="caption" style={{ color: colors.textSecondary }}>
                Add a bank account to request payouts.
              </Typography>
              <Button title="Add Bank Account" variant="outline" onPress={() => setShowBankForm(true)} style={{ marginTop: 12 }} />
            </View>
          ) : (
            <View style={{ marginTop: 12, gap: 12 }}>
              <Input
                label="Account Holder Name"
                value={bankForm.accountHolderName}
                onChangeText={(v) => setBankForm({ ...bankForm, accountHolderName: v })}
              />
              <Input
                label="Bank Name"
                value={bankForm.bankName}
                onChangeText={(v) => setBankForm({ ...bankForm, bankName: v })}
              />
              <Input
                label="Account Number"
                keyboardType="numeric"
                value={bankForm.accountNumber}
                onChangeText={(v) => setBankForm({ ...bankForm, accountNumber: v })}
              />
              <Input
                label="IFSC Code"
                autoCapitalize="characters"
                value={bankForm.ifscCode}
                onChangeText={(v) => setBankForm({ ...bankForm, ifscCode: v.toUpperCase() })}
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button title="Cancel" variant="outline" onPress={() => setShowBankForm(false)} style={{ flex: 1 }} />
                <Button title="Save" onPress={handleAddBankAccount} loading={bankMutation.isPending} style={{ flex: 1 }} />
              </View>
            </View>
          )}
        </Card>

        <Card style={{ marginTop: 12, marginBottom: 24 }}>
          <Typography variant="h3">Payout History</Typography>
          {!earnings?.settlements || earnings.settlements.length === 0 ? (
            <Typography variant="caption" style={{ color: colors.textSecondary, marginTop: 8 }}>
              No payout requests yet.
            </Typography>
          ) : (
            earnings.settlements.map((s) => (
              <View key={s.id} style={styles.settlementRow}>
                <View>
                  <Typography variant="body" style={{ fontWeight: '600' }}>{formatINR(s.amount)}</Typography>
                  <Typography variant="caption" style={{ color: colors.textSecondary, marginTop: 2 }}>
                    {new Date(s.date).toLocaleDateString()}
                  </Typography>
                </View>
                {settlementBadge(s.status)}
              </View>
            ))
          )}
        </Card>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  walletCard: { alignItems: 'center', padding: 24, backgroundColor: colors.primary },
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  statCard: { flex: 1, alignItems: 'center' },
  settlementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 8,
  },
});
