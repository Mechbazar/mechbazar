import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, Typography, Card, Loader, vendorService } from '@mechbazar/shared';
import { TrendingUp } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';

const RANGE_OPTIONS = [
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
];

export const AnalyticsScreen = () => {
  const [days, setDays] = useState(30);
  const { data, isLoading } = useQuery({
    queryKey: ['vendor-sales-chart', days],
    queryFn: () => vendorService.getSalesChart(days),
  });

  const points = data || [];
  const maxRevenue = Math.max(...points.map((p) => p.revenue), 1);
  const totalRevenue = points.reduce((sum, p) => sum + p.revenue, 0);
  const totalOrders = points.reduce((sum, p) => sum + p.orders, 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.header}>
        <View>
          <Typography variant="h2">Sales Analytics</Typography>
          <Typography variant="caption">₹{totalRevenue.toLocaleString('en-IN')} · {totalOrders} order(s) in the last {days} days</Typography>
        </View>
      </View>

      <View style={styles.rangeRow}>
        {RANGE_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.days}
            onPress={() => setDays(opt.days)}
            style={[styles.rangeBtn, days === opt.days && styles.rangeBtnActive]}
          >
            <Typography variant="caption" style={{ color: days === opt.days ? '#fff' : colors.textSecondary, fontWeight: '700' }}>
              {opt.label}
            </Typography>
          </TouchableOpacity>
        ))}
      </View>

      <Card style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <TrendingUp color={colors.primary} size={18} />
          <Typography variant="body" style={{ fontWeight: '700', marginLeft: 6 }}>Daily Revenue</Typography>
        </View>

        {isLoading ? (
          <Loader size="small" color={colors.primary} style={{ paddingVertical: 40 }} />
        ) : points.length === 0 ? (
          <Typography variant="caption" style={{ textAlign: 'center', paddingVertical: 40 }}>No sales in this period yet</Typography>
        ) : (
          <View style={styles.barsRow}>
            {points.map((p) => (
              <View key={p.date} style={styles.barCol}>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.bar,
                      { height: `${Math.max((p.revenue / maxRevenue) * 100, p.revenue > 0 ? 4 : 0)}%` },
                    ]}
                  />
                </View>
                {points.length <= 14 && (
                  <Typography variant="caption" style={styles.barLabel} numberOfLines={1}>
                    {new Date(p.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </Typography>
                )}
              </View>
            ))}
          </View>
        )}
      </Card>

      {points.length > 0 && (
        <Card style={{ marginTop: 12 }}>
          <Typography variant="body" style={{ fontWeight: '700', marginBottom: 8 }}>Best Day</Typography>
          {(() => {
            const best = points.reduce((a, b) => (b.revenue > a.revenue ? b : a), points[0]);
            return (
              <Typography variant="caption">
                {new Date(best.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })} · ₹{best.revenue.toLocaleString('en-IN')} · {best.orders} order(s)
              </Typography>
            );
          })()}
        </Card>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { marginBottom: 16 },
  rangeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  rangeBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  rangeBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chartCard: { paddingBottom: 12 },
  chartHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  barsRow: { flexDirection: 'row', alignItems: 'flex-end', height: 160, gap: 3 },
  barCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barTrack: { width: '100%', height: 140, justifyContent: 'flex-end' },
  bar: { width: '100%', backgroundColor: colors.primary, borderRadius: 3, minHeight: 2 },
  barLabel: { marginTop: 4, fontSize: 9, transform: [{ rotate: '-45deg' }] },
});
