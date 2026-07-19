import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import { FilterOptions } from '../types/product';

interface FilterSortSheetProps {
  visible: boolean;
  onClose: () => void;
  currentFilters: FilterOptions;
  onApply: (filters: FilterOptions) => void;
}

export const FilterSortSheet: React.FC<FilterSortSheetProps> = ({ visible, onClose, currentFilters, onApply }) => {
  const [filters, setFilters] = React.useState<FilterOptions>(currentFilters);

  const handleSortChange = (sort: FilterOptions['sortBy']) => {
    setFilters({ ...filters, sortBy: sort });
  };

  const handleApply = () => {
    onApply(filters);
    onClose();
  };

  const handleClear = () => {
    const defaultFilters: FilterOptions = { sortBy: 'popular', brands: [], inStockOnly: false };
    setFilters(defaultFilters);
    onApply(defaultFilters);
    onClose();
  };

  const sortOptions: { label: string; value: FilterOptions['sortBy'] }[] = [
    { label: 'Popularity', value: 'popular' },
    { label: 'Price: Low to High', value: 'price_low_high' },
    { label: 'Price: High to Low', value: 'price_high_low' },
    { label: 'Discount', value: 'discount' },
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

            {/* In a real app, brands would be dynamic based on the category */}
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
    height: '60%',
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
    color: '#034C8C',
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
    backgroundColor: '#034C8C',
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
    backgroundColor: '#034C8C',
    borderColor: '#034C8C',
  },
  checkboxLabel: {
    fontSize: 15,
    color: '#333',
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
    backgroundColor: '#034C8C',
    borderRadius: 12,
  },
  applyBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  }
});
