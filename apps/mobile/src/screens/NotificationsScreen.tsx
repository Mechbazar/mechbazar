import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TextInput,
  Image,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { RootState } from '../store';
import { API_BASE_URL } from '../services/api';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { setDesktopFullPageScreenActive } from '../navigation/desktopFullPageScreenStore';
import CompactBookingShell from '../components/desktop/shared/CompactBookingShell';
import MinimalFooter from '../components/desktop/shared/MinimalFooter';
import { resolveNotificationRoute } from '../utils/notificationDeepLink';
import { useIsDarkMode } from '../theme/useThemeColors';
import { useTranslation } from 'react-i18next';

// `secondary` (header bar) and `white` (text/icons on that header, and on
// the red active-chip) are fixed -- never invert. `surface` is the actual
// search-bar/card background, which does invert. `unreadTint` is split out
// separately from a literal '#FFFDFD' that used to sit directly in
// cardUnread's style: that background never inverted, but it's stacked under
// cardTitle's dynamic textDark color, which DOES turn near-white in dark
// mode -- unread titles would have gone invisible (near-white on
// still-near-white) without giving this its own dark-mode value.
const LIGHT_COLORS = {
  primary: '#E53935',
  secondary: '#1C1C1E',
  white: '#FFFFFF',
  surface: '#FFFFFF',
  unreadTint: '#FFFDFD',
  pageBg: '#F8F9FA',
  borderLight: '#E8ECEF',
  textDark: '#111112',
  textMuted: '#8E8E93',
  lightGray: '#F2F2F7',
};

const DARK_COLORS: typeof LIGHT_COLORS = {
  primary: '#FF5A4E',
  secondary: '#1C1C1E',
  white: '#FFFFFF',
  surface: '#1E1E1E',
  unreadTint: '#242424',
  pageBg: '#121212',
  borderLight: '#2E2E2E',
  textDark: '#F1F2F4',
  textMuted: '#A6ACB5',
  lightGray: '#1E1E1E',
};

// Subset of the backend's 10 display categories that can actually appear on
// a customer account -- MECHANIC_UPDATES/RIDER_UPDATES/VENDOR_UPDATES never
// notify a customer, so they're left out of this app's filter chips.
const CATEGORIES: { key: string; labelKey: string }[] = [
  { key: 'ALL', labelKey: 'notifications.categories.all' },
  { key: 'ORDERS', labelKey: 'notifications.categories.orders' },
  { key: 'SERVICES', labelKey: 'notifications.categories.services' },
  { key: 'PAYMENTS', labelKey: 'notifications.categories.payments' },
  { key: 'OFFERS', labelKey: 'notifications.categories.offers' },
  { key: 'COUPONS', labelKey: 'notifications.categories.coupons' },
  { key: 'ACCOUNT', labelKey: 'notifications.categories.account' },
  { key: 'SYSTEM', labelKey: 'notifications.categories.system' },
];

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  type?: string | null;
  data?: unknown;
  imageUrl?: string | null;
  actions?: { label: string; deepLink: string }[] | null;
}

// Guards against a stale/bad row whose title or body is the literal string
// "undefined"/"null" rather than a real value -- a plain `item.title || ...`
// fallback only catches an empty/missing field, not this, since the string
// itself is truthy.
const sanitizeNotificationText = (value?: string | null): string | undefined =>
  value && value !== 'undefined' && value !== 'null' ? value : undefined;

