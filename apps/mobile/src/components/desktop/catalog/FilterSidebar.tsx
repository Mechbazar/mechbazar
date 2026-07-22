import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Category, FilterOptions } from '../../../types/product';
import { colors, spacing, radius } from '../../../theme/tokens';

interface FilterSidebarProps {
  filters: FilterOptions;
  onChange: (next: FilterOptions) => void;
  availableBrands: string[];
  categories: Category[];
  currentCategoryName: string;
  onCategoryChange: (categoryName: string) => void;
}

function SectionCollapse({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={styles.section}>
      <Pressable style={styles.sectionHeader} onPress={() => setOpen(o => !o)}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Ionicons name={open ? 'remove' : 'add'} size={16} color={colors.textMuted} />
      </Pressable>
      {open && <View style={styles.sectionBody}>{children}</View>}
    </View>
  );
}

function Checkbox({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <Pressable style={styles.checkboxRow} onPress={onToggle} accessibilityRole="checkbox" accessibilityState={{ checked }}>
      <View style={[styles.checkboxBox, checked && styles.checkboxBoxChecked]}>
        {checked && <Ionicons name="checkmark" size={12} color={colors.white} />}
      </View>
      <Text style={styles.checkboxLabel} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const RATING_OPTIONS = [4, 3, 2, 1];

export default function FilterSidebar({
  filters, onChange, availableBrands, categories, currentCategoryName, onCategoryChange,
}: FilterSidebarProps) {
  const [priceMinText, setPriceMinText] = useState(filters.priceMin != null ? String(filters.priceMin) : '');
  const [priceMaxText, setPriceMaxText] = useState(filters.priceMax != null ? String(filters.priceMax) : '');

  const toggleBrand = (brand: string) => {
    const next = filters.brands.includes(brand)
      ? filters.brands.filter(b => b !== brand)
      : [...filters.brands, brand];
    onChange({ ...filters, brands: next });
  };

  const applyPriceRange = () => {
    const min = priceMinText.trim() ? Number(priceMinText) : undefined;
    const max = priceMaxText.trim() ? Number(priceMaxText) : undefined;
    onChange({ ...filters, priceMin: Number.isFinite(min!) ? min : undefined, priceMax: Number.isFinite(max!) ? max : undefined });
  };

  return (
    <ScrollView style={styles.sidebar} showsVerticalScrollIndicator={false}>
      <SectionCollapse title="Category">
        {categories.map(cat => (
          <Pressable key={cat.id} style={styles.categoryRow} onPress={() => onCategoryChange(cat.name)}>
            <Text style={[styles.categoryText, cat.name === currentCategoryName && styles.categoryTextActive]} numberOfLines={1}>
              {cat.name}
            </Text>
            <Text style={styles.categoryCount}>{cat.productCount ?? 0}</Text>
          </Pressable>
        ))}
      </SectionCollapse>

      <SectionCollapse title="Brand">
        {availableBrands.length === 0 ? (
          <Text style={styles.emptyText}>No brands in this result set</Text>
        ) : (
          availableBrands.map(brand => (
            <Checkbox key={brand} label={brand} checked={filters.brands.includes(brand)} onToggle={() => toggleBrand(brand)} />
          ))
        )}
      </SectionCollapse>

      <SectionCollapse title="Price">
        <View style={styles.priceRow}>
          <TextInput
            style={styles.priceInput}
            placeholder="Min"
            keyboardType="numeric"
            value={priceMinText}
            onChangeText={setPriceMinText}
            onSubmitEditing={applyPriceRange}
            onBlur={applyPriceRange}
          />
          <Text style={styles.priceDash}>-</Text>
          <TextInput
            style={styles.priceInput}
            placeholder="Max"
            keyboardType="numeric"
            value={priceMaxText}
            onChangeText={setPriceMaxText}
            onSubmitEditing={applyPriceRange}
            onBlur={applyPriceRange}
          />
        </View>
      </SectionCollapse>

      <SectionCollapse title="Availability">
        <Checkbox
          label="In Stock Only"
          checked={filters.inStockOnly}
          onToggle={() => onChange({ ...filters, inStockOnly: !filters.inStockOnly })}
        />
      </SectionCollapse>

      <SectionCollapse title="Rating">
        {RATING_OPTIONS.map(r => (
          <Pressable
            key={r}
            style={styles.ratingRow}
            onPress={() => onChange({ ...filters, minRating: filters.minRating === r ? undefined : r })}
          >
            <View style={[styles.radioOuter, filters.minRating === r && styles.radioOuterActive]}>
              {filters.minRating === r && <View style={styles.radioInner} />}
            </View>
            <View style={styles.ratingStars}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Ionicons key={i} name={i < r ? 'star' : 'star-outline'} size={13} color="#F5A300" />
              ))}
            </View>
            <Text style={styles.ratingLabel}>&amp; up</Text>
          </Pressable>
        ))}
      </SectionCollapse>

      {(filters.brands.length > 0 || filters.inStockOnly || filters.priceMin != null || filters.priceMax != null || filters.minRating != null) && (
        <Pressable
          style={styles.clearAllBtn}
          onPress={() => {
            setPriceMinText(''); setPriceMaxText('');
            onChange({ sortBy: filters.sortBy, brands: [], inStockOnly: false });
          }}
        >
          <Text style={styles.clearAllText}>Clear All Filters</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sidebar: { width: 260, flexShrink: 0 },
  section: { borderBottomWidth: 1, borderBottomColor: colors.borderLight, paddingVertical: spacing.sm },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.textDark },
  sectionBody: { paddingTop: 6, gap: 8 },
  emptyText: { fontSize: 12, color: colors.textMuted },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkboxBox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: colors.borderLight, alignItems: 'center', justifyContent: 'center' },
  checkboxBoxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxLabel: { fontSize: 13, color: colors.textDark, flexShrink: 1 },
  categoryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  categoryText: { fontSize: 13, color: colors.textMuted, flexShrink: 1 },
  categoryTextActive: { color: colors.primary, fontWeight: '700' },
  categoryCount: { fontSize: 11, color: colors.textMuted },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  priceInput: {
    flex: 1, height: 36, borderWidth: 1, borderColor: colors.borderLight, borderRadius: radius.sm,
    paddingHorizontal: 10, fontSize: 13, color: colors.textDark,
  },
  priceDash: { color: colors.textMuted },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  radioOuter: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: colors.borderLight, alignItems: 'center', justifyContent: 'center' },
  radioOuterActive: { borderColor: colors.primary },
  radioInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  ratingStars: { flexDirection: 'row', gap: 1 },
  ratingLabel: { fontSize: 12, color: colors.textMuted },
  clearAllBtn: { paddingVertical: spacing.sm, alignItems: 'center' },
  clearAllText: { fontSize: 13, color: colors.danger, fontWeight: '700' },
});
