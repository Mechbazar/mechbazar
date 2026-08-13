import React, { useRef, useState } from 'react';
import { View, Text, Pressable, Linking, Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';
import { Logo } from '@mechbazar/shared';
import { colors, spacing, radius } from '../../../theme/tokens';
import { useBreakpoint } from '../../../hooks/useBreakpoint';
import Container from '../shared/Container';

// Every link below navigates to a real, already-registered route (see
// App.web.tsx's Stack/Tab tree) -- no "#" placeholders, no invented pages.
// A few labels intentionally reuse a mobile-tab or guarded top-level screen
// rather than a dedicated page, because that's the actual existing
// destination for that action:
//   - "Auto Parts" -> the Categories tab (there's no separate parts catalog
//     page; browsing starts from Categories).
//   - "Track Order" -> the Orders tab, matching what the Shipping Policy
//     itself tells customers ("track an order's status from the Orders
//     tab").
//   - "Your Account" -> AccountDashboard, the same screen DesktopHeader's
//     avatar/name click already opens (kept consistent with the header).
//   - "Become a Vendor" reuses DesktopFooter's pre-existing logged-in
//     exception: an already-registered vendor opens the live
//     vendor.mechbazar.com portal instead of the signup form.
// "Become a Rider" was requested by the design brief but has no existing
// page or signup flow anywhere in this app, so it's intentionally omitted
// rather than linked to a placeholder.
interface FooterLinkItem {
  label: string;
  onPress: (nav: NavigationProp<any>) => void;
}

const GET_TO_KNOW_US: FooterLinkItem[] = [
  { label: 'About Us', onPress: nav => nav.navigate('StaticPage', { page: 'about' }) },
  { label: 'Careers', onPress: nav => nav.navigate('StaticPage', { page: 'careers' }) },
  { label: 'Contact Us', onPress: nav => nav.navigate('StaticPage', { page: 'contact' }) },
  { label: 'Help Center', onPress: nav => nav.navigate('HelpCenter') },
];

const SHOP_AND_SERVICES: FooterLinkItem[] = [
  { label: 'Auto Parts', onPress: nav => nav.navigate('MainTabs', { screen: 'Categories' }) },
  { label: 'Mechanic Services', onPress: nav => nav.navigate('MainTabs', { screen: 'Services' }) },
  { label: 'Service Bookings', onPress: nav => nav.navigate('ServiceBookingHistory') },
  { label: 'Track Order', onPress: nav => nav.navigate('MainTabs', { screen: 'Orders' }) },
];

const PARTNER_WITH_US: FooterLinkItem[] = [
  { label: 'Become a Vendor', onPress: nav => nav.navigate('WholesaleRegistration') },
  { label: 'Become a Mechanic', onPress: nav => nav.navigate('StaticPage', { page: 'become-mechanic' }) },
];

const LET_US_HELP_YOU: FooterLinkItem[] = [
  { label: 'Your Account', onPress: nav => nav.navigate('AccountDashboard') },
  { label: 'My Garage', onPress: nav => nav.navigate('Garage') },
  { label: 'Manage Addresses', onPress: nav => nav.navigate('AddressManagement') },
  { label: 'Returns & Replacement', onPress: nav => nav.navigate('StaticPage', { page: 'returns' }) },
];

const POLICIES: FooterLinkItem[] = [
  { label: 'Privacy Policy', onPress: nav => nav.navigate('StaticPage', { page: 'privacy' }) },
  { label: 'Terms of Service', onPress: nav => nav.navigate('StaticPage', { page: 'terms' }) },
  { label: 'Refund Policy', onPress: nav => nav.navigate('StaticPage', { page: 'refund' }) },
  { label: 'Cancellation Policy', onPress: nav => nav.navigate('StaticPage', { page: 'cancellation' }) },
  { label: 'Shipping Policy', onPress: nav => nav.navigate('StaticPage', { page: 'shipping' }) },
  { label: 'Account Deletion', onPress: nav => nav.navigate('StaticPage', { page: 'account-deletion' }) },
];

const BOTTOM_BAR_LINKS: FooterLinkItem[] = [
  { label: 'Privacy Policy', onPress: nav => nav.navigate('StaticPage', { page: 'privacy' }) },
  { label: 'Terms of Service', onPress: nav => nav.navigate('StaticPage', { page: 'terms' }) },
  { label: 'Account Deletion', onPress: nav => nav.navigate('StaticPage', { page: 'account-deletion' }) },
];

function FooterLink({ label, onPress, token, dense }: { label: string; onPress: (nav: NavigationProp<any>) => void; token: string | null; dense?: boolean }) {
  const navigation = useNavigation<NavigationProp<any>>();
  const isVendorLinkForLoggedIn = label === 'Become a Vendor' && !!token;

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={() => (isVendorLinkForLoggedIn ? Linking.openURL('https://vendor.mechbazar.com') : onPress(navigation))}
      style={({ hovered, focused }: any) => [
        styles.linkRow,
        dense && styles.linkRowDense,
        (hovered || focused) && styles.linkRowActive,
      ]}
    >
      <Text style={styles.linkText}>{label}</Text>
    </Pressable>
  );
}

