import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Modal, ScrollView } from 'react-native';
import { FilterOptions, VehicleType } from '../types/product';
import { fetchBrands } from '../services/product.service';

interface FilterSortSheetProps {
  visible: boolean;
  onClose: () => void;
  currentFilters: FilterOptions;
  onApply: (filters: FilterOptions) => void;
  // Powers the Brand section -- optional so any existing caller that hasn't
  // been updated yet just doesn't get a brand list, rather than crashing.
  vehicleType?: VehicleType;
}

const RATING_OPTIONS = [4, 3, 2, 1];

export const FilterSortSheet: React.FC<FilterSortSheetProps> = ({ visible, onClose, currentFilters, onApply, vehicleType }) => {
  const [filters, setFilters] = React.useState<FilterOptions>(currentFilters);
  const [priceMinText, setPriceMinText] = useState(currentFilters.priceMin != null ? String(currentFilters.priceMin) : '');
  const [priceMaxText, setPriceMaxText] = useState(currentFilters.priceMax != null ? String(currentFilters.priceMax) : '');
  const [brands, setBrands] = useState<string[]>([]);

  useEffect(() => {
    if (visible) setFilters(currentFilters);
  }, [visible, currentFilters]);

  useEffect(() => {
    if (visible && vehicleType) fetchBrands(vehicleType).then(setBrands);
  }, [visible, vehicleType]);

  const handleSortChange = (sort: FilterOptions['sortBy']) => {
    setFilters({ ...filters, sortBy: sort });
  };

  const toggleBrand = (brand: string) => {
    const next = filters.brands.includes(brand)
      ? filters.brands.filter(b => b !== brand)
      : [...filters.brands, brand];
    setFilters({ ...filters, brands: next });
  };

  const handleApply = () => {
    const min = priceMinText.trim() ? Number(priceMinText) : undefined;
    const max = priceMaxText.trim() ? Number(priceMaxText) : undefined;
    onApply({
      ...filters,
      priceMin: Number.isFinite(min!) ? min : undefined,
      priceMax: Number.isFinite(max!) ? max : undefined,
    });
    onClose();
  };

  const handleClear = () => {
    const defaultFilters: FilterOptions = { sortBy: 'popular', brands: [], inStockOnly: false };
    setFilters(defaultFilters);
    setPriceMinText('');
    setPriceMaxText('');
    onApply(defaultFilters);
    onClose();
  };

  const sortOptions: { label: string; value: FilterOptions['sortBy'] }[] = [
    { label: 'Popularity', value: 'popular' },
    { label: 'Price: Low to High', value: 'price_low_high' },
    { label: 'Price: High to Low', value: 'price_high_low' },
    { label: 'Discount', value: 'discount' },
    { label: 'Rating', value: 'rating' },
    { label: 'Newest', value: 'newest' },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Filter & Sort</Text>
            <TouchableOpacity onPress={onClose}><Text style={styles.closeBtn}>✕</Text></TouchableOpacity>
          </View>

          <ScrollView style={styles.body}>
            <Text style={styles.sectionTitle}>Sort By</Text>
            {sortOptions.map(option => (
              <TouchableOpacity
                key={option.value}
                style={styles.radioRow}
                onPress={() => handleSortChange(option.value)}
              >
                <Text style={[styles.radioLabel, filters.sortBy === option.value && styles.radioLabelActive]}>
                  {option.label}
                </Text>
                <View style={styles.radioCircle}>
                  {filters.sortBy === option.value && <View style={styles.radioInner} />}
                </View>
              </TouchableOpacity>
            ))}

            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Availability</Text>
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setFilters({ ...filters, inStockOnly: !filters.inStockOnly })}
            >
              <View style={[styles.checkbox, filters.inStockOnly && styles.checkboxActive]}>
                {filters.inStockOnly && <Text style={{ color: '#fff', fontSize: 12 }}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>In Stock Only</Text>
            </TouchableOpacity>

            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Price</Text>
            <View style={styles.priceRow}>
              <TextInput
                style={styles.priceInput}
                placeholder="Min"
                keyboardType="numeric"
                value={priceMinText}
                onChangeText={setPriceMinText}
              />
              <Text style={styles.priceDash}>-</Text>
              <TextInput
                style={styles.priceInput}
                placeholder="Max"
                keyboardType="numeric"
                value={priceMaxText}
                onChangeText={setPriceMaxText}
              />
            </View>

            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Rating</Text>
            {RATING_OPTIONS.map(r => (
              <TouchableOpacity
                key={r}
                style={styles.radioRow}
                onPress={() => setFilters({ ...filters, minRating: filters.minRating === r ? undefined : r })}
              >
                <Text style={styles.radioLabel}>{r}★ &amp; up</Text>
                <View style={styles.radioCircle}>
                  {filters.minRating === r && <View style={styles.radioInner} />}
                </View>
              </TouchableOpacity>
            ))}

            {brands.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Brand</Text>
                {brands.map(brand => (
                  <TouchableOpacity
                    key={brand}
                    style={styles.checkboxRow}
                    onPress={() => toggleBrand(brand)}
                  >
                    <View style={[styles.checkbox, filters.brands.includes(brand) && styles.checkboxActive]}>
                      {filters.brands.includes(brand) && <Text style={{ color: '#fff', fontSize: 12 }}>✓</Text>}
                    </View>
                    <Text style={styles.checkboxLabel}>{brand}</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
              <Text style={styles.clearBtnText}>Clear All</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyBtn} onPress={handleApply}>
              <Text style={styles.applyBtnText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '75%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeBtn: {
    fontSize: 20,
    color: '#666',
  },
  body: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  radioRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#f5f5f5',
  },
  radioLabel: {
    fontSize: 15,
    color: '#333',
  },
  radioLabelActive: {
    fontWeight: '600',
    color: '#DA3830',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#DA3830',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#ccc',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxActive: {
    backgroundColor: '#DA3830',
    borderColor: '#DA3830',
  },
  checkboxLabel: {
    fontSize: 15,
    color: '#333',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  priceInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#333',
  },
  priceDash: {
    color: '#999',
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderColor: '#eee',
    paddingBottom: 40, // Safe area for iPhone
  },
  clearBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    marginRight: 12,
  },
  clearBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  applyBtn: {
    flex: 2,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DA3830',
    borderRadius: 12,
  },
  applyBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  }
});
