import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Category } from '../../../types/product';
import { colors, spacing, radius, shadows } from '../../../theme/tokens';
import { useBreakpoint } from '../../../hooks/useBreakpoint';

// Same Category[] shape HomeScreen/CategoriesScreen already fetch via
// fetchCategories(vehicleType) -- no new data source, desktop-only layout.

// Purely a display fallback for when a category has no admin-uploaded
// `image` -- real images always win (see the render below). Keyed by
// lowercased category name so it survives minor casing differences from
// the backend. Covers both vehicle types' real category names as seeded in
// prod (verified live via GET /categories?vehicleType=CAR|BIKE 2026-08-14 --
// BIKE roughly matches the redesign reference's broad names, CAR uses a
// much more granular real set the reference never showed), grouped into
// "families" that share a tint/icon so a category outside this list still
// falls through to a reasonable relative, not a bare gray default. Anything
// still unmatched falls through to DEFAULT_ICON rather than the old bare-
// emoji '📦' placeholder, so every category gets the same glossy chip.
const ICON_FALLBACKS: Record<string, { set: 'ionicons' | 'mci'; name: string; tint: string; iconColor: string }> = {
  'accessories': { set: 'mci', name: 'steering', tint: '#FDEEF0', iconColor: '#33313A' },
  'car accessories': { set: 'mci', name: 'steering', tint: '#FDEEF0', iconColor: '#33313A' },
  'steering parts': { set: 'mci', name: 'steering', tint: '#FDEEF0', iconColor: '#33313A' },
  'batteries': { set: 'mci', name: 'car-battery', tint: '#EBFBEE', iconColor: '#2B8A3E' },
  'battery': { set: 'mci', name: 'car-battery', tint: '#EBFBEE', iconColor: '#2B8A3E' },
  'body parts': { set: 'mci', name: 'car-door', tint: '#FDEEF0', iconColor: '#C0392B' },
  'brake system': { set: 'mci', name: 'car-brake-alert', tint: '#F0F1F3', iconColor: '#495057' },
  'brake disc': { set: 'mci', name: 'car-brake-alert', tint: '#F0F1F3', iconColor: '#495057' },
  'brake pads': { set: 'mci', name: 'car-brake-alert', tint: '#F0F1F3', iconColor: '#495057' },
  'clutch': { set: 'mci', name: 'disc', tint: '#F1EEF9', iconColor: '#7048A8' },
  'clutch kit': { set: 'mci', name: 'disc', tint: '#F1EEF9', iconColor: '#7048A8' },
  'electrical': { set: 'ionicons', name: 'flash', tint: '#FFF6E5', iconColor: '#E8890C' },
  'alternator': { set: 'ionicons', name: 'flash', tint: '#FFF6E5', iconColor: '#E8890C' },
  'spark plug': { set: 'ionicons', name: 'flash-outline', tint: '#FFF6E5', iconColor: '#E8890C' },
  'engine parts': { set: 'mci', name: 'engine', tint: '#F0F1F3', iconColor: '#33313A' },
  'timing belt': { set: 'mci', name: 'timer-cog-outline', tint: '#F0F1F3', iconColor: '#33313A' },
  'filters': { set: 'mci', name: 'air-filter', tint: '#E8F3FC', iconColor: '#1C7ED6' },
  'air filter': { set: 'mci', name: 'air-filter', tint: '#E8F3FC', iconColor: '#1C7ED6' },
  'cabin filter': { set: 'mci', name: 'air-filter', tint: '#E8F3FC', iconColor: '#1C7ED6' },
  'ac compressor': { set: 'mci', name: 'air-conditioner', tint: '#E8F3FC', iconColor: '#1C7ED6' },
  'coolant': { set: 'mci', name: 'car-coolant-level', tint: '#E8F3FC', iconColor: '#1C7ED6' },
  'radiator': { set: 'mci', name: 'radiator', tint: '#E8F3FC', iconColor: '#1C7ED6' },
  'wiper': { set: 'mci', name: 'wiper', tint: '#E8F3FC', iconColor: '#1C7ED6' },
  'care kit': { set: 'mci', name: 'car-wash', tint: '#E8F3FC', iconColor: '#1C7ED6' },
  'lighting': { set: 'mci', name: 'car-light-high', tint: '#FFF9DB', iconColor: '#E8A317' },
  'headlight': { set: 'mci', name: 'car-light-high', tint: '#FFF9DB', iconColor: '#E8A317' },
  'tail light': { set: 'mci', name: 'car-light-dimmed', tint: '#FFF9DB', iconColor: '#E8A317' },
  'oils & lubricants': { set: 'mci', name: 'oil', tint: '#FDF3E3', iconColor: '#5C4A2E' },
  'engine oil': { set: 'mci', name: 'oil', tint: '#FDF3E3', iconColor: '#5C4A2E' },
  'suspension': { set: 'mci', name: 'car-shift-pattern', tint: '#FDEEF0', iconColor: '#C0392B' },
  'shock absorber': { set: 'mci', name: 'car-shift-pattern', tint: '#FDEEF0', iconColor: '#C0392B' },
  'transmission': { set: 'mci', name: 'cog', tint: '#F0F1F3', iconColor: '#5F6670' },
  'tyres': { set: 'mci', name: 'tire', tint: '#F0F1F3', iconColor: '#5F6670' },
};
const DEFAULT_ICON = { set: 'mci' as const, name: 'car-wrench', tint: colors.pageBg, iconColor: colors.textMuted };

