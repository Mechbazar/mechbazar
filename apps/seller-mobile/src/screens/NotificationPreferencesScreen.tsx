import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Switch } from 'react-native';
import { colors, Typography, Card, Loader, apiClient } from '@mechbazar/shared';
import { Tag, Megaphone, Wrench, CreditCard, Wallet, Hammer, Store, AlarmClock, LucideIcon } from 'lucide-react-native';

// Column names match NotificationPreference in prisma/schema.prisma exactly
// -- keep this list in sync with backend/src/controllers/customer.controller.ts's
// DEFAULT_PREFERENCES. Mirrors apps/mobile/src/screens/NotificationPreferencesScreen.tsx
// (same 8 keys/labels/copy) adapted to this app's own component kit + apiClient.
const CATEGORIES: { key: string; label: string; description: string; Icon: LucideIcon }[] = [
  { key: 'offers', label: 'Offers', description: 'Price drops and deals on items you follow', Icon: Tag },
  { key: 'promotions', label: 'Promotions', description: 'Festival sales and marketing announcements', Icon: Megaphone },
  { key: 'serviceUpdates', label: 'Service Updates', description: 'Chat messages and service milestones', Icon: Wrench },
  { key: 'payments', label: 'Payments', description: 'Non-critical payment notices', Icon: CreditCard },
  { key: 'wallet', label: 'Wallet', description: 'Wallet credits and debits', Icon: Wallet },
  { key: 'mechanicUpdates', label: 'Mechanic Updates', description: 'Updates about your assigned mechanic', Icon: Hammer },
  { key: 'vendorUpdates', label: 'Vendor Updates', description: 'Updates from stores you order from', Icon: Store },
  { key: 'reminders', label: 'Reminders', description: 'Review reminders and follow-ups', Icon: AlarmClock },
];

type Preferences = Record<string, boolean>;

export const NotificationPreferencesScreen = () => {
  const [prefs, setPrefs] = useState<Preferences>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // apiClient (packages/shared/src/api/client.ts) attaches the bearer token
  // from SecureStore via a request interceptor, so there's no need to read
  // it from Redux here the way apps/mobile does.
  useEffect(() => {
    (async () => {
      try {
        const response = await apiClient.get('/customers/notification-preferences');
        setPrefs(response.data || {});
      } catch (e) {
        console.error('Failed to load notification preferences:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggle = async (key: string, value: boolean) => {
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

  if (loading) {
    return <Loader size="large" color={colors.primary} style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Typography variant="caption" style={styles.note}>
        Order status, OTPs, payment confirmations, and account/security alerts always stay on, no matter what you
        turn off below.
      </Typography>
      {CATEGORIES.map(({ key, label, description, Icon }) => (
        <Card key={key} style={styles.row}>
          <Icon color={colors.primary} size={20} />
          <View style={styles.rowText}>
            <Typography variant="body" style={{ fontWeight: '700' }}>{label}</Typography>
            <Typography variant="caption">{description}</Typography>
          </View>
          {savingKey === key ? (
            <Loader size="small" color={colors.primary} />
          ) : (
            <Switch
              value={prefs[key] !== false}
              onValueChange={(v) => toggle(key, v)}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          )}
        </Card>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  note: { marginBottom: 16, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  rowText: { flex: 1, marginLeft: 12, marginRight: 8 },
});
