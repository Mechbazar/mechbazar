import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '../../../theme/tokens';

// Visually-hidden text announced by screen readers while a skeleton is
// shown -- the shimmering boxes themselves are decorative and hidden from
// the accessibility tree (importantForAccessibility='no-hide-descendants',
// maps to aria-hidden on web) so screen reader users get one clear "Loading
// X" announcement instead of a pile of meaningless empty boxes.
function LoadingAnnouncer({ label }: { label: string }) {
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
      style={styles.visuallyHidden}
    >
      <Animated.Text>{label}</Animated.Text>
    </View>
  );
}

function useShimmer() {
  const value = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(value, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [value]);
  return value;
}

function Bone({ width, height, radiusSize = radius.sm, style }: { width: number | string; height: number; radiusSize?: number; style?: any }) {
  const opacity = useShimmer();
  return <Animated.View style={[{ width, height, borderRadius: radiusSize, backgroundColor: colors.borderLight, opacity }, style]} />;
}

export function HeroSkeleton() {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Bone width="100%" height={420} radiusSize={radius.lg} />
    </View>
  );
}

export function CategoryGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <View style={styles.categoryGrid} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.categoryItem}>
          <Bone width={64} height={64} radiusSize={32} style={{ marginBottom: spacing.sm }} />
          <Bone width={80} height={12} style={{ marginBottom: 6 }} />
          <Bone width={50} height={10} />
        </View>
      ))}
    </View>
  );
}

export function ProductCardSkeleton() {
  return (
    <View style={styles.card}>
      <Bone width="100%" height={180} radiusSize={0} />
      <View style={styles.cardInfo}>
        <Bone width={60} height={10} style={{ marginBottom: 8 }} />
        <Bone width="90%" height={13} style={{ marginBottom: 6 }} />
        <Bone width="70%" height={13} style={{ marginBottom: 10 }} />
        <Bone width={80} height={16} style={{ marginBottom: 12 }} />
        <Bone width="100%" height={34} radiusSize={radius.sm} />
      </View>
    </View>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <View style={styles.grid} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: count }).map((_, i) => <ProductCardSkeleton key={i} />)}
    </View>
  );
}

export function SectionTitleSkeleton() {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Bone width={220} height={22} style={{ marginBottom: spacing.md }} />
    </View>
  );
}

// Wraps any of the above with the single screen-reader announcement.
export function SkeletonSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View>
      <LoadingAnnouncer label={label} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  visuallyHidden: {
    position: 'absolute' as any,
    width: 1,
    height: 1,
    overflow: 'hidden',
  },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  categoryItem: {
    width: 168, backgroundColor: colors.white, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.borderLight, paddingVertical: spacing.lg, alignItems: 'center',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  card: {
    flexBasis: 220, flexGrow: 1, maxWidth: 280,
    backgroundColor: colors.white, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden',
  },
  cardInfo: { padding: spacing.sm },
});