// Renders as a plain heading + link list on tablet/desktop, and as an
// accessible expand/collapse section (aria-expanded via accessibilityState)
// on mobile, per column -- each section opens independently.
function FooterColumn({
  title, links, token, collapsible,
}: { title: string; links: FooterLinkItem[]; token: string | null; collapsible: boolean }) {
  const [open, setOpen] = useState(false);

  if (!collapsible) {
    return (
      <View style={styles.column}>
        <Text style={styles.columnTitle}>{title}</Text>
        <View style={styles.columnLinks}>
          {links.map(link => (
            <FooterLink key={link.label} label={link.label} onPress={link.onPress} token={token} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.mobileColumn}>
      <Pressable
        onPress={() => setOpen(o => !o)}
        style={styles.mobileColumnHeader}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${title}${open ? ', expanded' : ', collapsed'}`}
      >
        <Text style={styles.columnTitle}>{title}</Text>
        <Ionicons name={open ? 'remove' : 'add'} size={20} color={colors.white} />
      </Pressable>
      {open && (
        <View style={styles.mobileColumnLinks}>
          {links.map(link => (
            <FooterLink key={link.label} label={link.label} onPress={link.onPress} token={token} dense />
          ))}
        </View>
      )}
    </View>
  );
}

// A full-width strip above the rest of the footer, in the spirit of
// Amazon's "Back to top" bar -- a large, always-in-flow click target rather
// than a floating button, so it can never overlap another floating widget.
// Walks up from its own DOM node to find whichever ancestor is actually
// scrollable (desktop screens each own their content inside their own
// ScrollView rather than the browser window -- see HomeScreenDesktop.tsx /
// CategoryProductsDesktop.tsx), falling back to window scroll if none is
// found. Web-only; a no-op on native (which never renders this component --
// DesktopFooter is only ever imported from desktop-web files).
function BackToTopBar() {
  const nodeRef = useRef<any>(null);

  const handlePress = () => {
    if (Platform.OS !== 'web') return;
    try {
      const win: any = (globalThis as any).window;
      const doc: any = (globalThis as any).document;
      let el: any = nodeRef.current;
      while (el && el !== doc?.body) {
        const style = win?.getComputedStyle?.(el);
        const scrollable = style && /(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 1;
        if (scrollable) {
          el.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
        el = el.parentElement;
      }
      win?.scrollTo?.({ top: 0, behavior: 'smooth' });
    } catch {
      // Back to top is a convenience affordance -- never worth crashing the footer over.
    }
  };

  return (
    <Pressable
      ref={nodeRef}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel="Back to top"
      style={({ hovered, focused }: any) => [styles.backToTop, (hovered || focused) && styles.backToTopActive]}
    >
      <Ionicons name="chevron-up-outline" size={14} color={colors.mutedOnDark} />
      <Text style={styles.backToTopText}>Back to top</Text>
    </Pressable>
  );
}

export default function DesktopFooter() {
  const token = useSelector((state: RootState) => state.auth.token);
  const { breakpoint } = useBreakpoint();
  const isMobileLayout = breakpoint === 'mobile';

  return (
    <View style={styles.footer} role="contentinfo">
      <BackToTopBar />

      <Container style={styles.brandRow}>
        {/* Dark tone: the footer is the dark brand surface, same as the header. */}
        <Logo tone="dark" width={168} />
        <Text style={styles.brandTagline}>
          Genuine auto parts and trusted mechanic services, delivered to your doorstep.
        </Text>
      </Container>

      <View style={styles.divider} />

      <Container style={[styles.grid, isMobileLayout && styles.gridMobile]}>
        <FooterColumn title="Get to Know Us" links={GET_TO_KNOW_US} token={token} collapsible={isMobileLayout} />
        <FooterColumn title="Shop & Services" links={SHOP_AND_SERVICES} token={token} collapsible={isMobileLayout} />
        <FooterColumn title="Partner With Us" links={PARTNER_WITH_US} token={token} collapsible={isMobileLayout} />
        <FooterColumn title="Let Us Help You" links={LET_US_HELP_YOU} token={token} collapsible={isMobileLayout} />
        <FooterColumn title="Policies" links={POLICIES} token={token} collapsible={isMobileLayout} />
      </Container>

      <View style={styles.divider} />

      <Container style={styles.trustRow}>
        <Ionicons name="cash-outline" size={16} color={colors.mutedOnDark} />
        <Text style={styles.trustText}>Cash on Delivery available on every order and every service booking</Text>
      </Container>

      <View style={styles.bottomBar}>
        <Container style={[styles.bottomRow, isMobileLayout && styles.bottomRowMobile]}>
          <Text style={styles.copyright}>© {new Date().getFullYear()} MechBazar. All rights reserved.</Text>
          <View style={[styles.bottomLinks, isMobileLayout && styles.bottomLinksMobile]}>
            {BOTTOM_BAR_LINKS.map(link => (
              <FooterLink key={link.label} label={link.label} onPress={link.onPress} token={token} />
            ))}
          </View>
        </Container>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { backgroundColor: colors.darkInk, marginTop: spacing.xxl },

  backToTop: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: colors.steel,
  },
  backToTopActive: { backgroundColor: '#2E3742' },
  backToTopText: { color: colors.mutedOnDark, fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },

  brandRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.xl,
  },
  brandTagline: { color: colors.mutedOnDark, fontSize: 13, lineHeight: 20, flexShrink: 1, maxWidth: 440 },

  divider: { height: 1, backgroundColor: colors.steel },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingVertical: spacing.xl,
    gap: spacing.xl,
  },
  gridMobile: { flexDirection: 'column', gap: 0, paddingVertical: 0 },

  column: { flexGrow: 1, minWidth: 170, gap: 4 },
  columnTitle: { color: colors.white, fontSize: 14, fontWeight: '700', letterSpacing: 0.2 },
  columnLinks: { marginTop: 6, gap: 2 },

  linkRow: { paddingVertical: 4, paddingHorizontal: 4, marginHorizontal: -4, borderRadius: radius.sm },
  linkRowDense: { paddingVertical: 10 },
  linkRowActive: { backgroundColor: 'rgba(255,255,255,0.08)' },
  linkText: { color: colors.mutedOnDark, fontSize: 13.5, lineHeight: 20 },

  mobileColumn: { borderBottomWidth: 1, borderBottomColor: colors.steel },
  mobileColumnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingVertical: 14,
  },
  mobileColumnLinks: { paddingBottom: 10, gap: 0 },

  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: spacing.md,
  },
  trustText: { color: colors.mutedOnDark, fontSize: 12.5, flexShrink: 1 },

  bottomBar: { borderTopWidth: 1, borderTopColor: colors.steel },
  bottomRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  bottomRowMobile: { flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  bottomLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  bottomLinksMobile: { justifyContent: 'center' },
  copyright: { color: colors.mutedOnDark, fontSize: 12 },
});
