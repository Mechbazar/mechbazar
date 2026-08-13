import React from 'react';
import { View, Text, Image, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { Category } from '../../../types/product';
import { colors, spacing, radius } from '../../../theme/tokens';
import Container from '../shared/Container';

// A slim, always-visible quick-nav strip (Amazon's under-header department
// row) -- deliberately lighter-weight than CategoryGridDesktop's card grid
// further down the page, which stays as the fuller "Shop by Category"
// section. Same `categories` array HomeScreenDesktop already fetches (no
// new request) and the same navigate-to-CategoryProducts interaction
// CategoryGridDesktop/MegaMenu already use.
export default function CategoryNavStrip({ categories }: { categories: Category[] }) {
  const navigation = useNavigation<NavigationProp<any>>();
  if (categories.length === 0) return null;

  return (
    <View style={styles.wrapper}>
      <Container>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {categories.map(cat => (
            <Pressable
              key={cat.id}
              style={({ hovered }: any) => [styles.pill, hovered && styles.pillHovered]}
              onPress={() => navigation.navigate('CategoryProducts', { categoryName: cat.name })}
            >
              {cat.image ? (
                <Image source={{ uri: cat.image }} style={styles.pillImage} />
              ) : (
                <Text style={styles.pillEmoji}>{cat.icon || '📦'}</Text>
              )}
              <Text style={styles.pillText} numberOfLines={1}>{cat.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </Container>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    flexShrink: 0,
  },
  pillHovered: { backgroundColor: colors.pageBg },
  pillImage: { width: 18, height: 18, borderRadius: 9 },
  pillEmoji: { fontSize: 15 },
  pillText: { fontSize: 13, fontWeight: '600', color: colors.textDark },
});
