import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';
import { Category } from '../../../types/product';
import { fetchCategories } from '../../../services/product.service';
import { colors, spacing, radius, shadows } from '../../../theme/tokens';
import Container from '../shared/Container';

const NAV_LINKS: { label: string; onPress: (nav: NavigationProp<any>) => void }[] = [
  { label: 'Home', onPress: nav => nav.navigate('MainTabs', { screen: 'Home' }) },
  { label: 'Services', onPress: nav => nav.navigate('MainTabs', { screen: 'Services' }) },
  { label: 'My Orders', onPress: nav => nav.navigate('MainTabs', { screen: 'Orders' }) },
  { label: 'Help Center', onPress: nav => nav.navigate('HelpCenter') },
];

// Reuses the exact same fetchCategories(vehicleType) call CategoriesScreen
// already makes -- same data, new (hover-triggered) presentation only.
export default function MegaMenu() {
  const navigation = useNavigation<NavigationProp<any>>();
  const vehicleType = useSelector((state: RootState) => state.app.vehicleType);
  const [categories, setCategories] = useState<Category[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetchCategories(vehicleType).then(setCategories);
  }, [vehicleType]);

  return (
    <View style={styles.bar}>
      <Container style={styles.row}>
        <Pressable
          onHoverIn={() => setOpen(true)}
          onHoverOut={() => setOpen(false)}
          style={styles.categoriesTrigger}
          accessibilityRole="button"
          accessibilityLabel="Browse all categories"
        >
          <Ionicons name="grid-outline" size={16} color={colors.white} />
          <Text style={styles.categoriesLabel}>All Categories</Text>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={colors.white} />

          {open && categories.length > 0 && (
            <View style={styles.panel}>
              <ScrollView style={styles.panelScroll} contentContainerStyle={styles.panelGrid}>
                {categories.map(cat => (
                  <Pressable
                    key={cat.id}
                    style={styles.panelItem}
                    onPress={() => {
                      setOpen(false);
                      navigation.navigate('CategoryProducts', { categoryName: cat.name });
                    }}
                  >
                    <Text style={styles.panelItemText} numberOfLines={1}>{cat.name}</Text>
                    <Text style={styles.panelItemCount}>{cat.productCount ?? 0} items</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
        </Pressable>

        {NAV_LINKS.map(link => (
          <Pressable
            key={link.label}
            style={({ hovered }: any) => [styles.navLink, hovered && styles.navLinkHovered]}
            onPress={() => link.onPress(navigation)}
            accessibilityRole="link"
          >
            <Text style={styles.navLinkText}>{link.label}</Text>
          </Pressable>
        ))}
      </Container>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: colors.steel },
  row: { flexDirection: 'row', alignItems: 'center', height: 44, gap: spacing.lg },
  categoriesTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: '100%',
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primary,
  },
  categoriesLabel: { color: colors.white, fontSize: 13, fontWeight: '700' },
  panel: {
    position: 'absolute' as any,
    top: '100%',
    left: 0,
    minWidth: 360,
    maxHeight: 420,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    marginTop: 1,
    zIndex: 50,
    ...shadows.lg,
  },
  panelScroll: { maxHeight: 420 },
  panelGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: spacing.sm },
  panelItem: {
    width: 180,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
  },
  panelItemText: { fontSize: 13, fontWeight: '600', color: colors.textDark },
  panelItemCount: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  navLink: { paddingVertical: 6 },
  navLinkHovered: { opacity: 0.75 },
  navLinkText: { color: colors.white, fontSize: 13, fontWeight: '600' },
});
