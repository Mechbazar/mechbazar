import React from 'react';
import { View, StyleSheet, ScrollView, Switch, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { colors, Typography, Card, Loader, apiClient } from '@mechbazar/shared';
import { Tag, Megaphone, Wrench, CreditCard, Wallet, HardHat, Store, AlarmClock } from 'lucide-react-native';

// Column names match NotificationPreference in prisma/schema.prisma exactly
// -- keep this list in sync with backend/src/controllers/customer.controller.ts's
// DEFAULT_PREFERENCES. Endpoint lives under /customers regardless of caller's
// actual role, same as the /customers/notifications endpoint above.
const CATEGORIES: { key: string; label: string; description: string; Icon: typeof Tag }[] = [
  { key: 'offers', label: 'Offers', description: 'Price drops and deals on items you follow', Icon: Tag },
  { key: 'promotions', label: 'Promotions', description: 'Festival sales and marketing announcements', Icon: Megaphone },
  { key: 'serviceUpdates', label: 'Service Updates', description: 'Chat messages and service milestones', Icon: Wrench },
  { key: 'payments', label: 'Payments', description: 'Non-critical payment notices', Icon: CreditCard },
  { key: 'wallet', label: 'Wallet', description: 'Wallet credits and debits', Icon: Wallet },
  { key: 'mechanicUpdates', label: 'Mechanic Updates', description: 'Updates about your assigned mechanic', Icon: HardHat },
  { key: 'vendorUpdates', label: 'Vendor Updates', description: 'Updates from stores you order from', Icon: Store },
  { key: 'reminders', label: 'Reminders', description: 'Review reminders and follow-ups', Icon: AlarmClock },
];

type Preferences = Record<string, boolean>;

export const NotificationPreferencesScreen = () => {
  const queryClient = useQueryClient();

  const { data: prefs, isLoading } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: async () => {
      const response = await apiClient.get('/customers/notification-preferences');
      return response.data as Preferences;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (patch: Preferences) => {
      const response = await apiClient.patch('/customers/notification-preferences', patch);
      return response.data as Preferences;
    },
    // Optimistic update with rollback on failure -- the toggle should flip
    // instantly, not wait on the round trip.
    onMutate: async (patch: Preferences) => {
      await queryClient.cancelQueries({ queryKey: ['notification-preferences'] });
      const previous = queryClient.getQueryData<Preferences>(['notification-preferences']);
      queryClient.setQueryData<Preferences>(['notification-preferences'], (old) => ({ ...old, ...patch }));
      return { previous };
    },
    onError: (err: any, _patch, context) => {
      if (context?.previous) queryClient.setQueryData(['notification-preferences'], context.previous);
      Alert.alert('Error', err.response?.data?.error || err.message);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['notification-preferences'] }),
  });

  if (isLoading) {
    return <Loader fullScreen />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Typography variant="caption" style={styles.note}>
        Order status, OTPs, payment confirmations, and account/security alerts always stay on, no matter what you
        turn off below.
      </Typography>
      {CATEGORIES.map(({ key, label, description, Icon }) => (
        <Card key={key} style={styles.row}>
          <View style={styles.rowIcon}>
            <Icon color={colors.primary} size={18} />
          </View>
          <View style={styles.rowText}>
            <Typography variant="body" style={{ fontWeight: '700' }}>{label}</Typography>
            <Typography variant="caption" style={{ marginTop: 2 }}>{description}</Typography>
          </View>
          {updateMutation.isPending && updateMutation.variables && key in updateMutation.variables ? (
            <Loader size="small" color={colors.primary} />
          ) : (
            <Switch
              value={prefs?.[key] !== false}
              onValueChange={(value) => updateMutation.mutate({ [key]: value })}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          )}
        </Card>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  note: { lineHeight: 18, marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.surfaceHover,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowText: { flex: 1, marginRight: 8 },
});
