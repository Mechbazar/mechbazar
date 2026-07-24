import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';
import { fetchSearchSuggestions, SearchSuggestion } from '../../../services/product.service';
import { colors, radius, shadows, spacing } from '../../../theme/tokens';

const DEBOUNCE_MS = 250;

// Reuses CategoryProductsScreen's existing search path (categoryName:
// 'Search Results' + initialSearchQuery) for the full results page -- the
// dropdown below is purely an autocomplete layer on top of that, backed by
// GET /products/suggestions.
export default function SearchBar() {
  const navigation = useNavigation<NavigationProp<any>>();
  const vehicleType = useSelector((state: RootState) => state.app.vehicleType);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    debounceRef.current = setTimeout(() => {
      fetchSearchSuggestions(query, vehicleType, { signal: controller.signal })
        .then(setSuggestions)
        .finally(() => setLoading(false));
    }, DEBOUNCE_MS);
    return () => { clearTimeout(debounceRef.current); controller.abort(); };
  }, [query, vehicleType]);

  const runSearch = (text?: string) => {
    const trimmed = (text ?? query).trim();
    if (!trimmed) return;
    setFocused(false);
    setSuggestions([]);
    navigation.navigate('CategoryProducts', {
      categoryName: 'Search Results',
      initialSearchQuery: trimmed,
    });
  };

  const openProduct = (id: string) => {
    setFocused(false);
    setSuggestions([]);
    navigation.navigate('ProductDetails', { productId: id });
  };

  const showDropdown = focused && query.trim().length >= 2;

  return (
    <View style={styles.container}>
      <View style={[styles.wrapper, focused && styles.wrapperFocused]}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} style={styles.icon} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => runSearch()}
          onFocus={() => setFocused(true)}
          // Delayed so a tap on a dropdown row registers before the list unmounts.
          onBlur={() => { blurTimeoutRef.current = setTimeout(() => setFocused(false), 150); }}
          placeholder="Search for parts, brands, categories..."
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          returnKeyType="search"
          accessibilityLabel="Search products"
        />
        <TouchableOpacity
          onPress={() => runSearch()}
          style={styles.button}
          accessibilityRole="button"
          accessibilityLabel="Search"
        >
          <Ionicons name="search" size={16} color={colors.white} />
        </TouchableOpacity>
      </View>

      {showDropdown && (
        <View style={styles.dropdown}>
          {loading ? (
            <View style={styles.dropdownState}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : suggestions.length === 0 ? (
            <View style={styles.dropdownState}>
              <Text style={styles.emptyText}>No matches for "{query.trim()}"</Text>
            </View>
          ) : (
            <>
              {suggestions.map(s => (
                <Pressable
                  key={s.id}
                  style={({ hovered }: any) => [styles.suggestionRow, hovered && styles.suggestionRowHovered]}
                  onPress={() => openProduct(s.id)}
                >
                  <Image source={{ uri: s.image }} style={styles.suggestionImage} />
                  <View style={styles.suggestionInfo}>
                    <Text style={styles.suggestionName} numberOfLines={1}>{s.name}</Text>
                    <Text style={styles.suggestionMeta} numberOfLines={1}>{s.categoryName}</Text>
                  </View>
                  <Text style={styles.suggestionPrice}>₹{s.price}</Text>
                </Pressable>
              ))}
              <Pressable style={styles.seeAllRow} onPress={() => runSearch()}>
                <Text style={styles.seeAllText}>See all results for "{query.trim()}"</Text>
                <Ionicons name="arrow-forward" size={14} color={colors.primary} />
              </Pressable>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minWidth: 160, maxWidth: 480, position: 'relative', zIndex: 20 },
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    height: 40,
    paddingLeft: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  // Replaces the native input outline (suppressed below so it doesn't clash
  // with the pill container) with an equivalent visible focus indicator --
  // without this, keyboard users tabbing into the search box would see no
  // focus indication at all.
  wrapperFocused: { borderColor: colors.primary, ...shadows.sm },
  icon: { marginRight: 8 },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 13,
    color: colors.textDark,
    outlineStyle: 'none' as any,
  },
  button: {
    height: 40,
    width: 42,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdown: {
    position: 'absolute',
    top: 46,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.lg,
    overflow: 'hidden',
    maxHeight: 400,
  },
  dropdownState: { padding: spacing.lg, alignItems: 'center' },
  emptyText: { fontSize: 13, color: colors.textMuted },
  suggestionRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  suggestionRowHovered: { backgroundColor: colors.pageBg },
  suggestionImage: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.pageBg },
  suggestionInfo: { flex: 1, minWidth: 0 },
  suggestionName: { fontSize: 13, fontWeight: '600', color: colors.textDark },
  suggestionMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  suggestionPrice: { fontSize: 13, fontWeight: '700', color: colors.textDark },
  seeAllRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: spacing.sm, backgroundColor: colors.pageBg,
  },
  seeAllText: { fontSize: 12, fontWeight: '700', color: colors.primary },
});
