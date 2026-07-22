import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { colors, radius, shadows } from '../../../theme/tokens';

// Reuses CategoryProductsScreen's existing search path (categoryName:
// 'Search Results' + initialSearchQuery) -- the same one the mobile in-screen
// search box already drives -- so this is zero new backend surface.
export default function SearchBar() {
  const navigation = useNavigation<NavigationProp<any>>();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

  const runSearch = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    navigation.navigate('CategoryProducts', {
      categoryName: 'Search Results',
      initialSearchQuery: trimmed,
    });
  };

  return (
    <View style={[styles.wrapper, focused && styles.wrapperFocused]}>
      <Ionicons name="search-outline" size={18} color={colors.textMuted} style={styles.icon} />
      <TextInput
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={runSearch}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Search for parts, brands, categories..."
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        returnKeyType="search"
        accessibilityLabel="Search products"
      />
      <TouchableOpacity
        onPress={runSearch}
        style={styles.button}
        accessibilityRole="button"
        accessibilityLabel="Search"
      >
        <Ionicons name="search" size={16} color={colors.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    flex: 1,
    maxWidth: 640,
    height: 44,
    paddingLeft: 14,
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
    fontSize: 14,
    color: colors.textDark,
    outlineStyle: 'none' as any,
  },
  button: {
    height: 44,
    width: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
