import React from 'react';
import { View, Text, Pressable, Linking, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';
import { colors, spacing, radius } from '../../../theme/tokens';
import Container from '../shared/Container';

interface FooterLink {
  label: string;
  onPress?: (nav: NavigationProp<any>) => void;
}

// Links only navigate/open a URL when a real destination already exists
// today (an existing screen, or the live vendor.mechbazar.com portal).
// Entries without a backing page (About/Careers/policies/app-store links)
// are intentionally rendered as plain, non-interactive text rather than
// wired to a placeholder or guessed URL -- avoids shipping a dead link.
const COMPANY_LINKS: FooterLink[] = [
  { label: 'About Us' },
  { label: 'Careers' },
  { label: 'Contact Us', onPress: nav => nav.navigate('HelpCenter') },
  { label: 'Help Center', onPress: nav => nav.navigate('HelpCenter') },
];

const POLICY_LINKS: FooterLink[] = [
  { label: 'Privacy Policy' },
  { label: 'Terms of Service' },
  { label: 'Return & Refund Policy' },
  { label: 'Shipping Policy' },
];

const PARTNER_LINKS: FooterLink[] = [
  { label: 'Become a Vendor', onPress: nav => nav.navigate('WholesaleRegistration') },
  { label: 'Become a Mechanic' },
];

const SOCIAL_ICONS: (keyof typeof Ionicons.glyphMap)[] = ['logo-facebook', 'logo-instagram', 'logo-twitter', 'logo-youtube'];

function FooterColumn({ title, links, token }: { title: string; links: FooterLink[]; token: string | null }) {
  const navigation = useNavigation<NavigationProp<any>>();
  return (
    <View style={styles.column}>
      <Text style={styles.columnTitle}>{title}</Text>
      {links.map(link => {
        const isVendorLinkForLoggedIn = link.label === 'Become a Vendor' && !!token;
        if (isVendorLinkForLoggedIn) {
          return (
            <Pressable key={link.label} onPress={() => Linking.openURL('https://vendor.mechbazar.com')}>
              <Text style={styles.linkText}>{link.label}</Text>
            </Pressable>
          );
        }
        if (link.onPress) {
          return (
            <Pressable key={link.label} onPress={() => link.onPress!(navigation)}>
              <Text style={styles.linkText}>{link.label}</Text>
            </Pressable>
          );
        }
        return <Text key={link.label} style={styles.staticText}>{link.label}</Text>;
      })}
    </View>
  );
}

export default function DesktopFooter() {
  const token = useSelector((state: RootState) => state.auth.token);

  return (
    <View style={styles.footer}>
      <Container style={styles.grid}>
        <View style={[styles.column, styles.brandColumn]}>
          <Text style={styles.brand}>MechBazar</Text>
          <Text style={styles.brandTagline}>
            Genuine auto parts and trusted mechanic services, delivered to your doorstep.
          </Text>
          <View style={styles.socialRow}>
            {SOCIAL_ICONS.map(icon => (
              <View key={icon} style={styles.socialIcon}>
                <Ionicons name={icon} size={16} color={colors.textMuted} />
              </View>
            ))}
          </View>
        </View>

        <FooterColumn title="Company" links={COMPANY_LINKS} token={token} />
        <FooterColumn title="Policies" links={POLICY_LINKS} token={token} />
        <FooterColumn title="Partner With Us" links={PARTNER_LINKS} token={token} />

        <View style={styles.column}>
          <Text style={styles.columnTitle}>Get the App</Text>
          <Text style={styles.staticText}>Available on Play Store &amp; App Store</Text>
        </View>
      </Container>

      <View style={styles.bottomBar}>
        <Container style={styles.bottomRow}>
          <Text style={styles.copyright}>© {new Date().getFullYear()} MechBazar. All rights reserved.</Text>
        </Container>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { backgroundColor: colors.darkInk, marginTop: spacing.xxl },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
    gap: spacing.xl,
  },
  column: { minWidth: 160, flexGrow: 1, gap: 10 },
  brandColumn: { flexGrow: 2, minWidth: 260, maxWidth: 320 },
  brand: { color: colors.white, fontSize: 22, fontWeight: '800' },
  brandTagline: { color: colors.mutedOnDark, fontSize: 13, lineHeight: 20 },
  socialRow: { flexDirection: 'row', gap: 10, marginTop: spacing.sm },
  socialIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.steel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  columnTitle: { color: colors.white, fontSize: 14, fontWeight: '700', marginBottom: 4 },
  linkText: { color: colors.mutedOnDark, fontSize: 13, marginBottom: 2 },
  staticText: { color: colors.mutedOnDark, fontSize: 13, marginBottom: 2 },
  bottomBar: { borderTopWidth: 1, borderTopColor: colors.steel },
  bottomRow: { paddingVertical: spacing.md, alignItems: 'center' },
  copyright: { color: colors.mutedOnDark, fontSize: 12 },
});
