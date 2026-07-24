import React, { useMemo } from 'react';
import { View, StyleSheet, SectionList, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { colors, Typography, Card, Loader, riderService } from '@mechbazar/shared';
import { CheckCircle2, XCircle } from 'lucide-react-native';
import { Delivery, isCompleted } from '../utils/deliveries';
import { formatINR } from '../utils/currency';

const dateKey = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

export const DeliveryHistoryScreen = () => {
  const navigation = useNavigation<any>();

  const { data, isLoading } = useQuery<Delivery[]>({
    queryKey: ['rider-deliveries'],
    queryFn: riderService.getMyDeliveries,
  });

  const completed = useMemo(
    () => (data || []).filter(isCompleted).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [data]
  );

  const sections = useMemo(() => {
    const byDate = new Map<string, Delivery[]>();
    for (const d of completed) {
      const key = dateKey(d.updatedAt);
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key)!.push(d);
    }
    return [...byDate.entries()].map(([title, data]) => ({ title, data }));
  }, [completed]);

  const deliveredCount = completed.filter((d) => d.status === 'DELIVERED').length;
  const returnedCount = completed.filter((d) => d.status === 'RETURNED').length;
  const totalCod = completed
    .filter((d) => d.status === 'DELIVERED' && d.payment?.method === 'COD')
    .reduce((sum, d) => sum + (d.payment?.amount || 0), 0);

  if (isLoading) return <Loader fullScreen />;

  return (
    <SectionList
      style={styles.container}
      sections={sections}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: 16 }}
      ListHeaderComponent={
        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <Typography variant="h2">{deliveredCount}</Typography>
            <Typography variant="caption">Delivered</Typography>
          </Card>
          <Card style={styles.statCard}>
            <Typography variant="h2">{returnedCount}</Typography>
            <Typography variant="caption">Returned</Typography>
          </Card>
          <Card style={styles.statCard}>
            <Typography variant="h2">{formatINR(totalCod)}</Typography>
            <Typography variant="caption">COD Collected</Typography>
          </Card>
        </View>
      }
      ListEmptyComponent={
        <Typography variant="body" style={{ textAlign: 'center', marginTop: 40, color: colors.textSecondary }}>
          No completed deliveries yet.
        </Typography>
      }
      renderSectionHeader={({ section: { title } }) => (
        <Typography variant="caption" style={styles.sectionHeader}>{title}</Typography>
      )}
      renderItem={({ item }) => (
        <TouchableOpacity onPress={() => navigation.navigate('DeliveryDetail', { orderId: item.id })}>
          <Card style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {item.status === 'DELIVERED' ? (
                <CheckCircle2 color={colors.success} size={18} />
              ) : (
                <XCircle color={colors.danger} size={18} />
              )}
              <Typography variant="body" style={{ fontWeight: '700', flex: 1 }}>Order #{item.id.slice(-6).toUpperCase()}</Typography>
              {item.payment?.method === 'COD' && item.status === 'DELIVERED' && (
                <Typography variant="caption" style={{ color: colors.success, fontWeight: '700' }}>{formatINR(item.payment.amount)}</Typography>
              )}
            </View>
            <Typography variant="caption" style={{ color: colors.textSecondary, marginTop: 4 }}>
              {item.address.line1}, {item.address.city}
            </Typography>
            {item.status === 'RETURNED' && item.issueReason && (
              <Typography variant="caption" style={{ color: colors.danger, marginTop: 4 }}>{item.issueReason}</Typography>
            )}
          </Card>
        </TouchableOpacity>
      )}
    />
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  sectionHeader: { color: colors.textSecondary, fontWeight: '700', marginTop: 12, marginBottom: 6 },
  card: { marginBottom: 10 },
});
