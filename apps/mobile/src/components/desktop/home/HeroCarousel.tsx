import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, Pressable, Animated, Linking, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { colors, spacing, radius } from '../../../theme/tokens';

interface Banner {
  id: string;
  title: string;
  subtitle: string;
  offer: string;
  redirectLink?: string;
  image: { uri: string } | number;
}

// Consumes the exact banners array HomeScreen already fetches via
// fetchBanners(vehicleType) -- same admin-managed content, no new endpoint.
// redirectLink (already returned by that service but unused by the mobile
// banner today) drives the CTA: an http(s) link opens externally, anything
// else is treated as a category name.
export default function HeroCarousel({ banners }: { banners: Banner[] }) {
  const navigation = useNavigation<NavigationProp<any>>();
  const [index, setIndex] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (banners.length < 2) return;
    const timer = setInterval(() => {
      Animated.timing(fade, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
        setIndex(i => (i + 1) % banners.length);
        Animated.timing(fade, { toValue: 1, duration: 350, useNativeDriver: true }).start();
      });
    }, 5000);
    return () => clearInterval(timer);
  }, [banners.length, fade]);

  const goTo = (next: number) => {
    Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setIndex(next);
      Animated.timing(fade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    });
  };

  if (banners.length === 0) return null;
  const banner = banners[index];

  const handleCta = () => {
    const link = banner.redirectLink;
    if (!link) {
      navigation.navigate('MainTabs', { screen: 'Categories' });
      return;
    }
    if (/^https?:\/\//i.test(link)) {
      Linking.openURL(link);
    } else {
      navigation.navigate('CategoryProducts', { categoryName: link });
    }
  };

  return (
    <View style={styles.wrapper}>
      <Animated.View style={[styles.slide, { opacity: fade }]}>
        <Image source={banner.image} style={styles.image} resizeMode="cover" />
        <View style={styles.overlay} />
        <View style={styles.textBlock}>
          <Text style={styles.title}>{banner.title}</Text>
          {!!banner.subtitle && <Text style={styles.subtitle}>{banner.subtitle}</Text>}
          <Pressable style={({ hovered }: any) => [styles.cta, hovered && styles.ctaHovered]} onPress={handleCta}>
            <Text style={styles.ctaText}>{banner.offer || 'Shop Now'}</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.white} />
          </Pressable>
        </View>
      </Animated.View>

      {banners.length > 1 && (
        <>
          <Pressable
            style={[styles.arrow, styles.arrowLeft]}
            onPress={() => goTo((index - 1 + banners.length) % banners.length)}
            accessibilityLabel="Previous banner"
          >
            <Ionicons name="chevron-back" size={22} color={colors.white} />
          </Pressable>
          <Pressable
            style={[styles.arrow, styles.arrowRight]}
            onPress={() => goTo((index + 1) % banners.length)}
            accessibilityLabel="Next banner"
          >
            <Ionicons name="chevron-forward" size={22} color={colors.white} />
          </Pressable>

          <View style={styles.dots}>
            {banners.map((b, i) => (
              <Pressable key={b.id} onPress={() => goTo(i)} style={[styles.dot, i === index && styles.dotActive]} />
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    height: 420,
    borderRadius: radius.lg,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colors.darkInk,
  },
  slide: { width: '100%', height: '100%' },
  image: { width: '100%', height: '100%', position: 'absolute' },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(17,17,18,0.45)',
  },
  textBlock: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    maxWidth: 640,
  },
  title: { color: colors.white, fontSize: 40, fontWeight: '800', marginBottom: 12, lineHeight: 46 },
  subtitle: { color: 'rgba(255,255,255,0.9)', fontSize: 18, marginBottom: 24, lineHeight: 26 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignSelf: 'flex-start',
  },
  ctaHovered: { backgroundColor: colors.primaryDark },
  ctaText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  arrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowLeft: { left: spacing.lg },
  arrowRight: { right: spacing.lg },
  dots: {
    position: 'absolute',
    bottom: spacing.lg,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { backgroundColor: colors.white, width: 24 },
});
