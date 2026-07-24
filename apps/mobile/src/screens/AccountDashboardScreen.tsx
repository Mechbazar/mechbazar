import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { colors, spacing, radius, shadows } from '../theme/tokens';

// Replaces the old desktop header account dropdown (AccountMenu.tsx, removed)
// -- clicking the avatar/name in DesktopHeader now navigates here instead of
// opening a flyout. Reachable only from the desktop header today, but the
// layout is responsive down to phone width (single-column, pill nav) rather
// than assuming a >=1024 viewport, since a user can resize/rotate after
// landing here. Every destination below is a real existing screen/route --
// where the requested item has no dedicated screen or backend endpoint
// (Wallet management, Payment Methods, Notification Settings, Change
// Password, Login Devices, Privacy Settings), it's shown as a disabled
// "Coming soon" row instead of a fake handler, matching this codebase's
// existing policy against fabricated UI (see AccountScreen for the pattern
// this deliberately avoids repeating).
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

const SECTION_META: { key: SectionKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'profile', label: 'Profile', icon: 'person-outline' },
  { key: 'orders', label: 'Orders', icon: 'cube-outline' },
  { key: 'services', label: 'Services', icon: 'construct-outline' },
  { key: 'vehicles', label: 'Vehicles', icon: 'car-outline' },
  { key: 'addresses', label: 'Addresses', icon: 'location-outline' },
  { key: 'payments', label: 'Payments', icon: 'wallet-outline' },
  { key: 'shopping', label: 'Shopping', icon: 'bag-outline' },
  { key: 'support', label: 'Support', icon: 'help-buoy-outline' },
  { key: 'notifications', label: 'Notifications', icon: 'notifications-outline' },
  { key: 'preferences', label: 'Preferences', icon: 'color-palette-outline' },
  { key: 'security', label: 'Security', icon: 'shield-checkmark-outline' },
  { key: 'account', label: 'Account', icon: 'log-out-outline' },
];

function RowItem({ row }: { row: Row }) {
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
        <Text style={styles.comingSoonTag}>Coming soon</Text>
      ) : (
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      )}
    </Pressable>
  );
}

