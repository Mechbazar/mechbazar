import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { Category } from '../../../types/product';
import { colors, spacing, radius, shadows } from '../../../theme/tokens';

// Same Category[] shape HomeScreen/CategoriesScreen already fetch via
// fetchCategories(vehicleType) -- no new data source, desktop-only layout.
export default function CategoryGridDesktop({ categories }: { categories: Category[] }) {
  const navigation = useNavigation<NavigationProp<any>>();

  return (
    <View style={styles.grid}>
      {categories.map(cat => (
        <Pressable
          key={cat.id}
          style={({ hovered }: any) => [styles.card, hovered && styles.cardHovered]}
          onPress={() => navigation.navigate('CategoryProducts', { categoryName: cat.name })}
        >
          <View style={styles.iconBox}>
            {cat.image ? (
              <Image source={{ uri: cat.image }} style={styles.iconImage} />
            ) : (
              <Text style={styles.iconEmoji}>{cat.icon || '📦'}</Text>
            )}
          </View>
          <Text style={styles.name} numberOfLines={1}>{cat.name}</Text>
          <Text style={styles.count}>{cat.productCount ?? 0} products</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  card: {
    width: 168,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  cardHovered: {
    borderColor: colors.primary,
    transform: [{ translateY: -4 }],
    ...shadows.md,
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.pageBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  iconImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  iconEmoji: { fontSize: 30 },
  name: { fontSize: 14, fontWeight: '700', color: colors.textDark, marginBottom: 2 },
  count: { fontSize: 12, color: colors.textMuted },
});
