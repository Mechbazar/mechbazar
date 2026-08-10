import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, Pressable, ScrollView, Image, ActivityIndicator, StyleSheet, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect, NavigationProp } from '@react-navigation/native';
import { Linking } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { logout } from '../store/authSlice';
import { setThemePreference } from '../store/themeSlice';
import { API_BASE_URL } from '../services/api';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { setDesktopFullPageScreenActive } from '../navigation/desktopFullPageScreenStore';
import Container from '../components/desktop/shared/Container';
import MinimalFooter from '../components/desktop/shared/MinimalFooter';
// This screen already sat on the shared desktop-component token file, which
// (unlike most screens' local hardcoded palette) already ships a matching
// `darkColors` counterpart and a `useIsDarkMode()` hook -- reused here
// instead of duplicating a second local light/dark palette.
import { colors as LIGHT_COLORS, darkColors as DARK_COLORS, spacing, radius, shadows } from '../theme/tokens';
import { useIsDarkMode } from '../theme/useThemeColors';
import { useTranslation } from 'react-i18next';
import { buildSupportWhatsAppUrl } from '../config/support';

// Replaces the old desktop header account dropdown (AccountMenu.tsx, removed)
// -- clicking the avatar/name in DesktopHeader now navigates here instead of
// opening a flyout. Reachable only from the desktop header today, but the
// layout is responsive down to phone width (single-column, pill nav) rather
// than assuming a >=1024 viewport, since a user can resize/rotate after
// landing here. Every destination below is a real existing screen/route --
// where the requested item has no dedicated screen or backend endpoint
// (Wallet management, Payment Methods, Notification Settings, Login Devices,
// Privacy Settings), it's shown as a disabled
// "Coming soon" row instead of a fake handler, matching this codebase's
// existing policy against fabricated UI (see AccountScreen for the pattern
// this deliberately avoids repeating).
//
// Change Password was listed among those dead rows, which was wrong on both
// counts: PATCH /auth/change-password exists, and the Profile tab
// (AccountScreen) already has a working modal wired to it. It now routes
// there, the same way Order Tracking points at My Orders.
type Row = {
  label: string;
  caption?: string;
  onPress?: () => void;
  disabled?: boolean;
  danger?: boolean;
};

type SectionKey =
  | 'profile' | 'orders' | 'services' | 'vehicles' | 'addresses'
  | 'payments' | 'shopping' | 'support' | 'notifications' | 'preferences' | 'security' | 'account';

const SECTION_META: { key: SectionKey; labelKey: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'profile', labelKey: 'accountDashboard.sections.profile', icon: 'person-outline' },
  { key: 'orders', labelKey: 'accountDashboard.sections.orders', icon: 'cube-outline' },
  { key: 'services', labelKey: 'accountDashboard.sections.services', icon: 'construct-outline' },
  { key: 'vehicles', labelKey: 'accountDashboard.sections.vehicles', icon: 'car-outline' },
  { key: 'addresses', labelKey: 'accountDashboard.sections.addresses', icon: 'location-outline' },
  { key: 'payments', labelKey: 'accountDashboard.sections.payments', icon: 'wallet-outline' },
  { key: 'shopping', labelKey: 'accountDashboard.sections.shopping', icon: 'bag-outline' },
  { key: 'support', labelKey: 'accountDashboard.sections.support', icon: 'help-buoy-outline' },
  { key: 'notifications', labelKey: 'accountDashboard.sections.notifications', icon: 'notifications-outline' },
  { key: 'preferences', labelKey: 'accountDashboard.sections.preferences', icon: 'color-palette-outline' },
  { key: 'security', labelKey: 'accountDashboard.sections.security', icon: 'shield-checkmark-outline' },
  { key: 'account', labelKey: 'accountDashboard.sections.account', icon: 'log-out-outline' },
];

function RowItem({ row }: { row: Row }) {
  const { t } = useTranslation();
  const colors = useIsDarkMode() ? DARK_COLORS : LIGHT_COLORS;
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Pressable
      onPress={row.disabled ? undefined : row.onPress}
      disabled={row.disabled}
      style={({ hovered }: any) => [
        styles.row,
        hovered && !row.disabled && styles.rowHovered,
        row.disabled && styles.rowDisabled,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!row.disabled }}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, row.danger && styles.rowLabelDanger, row.disabled && styles.rowLabelDisabled]}>
          {row.label}
        </Text>
        {!!row.caption && <Text style={styles.rowCaption}>{row.caption}</Text>}
      </View>
      {row.disabled ? (
        <Text style={styles.comingSoonTag}>{t('accountDashboard.comingSoon')}</Text>
      ) : (
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      )}
    </Pressable>
  );
}