function SectionCard({
  title, sectionKey, sectionRefs, children,
}: { title: string; sectionKey: SectionKey; sectionRefs: React.MutableRefObject<Partial<Record<SectionKey, View | null>>>; children: React.ReactNode }) {
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
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);
  const token = useSelector((state: RootState) => state.auth.token);
  const themePreference = useSelector((state: RootState) => state.theme.preference);
  const isDarkMode = useSelector((state: RootState) => state.theme.resolvedScheme === 'dark');
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
    const message = 'Hello MechBazar Support, I would like to report an issue with my account.';
    const url = `https://wa.me/919876543210?text=${encodeURIComponent(message)}`;
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
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color={colors.white} />
        </Pressable>
        <Text style={styles.pageHeaderTitle}>My Account</Text>
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
                      {s.label}
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
                    <Text style={[styles.pillText, activeSection === s.key && styles.pillTextActive]}>{s.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            <View style={styles.content}>
              {/* PROFILE */}
              <SectionCard title="Profile" sectionKey="profile" sectionRefs={sectionRefs}>
                <View style={styles.profileRow}>
                  <View style={styles.avatar}>
                    {user?.avatar ? (
                      <Image source={{ uri: user.avatar }} style={styles.avatarImg} />
                    ) : (
                      <Text style={styles.avatarText}>{avatarLetter}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1, marginLeft: spacing.md }}>
                    <Text style={styles.profileName}>{user?.name || 'MechBazar Customer'}</Text>
                    <Text style={styles.profileMeta}>{user?.phone || 'No phone on file'}</Text>
                    <Text style={styles.profileMeta}>{user?.email || 'No email on file'}</Text>
                  </View>
                  <Pressable style={styles.editBtn} onPress={goTo('EditProfile')} accessibilityRole="button">
                    <Text style={styles.editBtnText}>Edit Profile</Text>
                  </Pressable>
                </View>
              </SectionCard>

              {/* ORDERS */}
              <SectionCard title="Orders" sectionKey="orders" sectionRefs={sectionRefs}>
                <RowItem row={{ label: 'My Orders', onPress: goTo('MainTabs', { screen: 'Orders' }) }} />
                <RowItem row={{ label: 'Order Tracking', caption: 'Opens My Orders — select an order to track its status', onPress: goTo('MainTabs', { screen: 'Orders' }) }} />
                <RowItem row={{ label: 'Order History', caption: 'Same list as My Orders', onPress: goTo('MainTabs', { screen: 'Orders' }) }} />
              </SectionCard>

              {/* SERVICES */}
              <SectionCard title="Services" sectionKey="services" sectionRefs={sectionRefs}>
                <RowItem row={{ label: 'My Service Bookings', onPress: goTo('ServiceBookingHistory') }} />
                <RowItem row={{ label: 'Garage Bookings', caption: 'Manage the vehicles used for service bookings', onPress: goTo('Garage') }} />
                <RowItem row={{ label: 'Home Mechanic Bookings', caption: "MechBazar doesn't split bookings by type yet — shows all service bookings", onPress: goTo('ServiceBookingHistory') }} />
                <RowItem row={{ label: 'Breakdown Requests', caption: 'Same list as My Service Bookings', onPress: goTo('ServiceBookingHistory') }} />
              </SectionCard>

              {/* VEHICLES */}
              <SectionCard title="Vehicles" sectionKey="vehicles" sectionRefs={sectionRefs}>
                <RowItem row={{ label: 'My Vehicles', onPress: goTo('Garage') }} />
                <RowItem row={{ label: 'Add Vehicle', onPress: goTo('VehicleSelection') }} />
              </SectionCard>

              {/* ADDRESSES */}
              <SectionCard title="Addresses" sectionKey="addresses" sectionRefs={sectionRefs}>
                <RowItem row={{ label: 'Saved Addresses', onPress: goTo('AddressManagement') }} />
                <RowItem row={{ label: 'Add / Edit / Delete Address', caption: 'Managed from the Saved Addresses screen', onPress: goTo('AddressManagement') }} />
              </SectionCard>

              {/* PAYMENTS */}
              <SectionCard title="Payments" sectionKey="payments" sectionRefs={sectionRefs}>
                <View style={styles.walletBlock}>
                  <Text style={styles.walletLabel}>WALLET BALANCE</Text>
                  <Text style={styles.walletValue}>₹{wallet.toFixed(2)}</Text>
                  <Text style={styles.rowCaption}>Transaction history & top-up coming soon</Text>
                </View>
                <RowItem row={{ label: 'Saved Payment Methods', caption: 'Coming soon — no payment gateway is connected yet', disabled: true }} />
              </SectionCard>

              {/* SHOPPING */}
              <SectionCard title="Shopping" sectionKey="shopping" sectionRefs={sectionRefs}>
                <RowItem row={{ label: 'Wishlist', onPress: goTo('Wishlist') }} />
                <View style={styles.couponsBlock}>
                  <Text style={styles.rowLabel}>Coupons</Text>
                  {couponsLoading ? (
                    <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 8 }} />
                  ) : coupons.length === 0 ? (
                    <Text style={styles.rowCaption}>No active coupons right now.</Text>
                  ) : (
                    coupons.map(c => (
                      <View key={c.code} style={styles.couponRow}>
                        <View style={styles.couponBadge}><Text style={styles.couponCode}>{c.code}</Text></View>
                        <Text style={styles.rowCaption}>
                          {c.discountType === 'PERCENTAGE' ? `${c.discountValue}% off` : `₹${c.discountValue} off`}
                          {c.minOrderValue > 0 ? ` on orders above ₹${c.minOrderValue}` : ''}
                        </Text>
                      </View>
                    ))
                  )}
                </View>
              </SectionCard>

              {/* SUPPORT */}
              <SectionCard title="Support" sectionKey="support" sectionRefs={sectionRefs}>
                <RowItem row={{ label: 'Help Center', onPress: goTo('HelpCenter') }} />
                <RowItem row={{ label: 'Contact Support', caption: 'Call & WhatsApp channels are on the Help Center page', onPress: goTo('HelpCenter') }} />
                <RowItem row={{ label: 'FAQ', caption: 'FAQs are on the Help Center page', onPress: goTo('HelpCenter') }} />
                <RowItem row={{ label: 'Report an Issue', onPress: handleReportIssue }} />
              </SectionCard>

              {/* NOTIFICATIONS */}
              <SectionCard title="Notifications" sectionKey="notifications" sectionRefs={sectionRefs}>
                <RowItem row={{ label: 'View Notifications', onPress: goTo('Notifications') }} />
                <RowItem row={{ label: 'Notification Settings', caption: 'Coming soon', disabled: true }} />
              </SectionCard>

              {/* PREFERENCES */}
              <SectionCard title="Preferences" sectionKey="preferences" sectionRefs={sectionRefs}>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>Dark Mode</Text>
                    <Text style={styles.rowCaption}>
                      {themePreference === 'system' ? 'Following your system setting' : themePreference === 'dark' ? 'On' : 'Off'}
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
                  <RowItem row={{ label: 'Match System Setting', onPress: () => dispatch(setThemePreference('system')) }} />
                )}
              </SectionCard>

              {/* SECURITY */}
              <SectionCard title="Security" sectionKey="security" sectionRefs={sectionRefs}>
                <RowItem row={{ label: 'Change Password', caption: 'Coming soon', disabled: true }} />
                <RowItem row={{ label: 'Login Devices', caption: 'Coming soon', disabled: true }} />
                <RowItem row={{ label: 'Privacy Settings', caption: 'Coming soon', disabled: true }} />
              </SectionCard>

              {/* ACCOUNT */}
              <SectionCard title="Account" sectionKey="account" sectionRefs={sectionRefs}>
                <RowItem row={{ label: 'Logout', danger: true, onPress: handleLogout }} />
              </SectionCard>
            </View>
          </View>
        </Container>
        <MinimalFooter />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.pageBg },
  pageHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.darkInk, paddingHorizontal: spacing.md, height: 56,
  },
  backBtn: { padding: spacing.xs },
  pageHeaderTitle: { color: colors.white, fontSize: 16, fontWeight: '700' },
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
  pillTextActive: { color: colors.white },
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
  avatarText: { color: colors.white, fontSize: 20, fontWeight: '800' },
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
