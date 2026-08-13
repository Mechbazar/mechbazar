import React, { useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { HomeBrand } from '../../../services/product.service';
import { colors, spacing, radius, shadows } from '../../../theme/tokens';

const AVATAR_PALETTE = ['#FDEDEC', '#EBFBEE', '#E8F7FF', '#FFF7E6', '#F3E8FF'];

function BrandCard({ brand }: { brand: HomeBrand }) {
  const navigation = useNavigation<NavigationProp<any>>();
  const [logoFailed, setLogoFailed] = useState(false);
  const showLogo = !!brand.logo && !logoFailed;
  const paletteColor = AVATAR_PALETTE[Math.abs(hashCode(brand.name)) % AVATAR_PALETTE.length];

  return (
    <Pressable
      style={({ hovered }: any) => [styles.card, hovered && styles.cardHovered]}
      onPress={() => navigation.navigate('CategoryProducts', { categoryName: 'Search Results', initialSearchQuery: brand.name })}
    >
      {showLogo ? (
        <Image source={{ uri: brand.logo! }} style={styles.logo} resizeMode="contain" onError={() => setLogoFailed(true)} />
      ) : (
        <View style={[styles.avatar, { backgroundColor: paletteColor }]}>
          <Text style={styles.avatarText}>{brand.name.charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <Text style={styles.name} numberOfLines={1}>{brand.name}</Text>
    </Pressable>
  );
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
}

// Real Brand rows (id/name/logo) from fetchHomeExtras (GET /api/home) --
// previously this row showed plain text chips of brand names guessed
// client-side from the currently-fetched product list, and Brand.logo (a
// real Prisma field) was never rendered anywhere. Falls back to a colored
// initial circle when a brand has no logo uploaded yet, which is the common
// case in prod today, not a rare edge case.
export default function BrandsRow({ brands }: { brands: HomeBrand[] }) {
  if (brands.length === 0) return null;

  return (
    <View style={styles.row}>
      {brands.map(brand => <BrandCard key={brand.id} brand={brand} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  card: {
    width: 140,
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  cardHovered: { borderColor: colors.primary, ...shadows.sm },
  logo: { width: 56, height: 56, marginBottom: spacing.sm },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm,
  },
  avatarText: { fontSize: 22, fontWeight: '800', color: colors.textDark },
  name: { fontSize: 13, fontWeight: '700', color: colors.textDark },
});