function CategoryIcon({ category }: { category: Category }) {
  if (category.image) {
    return (
      <View style={styles.iconBox}>
        <Image source={{ uri: category.image }} style={styles.iconImage} />
      </View>
    );
  }
  const cfg = ICON_FALLBACKS[category.name.trim().toLowerCase()] || DEFAULT_ICON;
  const IconComp = cfg.set === 'mci' ? MaterialCommunityIcons : Ionicons;
  return (
    <View style={[styles.iconBox, { backgroundColor: cfg.tint }]}>
      <IconComp name={cfg.name as any} size={34} color={cfg.iconColor} />
    </View>
  );
}

export default function CategoryGridDesktop({ categories }: { categories: Category[] }) {
  const navigation = useNavigation<NavigationProp<any>>();
  const { isWide } = useBreakpoint();
  // 6 columns at wide desktop widths (matches the reference), stepping down
  // to 4 at the narrower end of the desktop breakpoint so cards don't get
  // squeezed under ~150px. True tablet/mobile widths never reach this
  // component at all -- HomeScreenMobile.tsx renders instead.
  const columns = isWide ? 6 : 4;

  return (
    <View style={[styles.grid, { gridTemplateColumns: `repeat(${columns}, 1fr)` } as any]}>
      {categories.map(cat => (
        <Pressable
          key={cat.id}
          style={({ hovered }: any) => [styles.card, hovered && styles.cardHovered]}
          onPress={() => navigation.navigate('CategoryProducts', { categoryName: cat.name })}
        >
          <CategoryIcon category={cat} />
          <Text style={styles.name} numberOfLines={1}>{cat.name}</Text>
          <Text style={styles.count}>{cat.productCount ?? 0} products</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // display:'grid' is a deliberate web-only escape hatch (same pattern as
  // DesktopHeader's `position: 'sticky' as any`) -- this component only
  // ever renders inside HomeScreenDesktop, which Metro only bundles for
  // web, so there's no native RN style-resolver to trip over the property.
  // flexWrap + a fixed card width can't guarantee an exact N-per-row (it
  // free-flows however many fit the container), which is what left the
  // old layout drifting to ~7 per row instead of the reference's 6.
  grid: { display: 'grid' as any, gap: spacing.md },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  cardHovered: {
    borderColor: colors.primary,
    transform: [{ translateY: -4 }],
    ...shadows.md,
  },
  iconBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.pageBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  iconImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  name: { fontSize: 14, fontWeight: '700', color: colors.textDark, marginBottom: 2 },
  count: { fontSize: 12, color: colors.textMuted },
});
