import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../../store';
import { logout } from '../../../store/authSlice';
import { useBreakpoint } from '../../../hooks/useBreakpoint';
import { colors, spacing, radius, shadows } from '../../../theme/tokens';

const ANIM_MS = 180;

interface MenuItem {
  label: string;
  route?: string;
  tab?: string;
  danger?: boolean;
}

const ITEMS: MenuItem[] = [
  { label: 'My Account', tab: 'Account' },
  { label: 'My Orders', tab: 'Orders' },
  { label: 'Wishlist', route: 'Wishlist' },
  { label: 'Addresses', route: 'AddressManagement' },
  { label: 'Help Center', route: 'HelpCenter' },
  { label: 'Logout', danger: true },
];

// Only ever rendered by DesktopHeader.tsx when logged in, itself only ever
// reached via DesktopAppShell.web.tsx -- this file, and everything it
// imports, never enters the native (or mobile-web) bundle, so none of the
// hover/keyboard/DOM-event logic below can affect the native app's own
// account menu on AccountScreen.
export default function AccountMenu() {
  const navigation = useNavigation<NavigationProp<any>>();
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);
  const { isWide } = useBreakpoint();

  const [open, setOpen] = useState(false);
  // Stays mounted slightly longer than `open` so the close animation can
  // finish before the panel (and its focusable items) leave the DOM.
  const [rendered, setRendered] = useState(false);
  // Hovering out shouldn't close a menu the user explicitly clicked open --
  // only an explicit close (outside click, Escape, item pick, re-click)
  // should. Hover-opened menus still close on hover-out as normal.
  const clickLockedRef = useRef(false);
  const anim = useRef(new Animated.Value(0)).current;
  const wrapperRef = useRef<any>(null);
  const triggerRef = useRef<any>(null);
  const itemRefs = useRef<any[]>([]);

  useEffect(() => {
    if (open) {
      setRendered(true);
    } else if (rendered) {
      Animated.timing(anim, { toValue: 0, duration: ANIM_MS, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setRendered(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Animate in only once the panel is actually mounted (needs a render pass
  // with anim still at 0 first, otherwise it would just snap to visible).
  useEffect(() => {
    if (open && rendered) {
      Animated.timing(anim, { toValue: 1, duration: ANIM_MS, useNativeDriver: true }).start();
    }
  }, [open, rendered, anim]);

  const openMenu = useCallback((focusFirst = false) => {
    setOpen(true);
    if (focusFirst) requestAnimationFrame(() => itemRefs.current[0]?.focus?.());
  }, []);

  const closeMenu = useCallback((refocusTrigger = false) => {
    setOpen(false);
    clickLockedRef.current = false;
    if (refocusTrigger) triggerRef.current?.focus?.();
  }, []);

  // DesktopHeader itself already closes this on any navigation.addListener
  // ('state', ...) change -- this component doesn't need its own copy of
  // that, it only owns open/close from hover, click, outside-click, Escape,
  // and item selection.

  useEffect(() => {
    if (!rendered) return;
    const handleOutsideClick = (e: any) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) closeMenu();
    };
    const handleKeyDown = (e: any) => {
      if (e.key === 'Escape') { e.preventDefault(); closeMenu(true); return; }
      if (!wrapperRef.current || !wrapperRef.current.contains(document.activeElement)) return;
      const currentIndex = itemRefs.current.findIndex((el) => el === document.activeElement);
      const focusItem = (i: number) => itemRefs.current[Math.max(0, Math.min(ITEMS.length - 1, i))]?.focus?.();
      if (e.key === 'ArrowDown') { e.preventDefault(); focusItem(currentIndex + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); focusItem(currentIndex === -1 ? ITEMS.length - 1 : currentIndex - 1); }
      else if (e.key === 'Home') { e.preventDefault(); focusItem(0); }
      else if (e.key === 'End') { e.preventDefault(); focusItem(ITEMS.length - 1); }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [rendered, closeMenu]);

  const goTo = (item: MenuItem) => {
    closeMenu();
    if (item.danger) { dispatch(logout()); return; }
    if (item.tab) navigation.navigate('MainTabs', { screen: item.tab });
    else if (item.route) navigation.navigate(item.route);
  };

  return (
    <View ref={wrapperRef} style={styles.wrapper}>
      <Pressable
        ref={triggerRef}
        onHoverIn={() => { if (!clickLockedRef.current) openMenu(); }}
        onHoverOut={() => { if (!clickLockedRef.current) closeMenu(); }}
        onPress={() => {
          if (open) { closeMenu(); }
          else { clickLockedRef.current = true; openMenu(); }
        }}
        style={styles.accountTrigger}
        accessibilityRole="button"
        accessibilityLabel="Account menu"
        accessibilityState={{ expanded: open }}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(user?.name || 'U').charAt(0).toUpperCase()}</Text>
        </View>
        {isWide && (
          <Text style={styles.accountName} numberOfLines={1}>{user?.name || 'Account'}</Text>
        )}
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={13} color={colors.white} />
      </Pressable>

      {rendered && (
        <Animated.View
          style={[
            styles.accountPanel,
            {
              opacity: anim,
              transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) }],
            },
          ]}
          pointerEvents={open ? 'auto' : 'none'}
        >
          {ITEMS.map((item, i) => (
            <React.Fragment key={item.label}>
              {item.danger && <View style={styles.accountDivider} />}
              <Pressable
                ref={(el) => { itemRefs.current[i] = el; }}
                style={({ hovered }: any) => [styles.accountItem, hovered && styles.accountItemHovered]}
                onPress={(e: any) => { e.stopPropagation?.(); goTo(item); }}
                accessibilityRole="menuitem"
              >
                <Text style={[styles.accountItemText, item.danger && styles.logoutText]}>{item.label}</Text>
              </Pressable>
            </React.Fragment>
          ))}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flexShrink: 0 },
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
  accountPanel: {
    position: 'absolute' as any,
    // Touches the trigger's bottom edge directly (no gap) -- a gap here is a
    // dead zone: moving the mouse from the button down toward an item
    // briefly leaves both boxes, firing onHoverOut and closing the panel
    // before the click lands.
    top: '100%',
    right: 0,
    minWidth: 200,
    maxWidth: 240,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingTop: 10,
    paddingBottom: 6,
    zIndex: 50,
    ...shadows.lg,
  },
  accountItem: { paddingVertical: 10, paddingHorizontal: 16 },
  accountItemHovered: { backgroundColor: colors.pageBg },
  accountItemText: { fontSize: 13, fontWeight: '600', color: colors.textDark },
  accountDivider: { height: 1, backgroundColor: colors.borderLight, marginVertical: 4 },
  logoutText: { color: colors.danger },
});