function SectionCard({
  title, sectionKey, sectionRefs, children,
}: { title: string; sectionKey: SectionKey; sectionRefs: React.MutableRefObject<Partial<Record<SectionKey, View | null>>>; children: React.ReactNode }) {
  const colors = useIsDarkMode() ? DARK_COLORS : LIGHT_COLORS;
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View
      ref={(el) => { sectionRefs.current[sectionKey] = el; }}
      style={styles.card}
    >
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

export default function AccountDashboardScreen() {
  const navigation = useNavigation<NavigationProp<any>>();
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);
  const token = useSelector((state: RootState) => state.auth.token);
  const themePreference = useSelector((state: RootState) => state.theme.preference);
  const isDarkMode = useSelector((state: RootState) => state.theme.resolvedScheme === 'dark');
  const colors = isDarkMode ? DARK_COLORS : LIGHT_COLORS;
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { isTabletUp } = useBreakpoint();

  const [activeSection, setActiveSection] = useState<SectionKey>('profile');
  const [coupons, setCoupons] = useState<{ code: string; discountType: string; discountValue: number; minOrderValue: number }[]>([]);
  const [couponsLoading, setCouponsLoading] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const sectionRefs = useRef<Partial<Record<SectionKey, View | null>>>({});

  // Full-width page (not the shell's default 1280px-boxed content) since the
  // sidebar + content layout manages its own Container/footer -- same
  // mechanism the 7 booking-flow screens and HomeScreenDesktop already use.
  useFocusEffect(useCallback(() => {
    setDesktopFullPageScreenActive(true);
    return () => setDesktopFullPageScreenActive(false);
  }, []));

  useEffect(() => {
    if (!token) return;
    setCouponsLoading(true);
    fetch(`${API_BASE_URL}/coupons/active`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => (res.ok ? res.json() : []))
      .then(setCoupons)
      .catch(() => setCoupons([]))
      .finally(() => setCouponsLoading(false));
  }, [token]);

  const goTo = (route: string, params?: object) => () => (navigation as any).navigate(route, params);

  const handleReportIssue = () => {
    const url = buildSupportWhatsAppUrl('Hello MechBazar Support, I would like to report an issue with my account.');
    Linking.openURL(url).catch(() => {});
  };

  const handleLogout = () => {
    dispatch(logout());
  };

  const scrollToSection = (key: SectionKey) => {
    setActiveSection(key);
    const node = sectionRefs.current[key] as any;
    // findNodeHandle + measureLayout (the RN-native way to do this) throws
    // "findNodeHandle is not supported on web" on React Native Web -- this
    // screen only ever renders on desktop web (see the file-level comment),
    // so every sidebar click was silently crashing instead of scrolling.
    // On web, a View ref *is* the underlying DOM node, so scrollIntoView
    // works directly with no host View/handle indirection needed.
    if (node && typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const avatarLetter = (user?.name || 'U').charAt(0).toUpperCase();
  const wallet = typeof user?.wallet === 'number' ? user.wallet : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.pageHeader}>
        <Pressable
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('MainTabs', { screen: 'Home' }))}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel={t('accountDashboard.goBack')}
        >
          {/* pageHeader is a permanently-dark branded bar (pinned below in
              createStyles, doesn't invert) -- its icon/text must stay fixed
              white too, not the dynamic `colors.white` which is also this
              file's card-surface background token and does invert. */}
          <Ionicons name="arrow-back" size={22} color={LIGHT_COLORS.white} />
        </Pressable>
        <Text style={styles.pageHeaderTitle}>{t('accountDashboard.myAccount')}</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Container>
          <View style={[styles.layout, !isTabletUp && styles.layoutStacked]}>
            {isTabletUp ? (
              <View style={styles.sidebar}>
                {SECTION_META.map(s => (
                  <Pressable
                    key={s.key}
                    onPress={() => scrollToSection(s.key)}
                    style={({ hovered }: any) => [
                      styles.sidebarItem,
                      (hovered || activeSection === s.key) && styles.sidebarItemActive,
                    ]}
                    accessibilityRole="button"
                  >
                    <Ionicons
                      name={s.icon}
                      size={18}
                      color={activeSection === s.key ? colors.primary : colors.textMuted}
                    />
                    <Text style={[styles.sidebarLabel, activeSection === s.key && styles.sidebarLabelActive]}>
                      {t(s.labelKey)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillBar} contentContainerStyle={styles.pillBarContent}>
                {SECTION_META.map(s => (
                  <Pressable
                    key={s.key}
                    onPress={() => scrollToSection(s.key)}
                    style={[styles.pill, activeSection === s.key && styles.pillActive]}
                  >
                    <Text style={[styles.pillText, activeSection === s.key && styles.pillTextActive]}>{t(s.labelKey)}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            <View style={styles.content}>
              {/* PROFILE */}
              <SectionCard title={t('accountDashboard.sections.profile')} sectionKey="profile" sectionRefs={sectionRefs}>
                <View style={styles.profileRow}>
                  <View style={styles.avatar}>
                    {user?.avatar ? (
                      <Image source={{ uri: user.avatar }} style={styles.avatarImg} />
                    ) : (
                      <Text style={styles.avatarText}>{avatarLetter}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1, marginLeft: spacing.md }}>
                    <Text style={styles.profileName}>{user?.name || t('accountDashboard.customerFallback')}</Text>
                    <Text style={styles.profileMeta}>{user?.phone || t('accountDashboard.noPhoneOnFile')}</Text>
                    <Text style={styles.profileMeta}>{user?.email || t('accountDashboard.noEmailOnFile')}</Text>
                  </View>
                  <Pressable style={styles.editBtn} onPress={goTo('EditProfile')} accessibilityRole="button">
                    <Text style={styles.editBtnText}>{t('account.editProfile')}</Text>
                  </Pressable>
                </View>
              </SectionCard>

              {/* ORDERS */}
              <SectionCard title={t('accountDashboard.sections.orders')} sectionKey="orders" sectionRefs={sectionRefs}>
                <RowItem row={{ label: t('orderHistory.myOrders'), onPress: goTo('MainTabs', { screen: 'Orders' }) }} />
                <RowItem row={{ label: t('accountDashboard.orderTracking'), caption: t('accountDashboard.orderTrackingCaption'), onPress: goTo('MainTabs', { screen: 'Orders' }) }} />
                <RowItem row={{ label: t('accountDashboard.orderHistoryLabel'), caption: t('accountDashboard.orderHistoryCaption'), onPress: goTo('MainTabs', { screen: 'Orders' }) }} />
              </SectionCard>

              {/* SERVICES */}
              <SectionCard title={t('accountDashboard.sections.services')} sectionKey="services" sectionRefs={sectionRefs}>
                <RowItem row={{ label: t('accountDashboard.myServiceBookings'), onPress: goTo('ServiceBookingHistory') }} />
                <RowItem row={{ label: t('accountDashboard.garageBookings'), caption: t('accountDashboard.garageBookingsCaption'), onPress: goTo('Garage') }} />
                <RowItem row={{ label: t('accountDashboard.homeMechanicBookings'), caption: t('accountDashboard.homeMechanicBookingsCaption'), onPress: goTo('ServiceBookingHistory') }} />
                <RowItem row={{ label: t('accountDashboard.breakdownRequests'), caption: t('accountDashboard.breakdownRequestsCaption'), onPress: goTo('ServiceBookingHistory') }} />
              </SectionCard>

              {/* VEHICLES */}
              <SectionCard title={t('accountDashboard.sections.vehicles')} sectionKey="vehicles" sectionRefs={sectionRefs}>
                <RowItem row={{ label: t('accountDashboard.myVehicles'), onPress: goTo('Garage') }} />
                <RowItem row={{ label: t('accountDashboard.addVehicle'), onPress: goTo('VehicleSelection') }} />
              </SectionCard>

              {/* ADDRESSES */}
              <SectionCard title={t('accountDashboard.sections.addresses')} sectionKey="addresses" sectionRefs={sectionRefs}>
                <RowItem row={{ label: t('address.savedAddresses'), onPress: goTo('AddressManagement') }} />
                <RowItem row={{ label: t('accountDashboard.addEditDeleteAddress'), caption: t('accountDashboard.addEditDeleteAddressCaption'), onPress: goTo('AddressManagement') }} />
              </SectionCard>

              {/* PAYMENTS */}
              <SectionCard title={t('accountDashboard.sections.payments')} sectionKey="payments" sectionRefs={sectionRefs}>
                <View style={styles.walletBlock}>
                  <Text style={styles.walletLabel}>{t('account.walletBalance')}</Text>
                  <Text style={styles.walletValue}>₹{wallet.toFixed(2)}</Text>
                  <Text style={styles.rowCaption}>{t('accountDashboard.transactionHistoryComingSoon')}</Text>
                </View>
                <RowItem row={{ label: t('accountDashboard.savedPaymentMethods'), caption: t('accountDashboard.savedPaymentMethodsCaption'), disabled: true }} />
              </SectionCard>

              {/* SHOPPING */}
              <SectionCard title={t('accountDashboard.sections.shopping')} sectionKey="shopping" sectionRefs={sectionRefs}>
                <RowItem row={{ label: t('account.wishlist'), onPress: goTo('Wishlist') }} />
                <View style={styles.couponsBlock}>
                  <Text style={styles.rowLabel}>{t('accountDashboard.coupons')}</Text>
                  {couponsLoading ? (
                    <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 8 }} />
                  ) : coupons.length === 0 ? (
                    <Text style={styles.rowCaption}>{t('accountDashboard.noActiveCoupons')}</Text>
                  ) : (
                    coupons.map(c => (
                      <View key={c.code} style={styles.couponRow}>
                        <View style={styles.couponBadge}><Text style={styles.couponCode}>{c.code}</Text></View>
                        <Text style={styles.rowCaption}>
                          {c.discountType === 'PERCENTAGE' ? t('account.offPercentage', { value: c.discountValue }) : t('account.offAmount', { value: c.discountValue })}
                          {c.minOrderValue > 0 ? t('account.onOrdersAbove', { value: c.minOrderValue }) : ''}
                        </Text>
                      </View>
                    ))
                  )}
                </View>
              </SectionCard>

              {/* SUPPORT */}
              <SectionCard title={t('accountDashboard.sections.support')} sectionKey="support" sectionRefs={sectionRefs}>
                <RowItem row={{ label: t('accountDashboard.helpCenter'), onPress: goTo('HelpCenter') }} />
                <RowItem row={{ label: t('accountDashboard.contactSupport'), caption: t('accountDashboard.contactSupportCaption'), onPress: goTo('HelpCenter') }} />
                <RowItem row={{ label: t('accountDashboard.faq'), caption: t('accountDashboard.faqCaption'), onPress: goTo('HelpCenter') }} />
                <RowItem row={{ label: t('accountDashboard.reportIssue'), onPress: handleReportIssue }} />
              </SectionCard>

              {/* NOTIFICATIONS */}
              <SectionCard title={t('accountDashboard.sections.notifications')} sectionKey="notifications" sectionRefs={sectionRefs}>
                <RowItem row={{ label: t('accountDashboard.viewNotifications'), onPress: goTo('Notifications') }} />
                <RowItem row={{ label: t('accountDashboard.notificationSettings'), caption: t('accountDashboard.comingSoon'), disabled: true }} />
              </SectionCard>

              {/* PREFERENCES */}
              <SectionCard title={t('accountDashboard.sections.preferences')} sectionKey="preferences" sectionRefs={sectionRefs}>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>{t('accountDashboard.darkMode')}</Text>
                    <Text style={styles.rowCaption}>
                      {themePreference === 'system' ? t('accountDashboard.followingSystemSetting') : themePreference === 'dark' ? t('accountDashboard.on') : t('accountDashboard.off')}
                    </Text>
                  </View>
                  <Switch
                    value={isDarkMode}
                    onValueChange={(value) => { dispatch(setThemePreference(value ? 'dark' : 'light')); }}
                    trackColor={{ false: '#767577', true: colors.primary }}
                    thumbColor={isDarkMode ? '#FFFFFF' : '#f4f3f4'}
                  />
                </View>
                {themePreference !== 'system' && (
                  <RowItem row={{ label: t('accountDashboard.matchSystemSetting'), onPress: () => dispatch(setThemePreference('system')) }} />
                )}
              </SectionCard>

              {/* SECURITY */}
              <SectionCard title={t('accountDashboard.sections.security')} sectionKey="security" sectionRefs={sectionRefs}>
                <RowItem
                  row={{
                    label: t('account.changePassword'),
                    caption: t('accountDashboard.changePasswordCaption'),
                    onPress: goTo('MainTabs', { screen: 'Account' }),
                  }}
                />
                <RowItem row={{ label: t('accountDashboard.loginDevices'), caption: t('accountDashboard.comingSoon'), disabled: true }} />
                <RowItem row={{ label: t('accountDashboard.privacySettings'), caption: t('accountDashboard.comingSoon'), disabled: true }} />
              </SectionCard>

              {/* ACCOUNT */}
              <SectionCard title={t('accountDashboard.sections.account')} sectionKey="account" sectionRefs={sectionRefs}>
                <RowItem row={{ label: t('account.logOut'), danger: true, onPress: handleLogout }} />
              </SectionCard>
            </View>
          </View>
        </Container>
        <MinimalFooter />
      </ScrollView>
    </SafeAreaView>
  );
}

// `colors.white` doubles as this file's card/sidebar/pill SURFACE background
// (correctly inverts to a dark surface via DARK_COLORS.white) AND, elsewhere
// in the wider token file, as plain white -- so any usage of it as TEXT/ICON
// on a colored or fixed-dark surface (pageHeaderTitle, the header back icon,
// pillTextActive, avatarText) must be pinned to LIGHT_COLORS.white (a fixed
// literal) instead, or it goes dark-on-dark. Likewise `colors.darkInk` is a
// body-text-ink token that inverts to near-white in dark mode -- using it for
// pageHeader's background (a permanently-dark branded bar, not a surface that
// should invert) is pinned to LIGHT_COLORS.darkInk so the header always stays
// dark regardless of theme, matching this app's other fixed-dark headers.
// `typeof LIGHT_COLORS` would preserve tokens.ts's `as const` literal types
// (e.g. `primary: "#DA3830"`), which DARK_COLORS's own literals ("#FF5A4E")
// aren't assignable to -- widen every field to `string` so both palettes
// satisfy the same parameter type.
type Palette = { [K in keyof typeof LIGHT_COLORS]: string };

const createStyles = (colors: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.pageBg },
  pageHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: LIGHT_COLORS.darkInk, paddingHorizontal: spacing.md, height: 56,
  },
  backBtn: { padding: spacing.xs },
  pageHeaderTitle: { color: LIGHT_COLORS.white, fontSize: 16, fontWeight: '700' },
  scrollContent: { paddingTop: spacing.lg, paddingBottom: spacing.xl },
  layout: { flexDirection: 'row', gap: spacing.lg, alignItems: 'flex-start' },
  layoutStacked: { flexDirection: 'column' },
  sidebar: {
    width: 240, flexShrink: 0, backgroundColor: colors.white, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.borderLight, padding: spacing.sm, gap: 2,
  },
  sidebarItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: radius.sm,
  },
  sidebarItemActive: { backgroundColor: colors.pageBg },
  sidebarLabel: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  sidebarLabelActive: { color: colors.primary },
  pillBar: { marginBottom: spacing.md },
  pillBarContent: { gap: 8, paddingHorizontal: 2 },
  pill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderLight,
  },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  pillTextActive: { color: LIGHT_COLORS.white },
  content: { flex: 1, minWidth: 0, gap: spacing.md },
  card: {
    backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.borderLight, padding: spacing.md, ...shadows.sm,
  },
  cardTitle: { fontSize: 15, fontWeight: '800', color: colors.textDark, marginBottom: spacing.sm },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.borderLight,
  },
  rowHovered: { backgroundColor: colors.pageBg },
  rowDisabled: { opacity: 0.6 },
  rowLabel: { fontSize: 13, fontWeight: '700', color: colors.textDark },
  rowLabelDanger: { color: colors.danger },
  rowLabelDisabled: { color: colors.textMuted },
  rowCaption: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  comingSoonTag: {
    fontSize: 10, fontWeight: '700', color: colors.textMuted,
    backgroundColor: colors.pageBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill,
  },
  profileRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: { color: LIGHT_COLORS.white, fontSize: 20, fontWeight: '800' },
  profileName: { fontSize: 16, fontWeight: '800', color: colors.textDark },
  profileMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  editBtn: {
    borderWidth: 1.5, borderColor: colors.primary, borderRadius: radius.sm,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  editBtnText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  walletBlock: { paddingBottom: 10, borderTopWidth: 1, borderTopColor: colors.borderLight, paddingTop: 10 },
  walletLabel: { fontSize: 10, fontWeight: '800', color: colors.textMuted, letterSpacing: 0.4 },
  walletValue: { fontSize: 22, fontWeight: '800', color: colors.textDark, marginTop: 4, marginBottom: 4 },
  couponsBlock: { paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.borderLight, marginTop: 4 },
  couponRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  couponBadge: { backgroundColor: colors.pageBg, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  couponCode: { fontSize: 11, fontWeight: '800', color: colors.primary, letterSpacing: 0.5 },
});
