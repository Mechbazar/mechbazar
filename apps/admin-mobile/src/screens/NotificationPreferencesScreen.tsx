import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Switch, ActivityIndicator } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { colors, Typography, Card, Loader, apiClient } from '@mechbazar/shared';
import { Tag, Megaphone, Wrench, CreditCard, Wallet, Hammer, Store, AlarmClock } from 'lucide-react-native';

// Column names match NotificationPreference in prisma/schema.prisma exactly
// -- keep this list in sync with backend/src/controllers/customer.controller.ts's
// DEFAULT_PREFERENCES. Mirrors apps/mobile's NotificationPreferencesScreen.tsx
// (same 8 categories/labels/descriptions/copy) but wired through this app's
// own apiClient/react-query stack instead of raw fetch + Redux token.
const CATEGORIES = [
  { key: 'offers', label: 'Offers', description: 'Price drops and deals on items you follow', icon: Tag },
  { key: 'promotions', label: 'Promotions', description: 'Festival sales and marketing announcements', icon: Megaphone },
  { key: 'serviceUpdates', label: 'Service Updates', description: 'Chat messages and service milestones', icon: Wrench },
  { key: 'payments', label: 'Payments', description: 'Non-critical payment notices', icon: CreditCard },
  { key: 'wallet', label: 'Wallet', description: 'Wallet credits and debits', icon: Wallet },
  { key: 'mechanicUpdates', label: 'Mechanic Updates', description: 'Updates about your assigned mechanic', icon: Hammer },
  { key: 'vendorUpdates', label: 'Vendor Updates', description: 'Updates from stores you order from', icon: Store },
  { key: 'reminders', label: 'Reminders', description: 'Review reminders and follow-ups', icon: AlarmClock },
] as const;

type Preferences = Record<string, boolean>;

const getNotificationPreferences = async (): Promise<Preferences> => {
  const response = await apiClient.get('/customers/notification-preferences');
  return response.data;
};

const patchNotificationPreferences = async (patch: Partial<Preferences>): Promise<Preferences> => {
  const response = await apiClient.patch('/customers/notification-preferences', patch);
  return response.data;
};

const queryKey = ['notification-preferences'];

export const NotificationPreferencesScreen = () => {
  const queryClient = useQueryClient();
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const { data, isLoading } = useQuery({ queryKey, queryFn: getNotificationPreferences });
  const prefs = data || {};

  const toggleMutation = useMutation({
    mutationFn: (patch: Partial<Preferences>) => patchNotificationPreferences(patch),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Preferences>(queryKey);
      queryClient.setQueryData<Preferences>(queryKey, (old) => ({ ...(old || {}), ...patch } as Preferences));
      return { previous };
    },
    onError: (_err, _patch, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
  });

  const toggle = (key: string, value: boolean) => {
    setSavingKey(key);
    toggleMutation.mutate({ [key]: value }, { onSettled: () => setSavingKey(null) });
  };

  if (isLoading) return <Loader fullScreen />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Typography variant="h2" style={{ marginBottom: 4 }}>Notification Preferences</Typography>
      <Typography variant="caption" style={{ marginBottom: 16, lineHeight: 18 }}>
        Order status, OTPs, payment confirmations, and account/security alerts always stay on, no matter what you
        turn off below.
      </Typography>

      {CATEGORIES.map((cat) => (
        <Card key={cat.key} style={styles.row}>
          <View style={styles.rowIcon}>
            <cat.icon color={colors.primary} size={18} />
          </View>
          <View style={styles.rowText}>
            <Typography variant="body" style={{ fontWeight: '700' }}>{cat.label}</Typography>
            <Typography variant="caption" style={{ marginTop: 2 }}>{cat.description}</Typography>
          </View>
          {savingKey === cat.key ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Switch
              value={prefs[cat.key] !== false}
              onValueChange={(v) => toggle(cat.key, v)}
              trackColor={{ false: colors.border, true: colors.success }}
            />
          )}
        </Card>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.surfaceHover,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowText: { flex: 1, marginRight: 8 },
});
