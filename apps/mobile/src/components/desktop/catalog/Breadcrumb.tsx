import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { colors, spacing } from '../../../theme/tokens';

export default function Breadcrumb({ categoryName }: { categoryName: string }) {
  const navigation = useNavigation<NavigationProp<any>>();
  const isSearch = categoryName === 'Search Results';

  return (
    <View style={styles.row}>
      <Pressable onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })}>
        <Text style={styles.link}>Home</Text>
      </Pressable>
      <Ionicons name="chevron-forward" size={12} color={colors.textMuted} style={styles.chevron} />
      <Pressable onPress={() => navigation.navigate('MainTabs', { screen: 'Categories' })}>
        <Text style={styles.link}>Categories</Text>
      </Pressable>
      <Ionicons name="chevron-forward" size={12} color={colors.textMuted} style={styles.chevron} />
      <Text style={styles.current} numberOfLines={1}>{isSearch ? 'Search Results' : categoryName}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
  link: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  chevron: { marginHorizontal: 6 },
  current: { fontSize: 13, color: colors.textDark, fontWeight: '700' },
});
