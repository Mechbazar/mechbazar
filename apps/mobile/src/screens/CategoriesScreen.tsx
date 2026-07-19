import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { Category } from '../types/product';
import { fetchCategories } from '../services/product.service';
import { HeaderCartButton } from '../components/HeaderCartButton';

// MechBazar Brand Colors (New Design System) -- matches HomeScreen/CartScreen
const colors = {
  primary: '#E23B22',
  darkInk: '#161B21',
  steel: '#242C35',
  pageBg: '#F3F4F6',
  white: '#FFFFFF',
  borderLight: '#E3E6EA',
  textMuted: '#6B7480',
};

export default function CategoriesScreen() {
  const navigation = useNavigation<any>();
  const vehicleType = useSelector((state: RootState) => state.app.vehicleType);

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCategories = useCallback(() => {
    setLoading(true);
    fetchCategories(vehicleType)
      .then(setCategories)
      .finally(() => setLoading(false));
  }, [vehicleType]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // Refresh product counts whenever the tab regains focus (e.g. after browsing a category).
  useFocusEffect(
    useCallback(() => {
      loadCategories();
    }, [loadCategories])
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>All Categories</Text>
        <HeaderCartButton color="#FFFFFF" backgroundColor="rgba(255,255,255,0.15)" />
      </View>

      {loading && categories.length === 0 ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : categories.length === 0 ? (
        <View style={styles.loaderContainer}>
          <Text style={styles.emptyText}>No categories available</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
          {categories.map(cat => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.card, !cat.productCount && styles.cardDimmed]}
              onPress={() => navigation.navigate('CategoryProducts', { categoryName: cat.name })}
              activeOpacity={0.85}
            >
              <View style={styles.iconBox}>
                {cat.image ? (
                  <Image source={{ uri: cat.image }} style={styles.iconImage} />
                ) : (
                  <Text style={styles.iconEmoji}>{cat.icon || '📦'}</Text>
                )}
              </View>
              <Text style={styles.cardTitle} numberOfLines={1}>{cat.name}</Text>
              <Text style={styles.cardCount}>{cat.productCount ?? 0} products</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.pageBg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.darkInk,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.white },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 15, color: colors.textMuted },
  grid: {
    padding: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardDimmed: { opacity: 0.55 },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.pageBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    overflow: 'hidden',
  },
  iconImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  iconEmoji: { fontSize: 26 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.darkInk, marginBottom: 4, textAlign: 'center' },
  cardCount: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
});
