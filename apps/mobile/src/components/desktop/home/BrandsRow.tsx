import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { colors, spacing, radius } from '../../../theme/tokens';

// Brand names are derived from the already-fetched trending products list
// (real product.brand values) rather than a dedicated brands endpoint --
// none exists today.
export default function BrandsRow({ brands }: { brands: string[] }) {
  const navigation = useNavigation<NavigationProp<any>>();
  if (brands.length === 0) return null;

  return (
    <View style={styles.row}>
      {brands.map(brand => (
        <Pressable
          key={brand}
          style={({ hovered }: any) => [styles.chip, hovered && styles.chipHovered]}
          onPress={() => navigation.navigate('CategoryProducts', { categoryName: 'Search Results', initialSearchQuery: brand })}
        >
          <Text style={styles.chipText}>{brand}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  chipHovered: { borderColor: colors.primary, backgroundColor: '#FFF5F3' },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.textDark },
});
