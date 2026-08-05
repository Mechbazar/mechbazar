import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Switch, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { colors, Typography, Card, Loader, apiClient } from '@mechbazar/shared';
import { Tag, Megaphone, Wrench, CreditCard, Wallet, HardHat, Store, AlarmClock } from 'lucide-react-native';

// lucide-react-native doesn't export its `LucideIcon` component type from the
// package root, so this is the narrowest shape our icon usage below needs.
type IconComponent = React.ComponentType<{ color?: string; size?: number }>;

// Keys match NotificationPreference in backend/prisma/schema.prisma exactly --
// keep this list in sync with backend/src/controllers/customer.controller.ts's
// DEFAULT_PREFERENCES. Endpoint lives under /customers regardless of the
// caller's actual role, same as the existing /customers/notifications call.
type PreferenceKey =
  | 'offers'
  | 'promotions'
  | 'serviceUpdates'
  | 'payments'
  | 'wallet'
  | 'mechanicUpdates'
  | 'vendorUpdates'
  | 'reminders';

type Preferences = Partial<Record<PreferenceKey, boolean>>;

const CATEGORIES: { key: PreferenceKey; label: string; description: string; icon: IconComponent }[] = [
  { key: 'offers', label: 'Offers', description: 'Price drops and deals on items you follow', icon: Tag },
  { key: 'promotions', label: 'Promotions', description: 'Festival sales and marketing announcements', icon: Megaphone },
  { key: 'serviceUpdates', label: 'Service Updates', description: 'Chat messages and service milestones', icon: Wrench },
  { key: 'payments', label: 'Payments', description: 'Non-critical payment notices', icon: CreditCard },
  { key: 'wallet', label: 'Wallet', description: 'Wallet credits and debits', icon: Wallet },
  { key: 'mechanicUpdates', label: 'Mechanic Updates', description: 'Updates about your assigned mechanic', icon: HardHat },
  { key: 'vendorUpdates', label: 'Vendor Updates', description: 'Updates from stores you order from', icon: Store },
  { key: 'reminders', label: 'Reminders', description: 'Review reminders and follow-ups', icon: AlarmClock },
];

export const NotificationPreferencesScreen = () => {
  const { data, isLoading } = useQuery<Preferences>({
    queryKey: ['notification-preferences'],
    queryFn: async () => (await apiClient.get('/customers/notification-preferences')).data,
  });

  const [prefs, setPrefs] = useState<Preferences>({});
  const [savingKey, setSavingKey] = useState<PreferenceKey | null>(null);

  useEffect(() => {
    if (data) setPrefs(data);
  }, [data]);

  const toggle = async (key: PreferenceKey, value: boolean) => {
    const previous = prefs[key];
    setPrefs((p) => ({ ...p, [key]: value }));
    setSavingKey(key);
    try {
      await apiClient.patch('/customers/notification-preferences', { [key]: value });
    } catch (e) {
      console.error('Failed to update notification preference:', e);
      setPrefs((p) => ({ ...p, [key]: previous }));
    } finally {
      setSavingKey(null);
    }
  };

  if (isLoading) return <Loader fullScreen />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Typography variant="caption" style={styles.note}>
        Order status, OTPs, payment confirmations, and account/security alerts always stay on, no matter what you
        turn off below.
      </Typography>

      {CATEGORIES.map((cat) => {
        const Icon = cat.icon;
        return (
          <Card key={cat.key} style={styles.row}>
            <View style={styles.rowIcon}>
              <Icon color={colors.primary} size={18} />
            </View>
            <View style={styles.rowText}>
              <Typography variant="body" style={{ fontWeight: '700' }}>{cat.label}</Typography>
              <Typography variant="caption" style={{ color: colors.textSecondary, marginTop: 2 }}>
                {cat.description}
              </Typography>
            </View>
            {savingKey === cat.key ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Switch
                value={prefs[cat.key] !== false}
                onValueChange={(v) => toggle(cat.key, v)}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            )}
          </Card>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  note: { color: colors.textSecondary, lineHeight: 18, marginBottom: 12 },
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
