import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { useBreakpoint } from '../../../hooks/useBreakpoint';
import { colors, spacing } from '../../../theme/tokens';

// A minimal stand-in for DesktopFooter.tsx on booking-flow screens, where the
// full multi-column marketing footer would eat into the content-height
// budget and has no place mid-checkout/mid-booking. Deliberately does not
// import DesktopFooter or reuse its Redux/Linking/social-icon dependencies --
// this file is plain .tsx (no .web.tsx split), so unlike DesktopFooter it
// does get parsed into the native bundle; keeping it to View/Text/Pressable
// only keeps that cost negligible. isDesktopUp-gated no-op on native/mobile-web.
export default function MinimalFooter() {
  const { isDesktopUp } = useBreakpoint();
  const navigation = useNavigation<NavigationProp<any>>();
  if (!isDesktopUp) return null;
  return (
    <View style={styles.bar}>
      <Text style={styles.copyright}>© {new Date().getFullYear()} MechBazar. All rights reserved.</Text>
      <Pressable onPress={() => navigation.navigate('HelpCenter')}>
        <Text style={styles.link}>Help Center</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.white,
  },
  copyright: { fontSize: 11, color: colors.textMuted },
  link: { fontSize: 11, color: colors.primary, fontWeight: '700' },
});
