import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { Category } from '../../../types/product';
import { colors, spacing, radius, shadows } from '../../../theme/tokens';

// Marketplace-style promo cards (brief section 6) built entirely from real
// Category rows -- no invented categories/copy. HomeScreenDesktop passes in
// the categories that have a real image, sorted by productCount, so this
// component just lays out whatever it's given; it renders nothing if no
// category qualifies rather than falling back to placeholder content.
export default function PromoCategoryCards({ categories }: { categories: Category[] }) {
  const navigation = useNavigation<NavigationProp<any>>();
  if (categories.length === 0) return null;

  return (
    <View style={styles.grid}>
      {categories.map(cat => (
        <Pressable
          key={cat.id}
          style={({ hovered }: any) => [styles.card, hovered && styles.cardHovered]}
          onPress={() => navigation.navigate('CategoryProducts', { categoryName: cat.name })}
        >
          <Image source={{ uri: cat.image! }} style={styles.image} resizeMode="cover" />
          <View style={styles.overlay} />
          <View style={styles.textBlock}>
            <Text style={styles.title}>{cat.name}</Text>
            <Text style={styles.subtitle}>{cat.productCount ?? 0} products available</Text>
            <View style={styles.cta}>
              <Text style={styles.ctaText}>Explore</Text>
            </View>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  card: {
    flexGrow: 1,
    flexBasis: 300,
    height: 160,
    borderRadius: radius.lg,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colors.darkInk,
  },
  cardHovered: { ...shadows.md },
  image: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(17,17,18,0.4)' },
  textBlock: { flex: 1, justifyContent: 'flex-end', padding: spacing.lg },
  title: { color: colors.white, fontSize: 20, fontWeight: '800', marginBottom: 4 },
  subtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginBottom: 12 },
  cta: {
    alignSelf: 'flex-start',
    backgroundColor: colors.white,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  ctaText: { color: colors.textDark, fontSize: 12, fontWeight: '700' },
});
