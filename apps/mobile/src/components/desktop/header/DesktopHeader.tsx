import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../../store';
import { logout } from '../../../store/authSlice';
import { fetchMyWishlist } from '../../../services/wishlist.service';
import { colors, spacing, radius, shadows } from '../../../theme/tokens';
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
      <Ionicons name={icon} size={22} color={colors.white} />
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
  const dispatch = useDispatch();
  const token = useSelector((state: RootState) => state.auth.token);
  const user = useSelector((state: RootState) => state.auth.user);
  const cartItems = useSelector((state: RootState) => state.cart.items);
  const cartCount = cartItems.reduce((sum, item) => sum + item.qty, 0);

  const [wishlistCount, setWishlistCount] = useState(0);
  const [accountOpen, setAccountOpen] = useState(false);

  useEffect(() => {
    if (!token) {
      setWishlistCount(0);
      return;
    }
    let cancelled = false;
    fetchMyWishlist(token).then(items => { if (!cancelled) setWishlistCount(items.length); });
    return () => { cancelled = true; };
  }, [token]);

  // DesktopHeader is part of the persistent shell (DesktopAppShell.web.tsx),
  // not a per-screen component, so it never unmounts/remounts on navigation.
  // Without this, opening the account panel (hover or click) and then using
  // any OTHER header action -- notifications bell, cart, wishlist, a mega
  // menu link -- leaves accountOpen stuck true, so the panel keeps floating
  // over whatever screen the user navigated to instead of closing.
  useEffect(() => {
    const unsubscribe = navigation.addListener('state', () => setAccountOpen(false));
    return unsubscribe;
  }, [navigation]);

  const goAccount = (screen?: string) => {
    setAccountOpen(false);
    if (screen) navigation.navigate(screen);
    else navigation.navigate('MainTabs', { screen: 'Account' });
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.topBar}>
        <Container style={styles.topRow}>
          <Pressable
            onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })}
            style={styles.logoWrap}
            accessibilityRole="link"
            accessibilityLabel="MechBazar home"
          >
            <Text style={styles.logoText}>MechBazar</Text>
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
                onHoverIn={() => setAccountOpen(true)}
                onHoverOut={() => setAccountOpen(false)}
                onPress={() => setAccountOpen(o => !o)}
                style={styles.accountTrigger}
                accessibilityRole="button"
                accessibilityLabel="Account menu"
                accessibilityState={{ expanded: accountOpen }}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{(user?.name || 'U').charAt(0).toUpperCase()}</Text>
                </View>
                <Text style={styles.accountName} numberOfLines={1}>{user?.name || 'Account'}</Text>
                <Ionicons name={accountOpen ? 'chevron-up' : 'chevron-down'} size={14} color={colors.white} />

                {accountOpen && (
                  <View style={styles.accountPanel}>
                    <Pressable style={styles.accountItem} onPress={() => goAccount()}>
                      <Text style={styles.accountItemText}>My Account</Text>
                    </Pressable>
                    <Pressable style={styles.accountItem} onPress={() => navigation.navigate('MainTabs', { screen: 'Orders' })}>
                      <Text style={styles.accountItemText}>My Orders</Text>
                    </Pressable>
                    <Pressable style={styles.accountItem} onPress={() => goAccount('Wishlist')}>
                      <Text style={styles.accountItemText}>Wishlist</Text>
                    </Pressable>
                    <Pressable style={styles.accountItem} onPress={() => goAccount('AddressManagement')}>
                      <Text style={styles.accountItemText}>Addresses</Text>
                    </Pressable>
                    <View style={styles.accountDivider} />
                    <Pressable
                      style={styles.accountItem}
                      onPress={() => { setAccountOpen(false); dispatch(logout()); }}
                    >
                      <Text style={[styles.accountItemText, styles.logoutText]}>Logout</Text>
                    </Pressable>
                  </View>
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

      <MegaMenu />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'sticky' as any,
    top: 0,
    zIndex: 100,
    width: '100%',
  },
  topBar: { backgroundColor: colors.darkInk },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 72,
    gap: spacing.lg,
  },
  logoWrap: { flexShrink: 0 },
  logoText: { color: colors.white, fontSize: 24, fontWeight: '800' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 0 },
  iconAction: {
    width: 44,
    height: 44,
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
    height: 44,
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
  accountPanel: {
    position: 'absolute' as any,
    top: '100%',
    right: 0,
    minWidth: 200,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    marginTop: 4,
    paddingVertical: 6,
    zIndex: 50,
    ...shadows.lg,
  },
  accountItem: { paddingVertical: 10, paddingHorizontal: 16 },
  accountItemText: { fontSize: 13, fontWeight: '600', color: colors.textDark },
  accountDivider: { height: 1, backgroundColor: colors.borderLight, marginVertical: 4 },
  logoutText: { color: colors.danger },
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
