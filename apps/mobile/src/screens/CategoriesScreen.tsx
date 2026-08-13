import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { Category } from '../types/product';
import { fetchCategories, NO_IMAGE_PLACEHOLDER } from '../services/product.service';
import { HeaderCartButton } from '../components/HeaderCartButton';
import { useStableIsDesktopUp } from '../hooks/useStableIsDesktopUp';
import { setDesktopFullPageScreenActive } from '../navigation/desktopFullPageScreenStore';
import CompactBookingShell from '../components/desktop/shared/CompactBookingShell';
import MinimalFooter from '../components/desktop/shared/MinimalFooter';
import ErrorState, { classifyError, ErrorKind } from '../components/desktop/states/ErrorState';
import { useIsDarkMode } from '../theme/useThemeColors';
import { useTranslation } from 'react-i18next';

// `darkInk` is a fixed dark header bar (unchanged in dark mode); `textDark`
// is the actual body-text ink, which does invert. `white` is text-on-that-
// bar blended with card backgrounds -- `surface` is the one that inverts.
const LIGHT_COLORS = {
  primary: '#DA3830',
  darkInk: '#1B1B1B',
  steel: '#242C35',
  pageBg: '#F8F9FA',
  white: '#FFFFFF',
  surface: '#FFFFFF',
  textDark: '#1B1B1B',
  borderLight: '#E3E6EA',
  textMuted: '#6B7480',
};

const DARK_COLORS: typeof LIGHT_COLORS = {
  primary: '#FF5A4E',
  darkInk: '#1B1B1B',
  steel: '#242C35',
  pageBg: '#121212',
  white: '#FFFFFF',
  surface: '#1E1E1E',
  textDark: '#F1F2F4',
  borderLight: '#2E2E2E',
  textMuted: '#A6ACB5',
};

// Gentle opacity pulse for skeleton placeholders -- a static gray block reads
// as "stuck", a pulse reads as "loading" without needing a spinner.
function SkeletonCard({ styles }: { styles: ReturnType<typeof createStyles> }) {
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, easing: Easing.ease, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, easing: Easing.ease, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View style={[styles.card, styles.skeletonCard, { opacity }]}>
      <View style={styles.skeletonCircle} />
      <View style={styles.skeletonLineWide} />
      <View style={styles.skeletonLineNarrow} />
    </Animated.View>
  );
}

export default function CategoriesScreen() {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const vehicleType = useSelector((state: RootState) => state.app.vehicleType);
  const colors = useIsDarkMode() ? DARK_COLORS : LIGHT_COLORS;
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ErrorKind | null>(null);
  const [failedImageIds, setFailedImageIds] = useState<Record<string, boolean>>({});

  const loadCategories = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchCategories(vehicleType, { rethrow: true })
      .then(setCategories)
      .catch(err => setError(classifyError(err)))
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

  const isDesktopUp = useStableIsDesktopUp();
  useFocusEffect(
    useCallback(() => {
      if (!isDesktopUp) return;
      setDesktopFullPageScreenActive(true);
      return () => setDesktopFullPageScreenActive(false);
    }, [isDesktopUp]),
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerTextBlock}>
          <Text style={styles.headerTitle}>{t('categories.allCategories')}</Text>
          <Text style={styles.headerSubtitle}>{t('categories.subtitle')}</Text>
        </View>
        <HeaderCartButton color={colors.textDark} backgroundColor={colors.pageBg} />
      </View>

      <CompactBookingShell maxWidth={880} style={styles.flexFill}>
      {loading && categories.length === 0 ? (
        <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} styles={styles} />
          ))}
        </ScrollView>
      ) : error && categories.length === 0 ? (
        <ErrorState kind={error} onRetry={loadCategories} compact />
      ) : categories.length === 0 ? (
        <View style={styles.loaderContainer}>
          <Ionicons name="file-tray-outline" size={40} color={colors.textMuted} style={styles.emptyIcon} />
          <Text style={styles.emptyText}>{t('categories.noCategoriesAvailable')}</Text>
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
                  <Image
                    source={{ uri: failedImageIds[cat.id] ? NO_IMAGE_PLACEHOLDER : cat.image }}
                    style={styles.iconImage}
                    resizeMode="cover"
                    onError={() => setFailedImageIds(prev => ({ ...prev, [cat.id]: true }))}
                  />
                ) : (
                  <Text style={styles.iconEmoji}>{cat.icon || '📦'}</Text>
                )}
              </View>
              <Text style={styles.cardTitle} numberOfLines={2}>{cat.name}</Text>
              <Text style={styles.cardCount}>{t('categories.productsCount', { count: cat.productCount ?? 0 })}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      </CompactBookingShell>
      <CompactBookingShell maxWidth={880}>
        <MinimalFooter />
      </CompactBookingShell>
    </SafeAreaView>
  );
}

const createStyles = (colors: typeof LIGHT_COLORS) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.pageBg },
  flexFill: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  headerTextBlock: { flex: 1, marginRight: 12 },
  headerTitle: { fontSize: 19, fontWeight: '800', color: colors.textDark },
  headerSubtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { marginBottom: 10 },
  emptyText: { fontSize: 15, color: colors.textMuted },
  grid: {
    padding: 14,
    paddingBottom: 110,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: 16,
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
  skeletonCard: { borderWidth: 0 },
  skeletonCircle: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.borderLight, marginBottom: 10,
  },
  skeletonLineWide: {
    width: '70%', height: 12, borderRadius: 6, backgroundColor: colors.borderLight, marginBottom: 6,
  },
  skeletonLineNarrow: {
    width: '40%', height: 10, borderRadius: 5, backgroundColor: colors.borderLight,
  },
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
  iconImage: { width: '100%', height: '100%' },
  iconEmoji: { fontSize: 26 },
  cardTitle: { fontSize: 15.5, fontWeight: '700', color: colors.textDark, marginBottom: 4, textAlign: 'center' },
  cardCount: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
});
