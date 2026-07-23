import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';
import { Category } from '../../../types/product';
import { fetchCategories } from '../../../services/product.service';
import { colors, spacing, radius, shadows } from '../../../theme/tokens';

// Just the "All Categories" dropdown trigger + flyout panel -- rendered
// inline inside DesktopHeader's single row (no own background/height/
// Container of its own; the header-height-reduction pass folded the old
// standalone nav-links bar this used to render into the header row itself,
// keeping only "Services" there -- see DesktopHeader.tsx). Reuses the exact
// same fetchCategories(vehicleType) call CategoriesScreen already makes --
// same data, new (hover-triggered) presentation only.
export default function MegaMenu() {
  const navigation = useNavigation<NavigationProp<any>>();
  const vehicleType = useSelector((state: RootState) => state.app.vehicleType);
  const [categories, setCategories] = useState<Category[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetchCategories(vehicleType).then(setCategories);
  }, [vehicleType]);

  return (
    <Pressable
      onHoverIn={() => setOpen(true)}
      onHoverOut={() => setOpen(false)}
      onPress={() => setOpen(o => !o)}
      style={styles.categoriesTrigger}
      accessibilityRole="button"
      accessibilityLabel="Browse all categories"
      accessibilityState={{ expanded: open }}
    >
      <Ionicons name="grid-outline" size={15} color={colors.white} />
      <Text style={styles.categoriesLabel}>All Categories</Text>
      <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={13} color={colors.white} />

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
  );
}

const styles = StyleSheet.create({
  categoriesTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    flexShrink: 0,
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
    marginTop: 4,
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
});
