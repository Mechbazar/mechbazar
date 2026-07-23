import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';
import { fetchMyWishlist } from '../../../services/wishlist.service';
import { useBreakpoint } from '../../../hooks/useBreakpoint';
import { colors, spacing, radius } from '../../../theme/tokens';
import Container from '../shared/Container';
import SearchBar from './SearchBar';
import LocationSelector from './LocationSelector';
import MegaMenu from './MegaMenu';

function IconAction({
  icon, count, label, onPress,
}: { icon: keyof typeof Ionicons.glyphMap; count?: number; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.iconAction}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={19} color={colors.white} />
      {!!count && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
        </View>
      )}
    </Pressable>
  );
}

// Renders only inside DesktopAppShell.web.tsx at desktop widths (see that
// file). Reads auth/cart state directly from Redux and reuses the exact
// screens/actions the mobile UI already has -- no new endpoints, no new
// navigation targets beyond what App.tsx already registers.
export default function DesktopHeader() {
  const navigation = useNavigation<NavigationProp<any>>();
  const token = useSelector((state: RootState) => state.auth.token);
  const user = useSelector((state: RootState) => state.auth.user);
  const cartItems = useSelector((state: RootState) => state.cart.items);
  const cartCount = cartItems.reduce((sum, item) => sum + item.qty, 0);
  const { isWide } = useBreakpoint();

  const [wishlistCount, setWishlistCount] = useState(0);

  useEffect(() => {
    if (!token) {
      setWishlistCount(0);
      return;
    }
    let cancelled = false;
    fetchMyWishlist(token).then(items => { if (!cancelled) setWishlistCount(items.length); });
    return () => { cancelled = true; };
  }, [token]);

  return (
    <View style={styles.wrapper}>
      <Container style={styles.topRow}>
        <Pressable
          onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })}
          style={styles.logoWrap}
          accessibilityRole="link"
          accessibilityLabel="MechBazar home"
        >
          <Text style={styles.logoText}>MechBazar</Text>
        </Pressable>

        <MegaMenu />

        <Pressable
          style={({ hovered }: any) => [styles.servicesLink, hovered && styles.servicesLinkHovered]}
          onPress={() => navigation.navigate('MainTabs', { screen: 'Services' })}
          accessibilityRole="link"
        >
          <Text style={styles.servicesLinkText}>Services</Text>
        </Pressable>

        <SearchBar />

        {!!token && <LocationSelector />}

        <View style={styles.actions}>
          <IconAction
            icon="heart-outline"
            count={wishlistCount}
            label="Wishlist"
            onPress={() => navigation.navigate(token ? 'Wishlist' : 'Welcome')}
          />
          <IconAction
            icon="cart-outline"
            count={cartCount}
            label="Cart"
            onPress={() => navigation.navigate('Cart')}
          />
          {!!token && (
            <IconAction
              icon="notifications-outline"
              label="Notifications"
              onPress={() => navigation.navigate('Notifications')}
            />
          )}

          {token ? (
            <Pressable
              onPress={() => navigation.navigate('AccountDashboard')}
              style={styles.accountTrigger}
              accessibilityRole="button"
              accessibilityLabel="My Account"
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(user?.name || 'U').charAt(0).toUpperCase()}</Text>
              </View>
              {isWide && (
                <Text style={styles.accountName} numberOfLines={1}>{user?.name || 'Account'}</Text>
              )}
            </Pressable>
          ) : (
            <Pressable
              style={styles.loginButton}
              onPress={() => navigation.navigate('Welcome')}
              accessibilityRole="button"
            >
              <Text style={styles.loginButtonText}>Login / Register</Text>
            </Pressable>
          )}
        </View>
      </Container>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'sticky' as any,
    top: 0,
    zIndex: 100,
    width: '100%',
    backgroundColor: colors.darkInk,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 64,
    gap: spacing.md,
  },
  logoWrap: { flexShrink: 0 },
  // fontSize reduced from 24 to keep proportion with the shorter 64px row
  // (same weight/color/wordmark -- brand identity unchanged, just smaller).
  logoText: { color: colors.white, fontSize: 20, fontWeight: '800' },
  servicesLink: { paddingVertical: 6, flexShrink: 0 },
  servicesLinkHovered: { opacity: 0.75 },
  servicesLinkText: { color: colors.white, fontSize: 13, fontWeight: '600' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 0 },
  iconAction: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: '700' },
  accountTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.sm,
    height: 40,
    maxWidth: 180,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  accountName: { color: colors.white, fontSize: 13, fontWeight: '600', maxWidth: 90 },
  loginButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonText: { color: colors.white, fontSize: 13, fontWeight: '700' },
});
