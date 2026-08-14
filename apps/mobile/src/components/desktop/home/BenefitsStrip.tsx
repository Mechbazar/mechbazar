import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchTotalProductCount } from '../../../services/product.service';
import { colors, spacing, radius } from '../../../theme/tokens';

// Minimal 4-column benefits strip below the trust banner. "Wide Range"
// fetches the real catalog size (GET /products' X-Total-Count header, same
// header getCategoryProducts already reads) instead of hardcoding a number
// that would go stale as vendors add stock -- falls back to non-numeric
// copy if the fetch fails rather than showing a made-up figure. The other
// three are the same non-numeric claims (competitive pricing, delivery,
// 24x7 support) already made elsewhere on this page (QuickActions'
// "Emergency Assistance" card, the old TrustBadges strip).
const ICON_CONFIG: { icon: keyof typeof Ionicons.glyphMap; tint: string }[] = [
  { icon: 'apps-outline', tint: '#1C7ED6' },
  { icon: 'pricetag-outline', tint: '#2B8A3E' },
  { icon: 'rocket-outline', tint: '#E8890C' },
  { icon: 'headset-outline', tint: colors.primary },
];

export default function BenefitsStrip() {
  const [productCount, setProductCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchTotalProductCount().then(total => { if (!cancelled) setProductCount(total); });
    return () => { cancelled = true; };
  }, []);

  const items = [
    { title: 'Wide Range', subtitle: productCount ? `${productCount}+ Products` : 'Extensive Parts Catalog' },
    { title: 'Best Prices', subtitle: 'Competitive Pricing' },
    { title: 'Fast Delivery', subtitle: 'Quick & Reliable' },
    { title: 'Expert Support', subtitle: '24x7 Assistance' },
  ];

  return (
    <View style={styles.strip}>
      {items.map((item, i) => (
        <View key={item.title} style={styles.item}>
          <Ionicons name={ICON_CONFIG[i].icon} size={22} color={ICON_CONFIG[i].tint} />
          <View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtitle}>{item.subtitle}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.lg,
    backgroundColor: colors.pageBg,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexGrow: 1, flexBasis: 200 },
  title: { fontSize: 14, fontWeight: '700', color: colors.textDark },
  subtitle: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
});
