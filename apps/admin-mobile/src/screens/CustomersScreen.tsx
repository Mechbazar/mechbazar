import React, { useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { colors, Typography, Card, Input, Badge, Loader, adminService } from '@mechbazar/shared';

const TABS = ['ALL', 'RETAIL', 'WHOLESALE'] as const;

// Mirrors apps/admin/src/pages/Customers.tsx. "View Details" is disabled/
// dead on the web page (a bug); here it actually navigates to a real detail
// screen, per the "make functional" decision in the plan.
export const CustomersScreen = () => {
  const navigation = useNavigation<any>();
  const [tab, setTab] = useState<(typeof TABS)[number]>('ALL');
  const [search, setSearch] = useState('');

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['admin-customers'],
    queryFn: adminService.getCustomers,
  });

  const customers = data || [];

  const filtered = useMemo(() => {
    return customers.filter((c: any) => {
      if (tab !== 'ALL' && c.accountType !== tab) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!c.name?.toLowerCase().includes(q) && !c.phone?.toLowerCase().includes(q) && !c.companyName?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [customers, tab, search]);

  if (isLoading && !isRefetching) return <Loader fullScreen />;

  return (
    <View style={styles.container}>
      <Typography variant="h2" style={{ padding: 16, paddingBottom: 8 }}>Customers</Typography>

      <View style={{ paddingHorizontal: 16 }}>
        <Input placeholder="Search name, phone, company..." value={search} onChangeText={setSearch} />
      </View>

      <View style={styles.tabRow}>
        {TABS.map((t) => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Typography variant="caption" style={{ color: tab === t ? '#fff' : colors.textSecondary, fontWeight: '600' }}>{t}</Typography>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<Typography variant="body" style={{ textAlign: 'center', marginTop: 20, color: colors.textSecondary }}>No customers found.</Typography>}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => navigation.navigate('CustomerDetail', { customerId: item.id })}>
            <Card style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Typography variant="h3">{item.name}</Typography>
                  <Typography variant="caption">{item.phone}</Typography>
                  {item.accountType === 'WHOLESALE' && (
                    <Typography variant="caption" style={{ marginTop: 2 }}>{item.companyName} • GST: {item.gstNumber || 'N/A'}</Typography>
                  )}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Badge label={item.accountType} variant={item.accountType === 'WHOLESALE' ? 'secondary' : 'primary'} size="sm" />
                  <Typography variant="caption" style={{ marginTop: 4 }}>{item._count?.orders ?? 0} orders</Typography>
                </View>
              </View>
              {item.accountType === 'WHOLESALE' && (
                <Badge
                  label={item.isBusinessVerified ? 'Verified' : 'Verification Pending'}
                  variant={item.isBusinessVerified ? 'success' : 'warning'}
                  size="sm"
                  style={{ marginTop: 8, alignSelf: 'flex-start' }}
                />
              )}
            </Card>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  tabRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginTop: 12, marginBottom: 4 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', backgroundColor: colors.surfaceHover },
  tabActive: { backgroundColor: colors.primary },
  card: { marginBottom: 12 },
});
