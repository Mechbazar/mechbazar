import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { ServiceBooking, BookingStatus } from '../../types/service';
import { fetchMyBookings } from '../../services/service.service';
import { HeaderCartButton } from '../../components/HeaderCartButton';
import { useIsDarkMode } from '../../theme/useThemeColors';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { setDesktopFullPageScreenActive } from '../../navigation/desktopFullPageScreenStore';
import CompactBookingShell from '../../components/desktop/shared/CompactBookingShell';
import MinimalFooter from '../../components/desktop/shared/MinimalFooter';
import { useTranslation } from 'react-i18next';

// File-local copy of screens/services/theme.ts's shared `colors` export --
// theme.ts itself stays untouched (it's a static, light-only palette
// consumed by several other screens/components that haven't been converted
// yet). `white` stays pure white in both themes -- text/icons on the
// permanently-dark header bar and on colored buttons, never a card
// background here. `surface` is the actual booking-card background, the
// one that inverts.
const LIGHT_COLORS = {
  primary: '#DA3830',
  darkInk: '#1B1B1B',
  pageBg: '#F8F9FA',
  white: '#FFFFFF',
  borderLight: '#E3E6EA',
  textDark: '#1B1B1B',
  textMuted: '#6B7480',
  success: '#1E9E5A',
  warning: '#F5A300',
  danger: '#D32F2F',
  surface: '#FFFFFF',
};

const DARK_COLORS: typeof LIGHT_COLORS = {
  primary: '#FF5A4E',
  darkInk: '#F1F2F4',
  pageBg: '#121212',
  white: '#FFFFFF',
  borderLight: '#2E2E2E',
  textDark: '#F1F2F4',
  textMuted: '#A6ACB5',
  success: '#4FE092',
  warning: '#F5B94D',
  danger: '#FF6B6B',
  surface: '#1E1E1E',
};

// These status badges use fixed pale pastel backgrounds (bg) that are NOT
// theme-derived and deliberately never invert (a status pill floating over
// the card, not a general surface). Their border/text are therefore pinned
// to the LIGHT_COLORS values too -- if they used the dynamic `colors`
// object instead, dark mode would swap in the brighter dark-mode
// success/danger/warning shades (tuned for dark backgrounds) on top of this
// still-pale bg, which is illegible (light-on-light).
const STATUS_COLORS: Partial<Record<BookingStatus, { bg: string; border: string; text: string }>> = {
  COMPLETED: { bg: '#F0FDF4', border: LIGHT_COLORS.success, text: LIGHT_COLORS.success },
  CANCELLED: { bg: '#FEF2F2', border: LIGHT_COLORS.danger, text: LIGHT_COLORS.danger },
  REJECTED: { bg: '#FEF2F2', border: LIGHT_COLORS.danger, text: LIGHT_COLORS.danger },
  MECHANIC_ASSIGNED: { bg: '#FFF8E1', border: LIGHT_COLORS.warning, text: LIGHT_COLORS.warning },
  MECHANIC_ACCEPTED: { bg: '#FFF8E1', border: LIGHT_COLORS.warning, text: LIGHT_COLORS.warning },
};

export default function ServiceBookingHistoryScreen() {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { token } = useSelector((state: RootState) => state.auth);
  const colors = useIsDarkMode() ? DARK_COLORS : LIGHT_COLORS;
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [bookings, setBookings] = useState<ServiceBooking[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    const data = await fetchMyBookings(token);
    setBookings(data);
    setLoading(false);
  }, [token]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const { isDesktopUp } = useBreakpoint();
  useFocusEffect(
    useCallback(() => {
      if (!isDesktopUp) return;
      setDesktopFullPageScreenActive(true);
      return () => setDesktopFullPageScreenActive(false);
    }, [isDesktopUp]),
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Text style={styles.backIcon}>←</Text>
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={styles.headerTitle}>{t('serviceBookingHistory.myBookings')}</Text>
        <Text style={styles.headerSubtitle}>{t('serviceBookingHistory.serviceHistoryAndActiveJobs')}</Text>
      </View>
      <HeaderCartButton color="#FFFFFF" backgroundColor="rgba(255,255,255,0.15)" />
    </View>
  );

  const rebook = (b: ServiceBooking) => {
    navigation.navigate('ServiceBooking', { packageId: b.packageId, categoryId: b.categoryId });
  };

  const renderBooking = ({ item }: { item: ServiceBooking }) => {
    const badge = STATUS_COLORS[item.status] || { bg: colors.pageBg, border: colors.borderLight, text: colors.textMuted };
    return (
      <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('ServiceTracking', { bookingId: item.id })}>
        <View style={styles.cardHeader}>
          <Text style={styles.bookingId}>#{item.bookingNumber}</Text>
          <View style={[styles.badge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
            <Text style={[styles.badgeText, { color: badge.text }]}>{item.status.replace(/_/g, ' ')}</Text>
          </View>
        </View>
        <Text style={styles.serviceName}>{item.package?.name || t('serviceBooking.service')}</Text>
        <Text style={styles.meta}>{item.vehicleBrand} {item.vehicleModel} · {new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>

        <View style={styles.cardFooter}>
          <Text style={styles.amount}>₹{item.finalAmount}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {item.status === 'COMPLETED' && (
              <TouchableOpacity style={styles.actionBtnOutline} onPress={() => rebook(item)}>
                <Text style={styles.actionBtnOutlineText}>{t('serviceBookingHistory.rebook')}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('ServiceTracking', { bookingId: item.id })}>
              <Text style={styles.actionBtnText}>{item.status === 'COMPLETED' ? t('serviceBookingHistory.view') : t('serviceBookingHistory.track')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {renderHeader()}
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {renderHeader()}
      <CompactBookingShell maxWidth={880} style={styles.flexFill}>
      {bookings.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🛠️</Text>
          <Text style={styles.emptyTitle}>{t('orderHistory.noServiceBookingsYet')}</Text>
          <Text style={styles.emptySubtitle}>{t('serviceBookingHistory.bookDoorstepServiceShowUp')}</Text>
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          renderItem={renderBooking}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
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
  // Permanently-dark branded header bar -- pinned fixed (see ServiceCategoryScreen).
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: LIGHT_COLORS.darkInk },
  backButton: { marginRight: 16, padding: 4 },
  backIcon: { fontSize: 24, color: colors.white, fontWeight: 'bold' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.white },
  headerSubtitle: { fontSize: 13, color: '#9AA5B1', marginTop: 2 },

  listContent: { padding: 14 },
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: colors.borderLight },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  bookingId: { fontSize: 14, fontWeight: '900', color: colors.textDark },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  badgeText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.3, textTransform: 'uppercase' },
  serviceName: { fontSize: 15, fontWeight: '700', color: colors.textDark, marginBottom: 4 },
  meta: { fontSize: 12, color: colors.textMuted, marginBottom: 12 },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  amount: { fontSize: 16, fontWeight: '900', color: colors.textDark },
  actionBtn: { backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  actionBtnText: { color: colors.white, fontSize: 12, fontWeight: 'bold' },
  actionBtnOutline: { borderWidth: 1.5, borderColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  actionBtnOutlineText: { color: colors.primary, fontSize: 12, fontWeight: 'bold' },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: colors.textDark, marginBottom: 8 },
  emptySubtitle: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
});
