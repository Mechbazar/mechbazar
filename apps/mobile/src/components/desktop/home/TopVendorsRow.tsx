import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { colors, spacing, radius, shadows } from '../../../theme/tokens';
import { TopVendor } from '../../../services/vendor.service';

// Real vendors ranked by fulfilled sales (GET /vendors/top -- storeName/
// categories/productCount/salesCount only, no KYC data). Tapping a vendor
// searches the catalog for their store name, since there's no dedicated
// per-vendor storefront screen in this codebase yet.
export default function TopVendorsRow({ vendors }: { vendors: TopVendor[] }) {
  const navigation = useNavigation<NavigationProp<any>>();
  if (vendors.length === 0) return null;

  return (
    <View style={styles.row}>
      {vendors.map(v => (
        <Pressable
          key={v.id}
          style={({ hovered }: any) => [styles.card, hovered && styles.cardHovered]}
          onPress={() => navigation.navigate('CategoryProducts', { categoryName: 'Search Results', initialSearchQuery: v.storeName })}
        >
          <View style={styles.avatar}>
            <Ionicons name="storefront" size={22} color={colors.primary} />
          </View>
          <Text style={styles.name} numberOfLines={1}>{v.storeName}</Text>
          <Text style={styles.meta}>{v.productCount} product{v.productCount === 1 ? '' : 's'}</Text>
          {v.salesCount > 0 && <Text style={styles.meta}>{v.salesCount}+ sold</Text>}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  card: {
    flexGrow: 1,
    flexBasis: 180,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
    alignItems: 'center',
  },
  cardHovered: { ...shadows.md, borderColor: colors.primary },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#FFF0EE', alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  name: { fontSize: 14, fontWeight: '700', color: colors.textDark, marginBottom: 2, textAlign: 'center' },
  meta: { fontSize: 11, color: colors.textMuted },
});
