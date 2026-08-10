import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { RootState } from '../store';
import { API_BASE_URL } from '../services/api';
import { useIsDarkMode } from '../theme/useThemeColors';
import { useTranslation } from 'react-i18next';

// `secondary` (header bar) and `white` (text/icon on that header) are fixed
// -- never invert. `surface` is the actual preference-row card background,
// split out from what used to be `colors.white` doing double duty.
const LIGHT_COLORS = {
  primary: '#E53935',
  secondary: '#1C1C1E',
  white: '#FFFFFF',
  surface: '#FFFFFF',
  pageBg: '#F8F9FA',
  borderLight: '#E8ECEF',
  textDark: '#111112',
  textMuted: '#8E8E93',
};

const DARK_COLORS: typeof LIGHT_COLORS = {
  primary: '#FF5A4E',
  secondary: '#1C1C1E',
  white: '#FFFFFF',
  surface: '#1E1E1E',
  pageBg: '#121212',
  borderLight: '#2E2E2E',
  textDark: '#F1F2F4',
  textMuted: '#A6ACB5',
};

// Column names match NotificationPreference in prisma/schema.prisma exactly
// -- keep this list in sync with backend/src/controllers/customer.controller.ts's
// DEFAULT_PREFERENCES.
const CATEGORIES: { key: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'offers', icon: 'pricetag-outline' },
  { key: 'promotions', icon: 'megaphone-outline' },
  { key: 'serviceUpdates', icon: 'construct-outline' },
  { key: 'payments', icon: 'card-outline' },
  { key: 'wallet', icon: 'wallet-outline' },
  { key: 'mechanicUpdates', icon: 'build-outline' },
  { key: 'vendorUpdates', icon: 'storefront-outline' },
  { key: 'reminders', icon: 'alarm-outline' },
];

type Preferences = Record<string, boolean>;

export default function NotificationPreferencesScreen() {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { token } = useSelector((state: RootState) => state.auth);
  const colors = useIsDarkMode() ? DARK_COLORS : LIGHT_COLORS;
  const styles = useMemo(() => createStyles(colors), [colors]);
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
        <Text style={styles.headerTitle}>{t('notificationPreferences.title')}</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.centerLoader}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent}>
          <Text style={styles.note}>
            {t('notificationPreferences.note')}
          </Text>
          {CATEGORIES.map((cat) => (
            <View key={cat.key} style={styles.row}>
              <View style={styles.rowIcon}>
                <Ionicons name={cat.icon} size={18} color={colors.primary} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>{t(`notificationPreferences.categories.${cat.key}.label`)}</Text>
                <Text style={styles.rowDescription}>{t(`notificationPreferences.categories.${cat.key}.description`)}</Text>
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

const createStyles = (colors: typeof LIGHT_COLORS) => StyleSheet.create({
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
    backgroundColor: colors.surface,
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
