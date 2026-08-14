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
  // Separate hover/click signals, not one `open` boolean: a real mouse click
  // always hovers the target first (onHoverIn fires on the way in), so a
  // naive onPress={() => setOpen(o => !o)} was toggling the just-opened-by-
  // hover panel immediately closed again on every click -- reproduced live,
  // the flyout opened on hover then snapped shut the instant it was clicked.
  // `clicked` only ever gets cleared on hover-out, so a click while hovering
  // can open/keep-open but never fight the hover state closed.
  const [hovered, setHovered] = useState(false);
  const [clicked, setClicked] = useState(false);
  const open = hovered || clicked;

  useEffect(() => {
    fetchCategories(vehicleType).then(setCategories);
  }, [vehicleType]);

  const close = () => { setHovered(false); setClicked(false); };

  return (
    <Pressable
      onHoverIn={() => setHovered(true)}
      onHoverOut={close}
      onPress={() => setClicked(c => !c)}
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
                onPress={(e) => {
                  e.stopPropagation();
                  close();
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
    // No marginTop -- touches the trigger's bottom edge directly so there's
    // no dead-zone gap for the mouse to cross (see DesktopHeader.tsx's
    // accountPanel for the full explanation of why a gap here breaks hover).
    top: '100%',
    left: 0,
    minWidth: 360,
    maxHeight: 420,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    zIndex: 50,
    ...shadows.lg,
  },
  panelScroll: { maxHeight: 420 },
  panelGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: spacing.sm, paddingTop: 12 },
  panelItem: {
    width: 180,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
  },
  panelItemText: { fontSize: 13, fontWeight: '600', color: colors.textDark },
  panelItemCount: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
});
