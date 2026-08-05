import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { colors, Typography, Card, Badge, Button, Input, Loader, technicianService } from '@mechbazar/shared';
import { WalletCards, Building2, Clock } from 'lucide-react-native';
import { Booking, isCompletedBooking, isCompletedToday } from '../utils/bookings';
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

interface AttendanceRow {
  id: string;
  date: string;
  status: string;
  checkInAt: string | null;
  checkOutAt: string | null;
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

  const { data: earnings, isLoading: earningsLoading, isError: earningsError, refetch, isRefetching } = useQuery<Earnings>({
    queryKey: ['technician-earnings'],
    queryFn: technicianService.getMyEarnings,
  });

  const { data: bookings } = useQuery<Booking[]>({
    queryKey: ['technician-bookings'],
    queryFn: technicianService.getMyBookings,
  });

  const { data: attendance, isLoading: attendanceLoading } = useQuery<AttendanceRow[]>({
    queryKey: ['technician-attendance'],
    queryFn: technicianService.getMyAttendance,
  });
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayAttendance = attendance?.find((a) => a.date.slice(0, 10) === todayKey) || null;

  const checkInMutation = useMutation({
    mutationFn: technicianService.checkIn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['technician-attendance'] }),
    onError: (err: any) => Alert.alert('Error', err.response?.data?.error || err.message),
  });
  const checkOutMutation = useMutation({
    mutationFn: technicianService.checkOut,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['technician-attendance'] }),
    onError: (err: any) => Alert.alert('Error', err.response?.data?.error || err.message),
  });

  const [showPayoutForm, setShowPayoutForm] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');

  const [showBankForm, setShowBankForm] = useState(false);
  const [bankForm, setBankForm] = useState({ accountHolderName: '', bankName: '', accountNumber: '', ifscCode: '' });

  const payoutMutation = useMutation({
    mutationFn: (amount: number) => technicianService.requestPayout(amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technician-earnings'] });
      setShowPayoutForm(false);
      setPayoutAmount('');
    },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.error || err.message),
  });

  const bankMutation = useMutation({
    mutationFn: () => technicianService.addBankAccount(bankForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technician-earnings'] });
      setShowBankForm(false);
      setBankForm({ accountHolderName: '', bankName: '', accountNumber: '', ifscCode: '' });
    },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.error || err.message),
  });

  if (earningsLoading && !isRefetching) return <Loader fullScreen />;

  const list = bookings || [];
  const completedTotal = list.filter(isCompletedBooking).length;
  const completedToday = list.filter(isCompletedToday).length;

  // earnings is undefined only when the fetch genuinely hasn't succeeded --
  // don't conflate that with "balance is actually zero" (previously
  // `earnings?.walletBalance || 0` displayed a real-looking ₹0 either way,
  // and disabled the payout button in both cases, which could block a
  // technician with a real balance from requesting a payout during an outage).
  const hasEarnings = earnings !== undefined;
  const walletBalance = earnings?.walletBalance ?? 0;
  const bankAccount = earnings?.bankAccounts?.[0];

  const handleRequestPayout = () => {
    const amt = parseFloat(payoutAmount);
    if (!amt || amt <= 0) {
      Alert.alert('Invalid amount', 'Enter a valid amount to withdraw.');
      return;
    }
    // Only pre-check against a balance we actually know. requestMyPayout on
    // the backend re-validates atomically against the real balance
    // regardless, so skipping this when the balance failed to load doesn't
    // let anyone withdraw more than they actually have -- it just stops a
    // stale/missing local read from blocking a legitimate request.
    if (hasEarnings && amt > walletBalance) {
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
          <Typography variant="h1" style={{ color: '#ffffff', marginTop: 4 }}>{hasEarnings ? formatINR(walletBalance) : '—'}</Typography>
          {earningsError && !hasEarnings && (
            <Typography variant="caption" style={{ color: '#ffffffcc', marginTop: 4, textAlign: 'center' }}>
              Couldn't load your balance right now. You can still request a payout.
            </Typography>
          )}
          {!showPayoutForm && (
            <Button
              title="Request Payout"
              onPress={() => setShowPayoutForm(true)}
              style={{ backgroundColor: '#ffffff', marginTop: 16, alignSelf: 'stretch' }}
              textStyle={{ color: colors.primary }}
              disabled={hasEarnings && walletBalance <= 0}
            />
          )}
        </Card>

        {showPayoutForm && (
          <Card style={{ marginTop: -4 }}>
            <Typography variant="h3">Request Payout</Typography>
            <Input
              label={hasEarnings ? `Amount (Available: ${formatINR(walletBalance)})` : 'Amount'}
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
            <Typography variant="caption" style={{ color: colors.textSecondary, marginTop: 2 }}>{completedToday} bookings</Typography>
          </Card>
          <Card style={styles.statCard}>
            <Typography variant="h2">{formatINR(earnings?.totalEarned || 0)}</Typography>
            <Typography variant="caption" style={{ color: colors.textSecondary }}>Earned all-time</Typography>
            <Typography variant="caption" style={{ color: colors.textSecondary, marginTop: 2 }}>{completedTotal} bookings</Typography>
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

        <Card style={{ marginTop: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Clock color={colors.textSecondary} size={20} />
            <Typography variant="h3">Today's Attendance</Typography>
          </View>

          {attendanceLoading ? (
            <Typography variant="caption" style={{ color: colors.textSecondary, marginTop: 8 }}>Loading…</Typography>
          ) : (
            <View style={{ marginTop: 12 }}>
              <Typography variant="caption" style={{ color: colors.textSecondary }}>
                {todayAttendance?.checkInAt
                  ? `Checked in at ${new Date(todayAttendance.checkInAt).toLocaleTimeString()}${
                      todayAttendance.checkOutAt ? ` • Checked out at ${new Date(todayAttendance.checkOutAt).toLocaleTimeString()}` : ''
                    }`
                  : "You haven't checked in today."}
              </Typography>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <Button
                  title="Check In"
                  onPress={() => checkInMutation.mutate()}
                  loading={checkInMutation.isPending}
                  disabled={!!todayAttendance?.checkInAt}
                  style={{ flex: 1 }}
                />
                <Button
                  title="Check Out"
                  variant="outline"
                  onPress={() => checkOutMutation.mutate()}
                  loading={checkOutMutation.isPending}
                  disabled={!todayAttendance?.checkInAt || !!todayAttendance?.checkOutAt}
                  style={{ flex: 1 }}
                />
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