export default function NotificationsScreen() {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { token } = useSelector((state: RootState) => state.auth);
  const colors = useIsDarkMode() ? DARK_COLORS : LIGHT_COLORS;
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ALL');
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPage = useCallback(
    async (opts: { reset: boolean; cursor?: string | null; q?: string; cat?: string }) => {
      if (!token) return;
      const { reset, cursor, q = search, cat = category } = opts;
      reset ? setLoading(true) : setLoadingMore(true);
      try {
        const params = new URLSearchParams({ limit: '20' });
        if (cursor) params.set('cursor', cursor);
        if (q.trim()) params.set('q', q.trim());
        if (cat !== 'ALL') params.set('category', cat);
        const res = await fetch(`${API_BASE_URL}/customers/notifications?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const json = await res.json();
          setNotifications((prev) => (reset ? json.items : [...prev, ...json.items]));
          setNextCursor(json.nextCursor);
        }
      } catch (e) {
        console.error('Failed to load notifications:', e);
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [token, search, category]
  );

  useEffect(() => {
    fetchPage({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, category]);

  const onSearchChange = (text: string) => {
    setSearch(text);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      fetchPage({ reset: true, q: text });
    }, 400);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchPage({ reset: true });
  };

  const onEndReached = () => {
    if (!loadingMore && !loading && nextCursor) {
      fetchPage({ reset: false, cursor: nextCursor });
    }
  };

  const { isDesktopUp } = useBreakpoint();
  useFocusEffect(
    useCallback(() => {
      if (!isDesktopUp) return;
      setDesktopFullPageScreenActive(true);
      return () => setDesktopFullPageScreenActive(false);
    }, [isDesktopUp]),
  );

  const handleMarkAsRead = async (id: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/customers/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkAllRead = async () => {
    if (!token) return;
    const previous = notifications;
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      const res = await fetch(`${API_BASE_URL}/customers/notifications/read-all`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) setNotifications(previous);
    } catch (e) {
      console.error(e);
      setNotifications(previous);
    }
  };

  const handleDelete = async (id: string) => {
    if (!token) return;
    const previous = notifications;
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try {
      const res = await fetch(`${API_BASE_URL}/customers/notifications/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) setNotifications(previous);
    } catch (e) {
      console.error('Failed to delete notification:', e);
      setNotifications(previous);
    }
  };

  const handleOpen = (item: NotificationItem) => {
    if (!item.isRead) handleMarkAsRead(item.id);
    if (token) {
      fetch(`${API_BASE_URL}/customers/notifications/${item.id}/opened`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    const target = resolveNotificationRoute(item);
    if (target) navigation.navigate(target.screen, target.params);
  };

  const handleActionPress = (deepLink: string) => {
    if (/^(https?:|tel:|mailto:)/i.test(deepLink)) {
      Linking.openURL(deepLink).catch(() => {});
    }
  };

  const renderItem = ({ item }: { item: NotificationItem }) => (
    <TouchableOpacity activeOpacity={0.85} onPress={() => handleOpen(item)} style={[styles.card, !item.isRead && styles.cardUnread]}>
      <View style={styles.cardHeader}>
        <View style={styles.headerLabelRow}>
          {!item.isRead && <View style={styles.unreadDot} />}
          <Text style={[styles.cardTitle, !item.isRead && styles.textBold]}>
            {sanitizeNotificationText(item.title) || t('notifications.notificationFallback')}
          </Text>
        </View>
        <TouchableOpacity onPress={() => handleDelete(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={16} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <Text style={styles.cardBody}>{sanitizeNotificationText(item.body)}</Text>

      {!!item.imageUrl && <Image source={{ uri: item.imageUrl }} style={styles.cardImage} resizeMode="cover" />}

      {!!item.actions?.length && (
        <View style={styles.actionsRow}>
          {item.actions.map((action, idx) => (
            <TouchableOpacity key={idx} style={styles.actionChip} onPress={() => handleActionPress(action.deepLink)}>
              <Text style={styles.actionChipText}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.cardFooter}>
        <Text style={styles.cardTime}>{new Date(item.createdAt).toLocaleDateString()}</Text>
        {!item.isRead && (
          <TouchableOpacity onPress={() => handleMarkAsRead(item.id)}>
            <Text style={styles.markReadText}>{t('notifications.markAsRead')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('notifications.title')}</Text>
        <TouchableOpacity onPress={handleMarkAllRead} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.markAllText}>{t('notifications.markAllRead')}</Text>
        </TouchableOpacity>
      </View>

      <CompactBookingShell maxWidth={880} style={styles.flexFill}>
        <View style={styles.searchRow}>
          <Ionicons name="search" size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            value={search}
            onChangeText={onSearchChange}
            placeholder={t('notifications.searchNotifications')}
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
          />
        </View>

        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={CATEGORIES}
          keyExtractor={(c) => c.key}
          style={styles.chipsRow}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          renderItem={({ item: c }) => (
            <TouchableOpacity
              onPress={() => setCategory(c.key)}
              style={[styles.chip, category === c.key && styles.chipActive]}
            >
              <Text style={[styles.chipText, category === c.key && styles.chipTextActive]}>{t(c.labelKey)}</Text>
            </TouchableOpacity>
          )}
        />

        {loading && (
          <View style={styles.centerLoader}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        )}

        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={onRefresh}
          onEndReachedThreshold={0.4}
          onEndReached={onEndReached}
          ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 12 }} /> : null}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyState}>
                <Ionicons name="notifications-off-outline" size={48} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>{t('notifications.allCaughtUp')}</Text>
                <Text style={styles.emptySubtitle}>{t('notifications.noNotificationsAtMoment')}</Text>
              </View>
            ) : null
          }
        />
      </CompactBookingShell>
      <CompactBookingShell maxWidth={880}>
        <MinimalFooter />
      </CompactBookingShell>
    </SafeAreaView>
  );
}

const createStyles = (colors: typeof LIGHT_COLORS) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.pageBg },
  flexFill: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: colors.secondary,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: colors.white },
  markAllText: { fontSize: 12, fontWeight: '700', color: colors.white },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: { flex: 1, fontSize: 13, color: colors.textDark },
  chipsRow: { marginTop: 12, marginBottom: 4, flexGrow: 0 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: colors.lightGray,
    marginRight: 8,
  },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  chipTextActive: { color: colors.white },
  centerLoader: { padding: 16 },
  listContent: { padding: 16 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 16,
    marginBottom: 12,
  },
  cardUnread: {
    borderColor: colors.primary,
    backgroundColor: colors.unreadTint,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  headerLabelRow: { flexDirection: 'row', alignItems: 'center' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginRight: 8 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: colors.textDark },
  textBold: { fontWeight: '800' },
  cardBody: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },
  cardImage: { width: '100%', height: 140, borderRadius: 12, marginTop: 10 },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, gap: 8 },
  actionChip: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  actionChipText: { fontSize: 11, fontWeight: '700', color: colors.primary },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 0.5, borderTopColor: colors.borderLight, paddingTop: 10, marginTop: 10 },
  cardTime: { fontSize: 10, color: colors.textMuted },
  markReadText: { fontSize: 11, fontWeight: 'bold', color: colors.primary },
  emptyState: { alignItems: 'center', paddingVertical: 80, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 16, fontWeight: 'bold', color: colors.textDark, marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 12, color: colors.textMuted, textAlign: 'center', lineHeight: 18 },
});
