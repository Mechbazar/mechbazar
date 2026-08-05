import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { RootState } from '../store';
import { API_BASE_URL } from '../services/api';

const colors = {
  primary: '#E53935',
  secondary: '#1C1C1E',
  white: '#FFFFFF',
  pageBg: '#F8F9FA',
  borderLight: '#E8ECEF',
  textDark: '#111112',
  textMuted: '#8E8E93',
};

// Column names match NotificationPreference in prisma/schema.prisma exactly
// -- keep this list in sync with backend/src/controllers/customer.controller.ts's
// DEFAULT_PREFERENCES.
const CATEGORIES: { key: string; label: string; description: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'offers', label: 'Offers', description: 'Price drops and deals on items you follow', icon: 'pricetag-outline' },
  { key: 'promotions', label: 'Promotions', description: 'Festival sales and marketing announcements', icon: 'megaphone-outline' },
  { key: 'serviceUpdates', label: 'Service Updates', description: 'Chat messages and service milestones', icon: 'construct-outline' },
  { key: 'payments', label: 'Payments', description: 'Non-critical payment notices', icon: 'card-outline' },
  { key: 'wallet', label: 'Wallet', description: 'Wallet credits and debits', icon: 'wallet-outline' },
  { key: 'mechanicUpdates', label: 'Mechanic Updates', description: 'Updates about your assigned mechanic', icon: 'build-outline' },
  { key: 'vendorUpdates', label: 'Vendor Updates', description: 'Updates from stores you order from', icon: 'storefront-outline' },
  { key: 'reminders', label: 'Reminders', description: 'Review reminders and follow-ups', icon: 'alarm-outline' },
];

type Preferences = Record<string, boolean>;

export default function NotificationPreferencesScreen() {
  const navigation = useNavigation<any>();
  const { token } = useSelector((state: RootState) => state.auth);
  const [prefs, setPrefs] = useState<Preferences>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/customers/notification-preferences`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) setPrefs(await res.json());
      } catch (e) {
        console.error('Failed to load notification preferences:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const toggle = async (key: string, value: boolean) => {
    const previous = prefs[key];
    setPrefs((p) => ({ ...p, [key]: value }));
    setSavingKey(key);
    try {
      const res = await fetch(`${API_BASE_URL}/customers/notification-preferences`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ [key]: value }),
      });
      if (!res.ok) throw new Error('Request failed');
    } catch (e) {
      console.error('Failed to update notification preference:', e);
      setPrefs((p) => ({ ...p, [key]: previous }));
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notification Preferences</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.centerLoader}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent}>
          <Text style={styles.note}>
            Order status, OTPs, payment confirmations, and account/security alerts always stay on, no matter what
            you turn off below.
          </Text>
          {CATEGORIES.map((cat) => (
            <View key={cat.key} style={styles.row}>
              <View style={styles.rowIcon}>
                <Ionicons name={cat.icon} size={18} color={colors.primary} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>{cat.label}</Text>
                <Text style={styles.rowDescription}>{cat.description}</Text>
              </View>
              {savingKey === cat.key ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Switch
                  value={prefs[cat.key] !== false}
                  onValueChange={(v) => toggle(cat.key, v)}
                  trackColor={{ false: '#767577', true: colors.primary }}
                  thumbColor="#FFFFFF"
                />
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.pageBg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: colors.secondary,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: colors.white },
  centerLoader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: 16 },
  note: { fontSize: 12, color: colors.textMuted, lineHeight: 18, marginBottom: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 14,
    marginBottom: 10,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#FDECEA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowText: { flex: 1, marginRight: 8 },
  rowLabel: { fontSize: 14, fontWeight: '700', color: colors.textDark },
  rowDescription: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
});
