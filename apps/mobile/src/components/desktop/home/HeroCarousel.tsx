import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, Pressable, Animated, Linking, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { colors, spacing, radius } from '../../../theme/tokens';
import { resolveBannerLink } from '../../../utils/bannerLink';

interface Banner {
  id: string;
  title: string;
  subtitle: string;
  offer: string;
  redirectLink?: string;
  image: { uri: string } | number;
  showOverlay?: boolean;
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
  const [aspectRatios, setAspectRatios] = useState<Record<string, number>>({});

  // Pre-designed graphic banners (showOverlay === false) must display at
  // their own aspect ratio -- the fixed wrapper height + cover crop below
  // chops off content near the top/bottom edges (e.g. a trust-badges row)
  // that a plain background photo wouldn't miss, but a designed graphic does.
  useEffect(() => {
    banners.forEach((b) => {
      if (b.showOverlay === false && typeof b.image === 'object' && 'uri' in b.image && !aspectRatios[b.id]) {
        Image.getSize(
          b.image.uri,
          (w, h) => setAspectRatios((prev) => ({ ...prev, [b.id]: w / h })),
          () => {}
        );
      }
    });
  }, [banners]);

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
    const action = resolveBannerLink(banner.redirectLink);
    if (action.type === 'external') {
      Linking.openURL(action.url).catch(() => {
        Alert.alert('Could not open link', 'This promotional link appears to be invalid.');
      });
    } else if (action.type === 'category') {
      navigation.navigate('CategoryProducts', { categoryName: action.categoryName });
    } else {
      navigation.navigate('MainTabs', { screen: 'Categories' });
    }
  };

  // Some banner images are pre-designed graphics with their own baked-in
  // title/subtitle/CTA (e.g. a Canva export) -- rendering our own title/CTA
  // text on top of those collides visually with the image's own copy. When
  // the admin has flagged that, skip the dark tint + text entirely and just
  // make the raw image itself tappable so the link still works.
  const showOverlay = banner.showOverlay !== false;
  const noOverlayAspect = !showOverlay ? aspectRatios[banner.id] : undefined;

  return (
    <View style={[styles.wrapper, noOverlayAspect ? { height: 'auto' as any, aspectRatio: noOverlayAspect } : null]}>
      <Animated.View style={[styles.slide, { opacity: fade }]}>
        {showOverlay ? (
          <>
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
          </>
        ) : (
          // "contain" (not "cover") -- once aspectRatios[banner.id] is known
          // the wrapper already matches the image exactly so this is a no-op,
          // but it guarantees no cropping during the single frame before that
          // measurement resolves, when the wrapper is still the default height.
          <Pressable onPress={handleCta} style={styles.slide}>
            <Image source={banner.image} style={styles.image} resizeMode="contain" />
          </Pressable>
        )}
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
    // Was 420 -- read as the "huge hero banner" the redesign brief asks to
    // avoid, especially once it's demoted below the reference's matched
    // top section instead of leading the page. Kept as a compact promo
    // strip rather than removed outright (2026-08-14 redesign chose to
    // restyle existing lower sections in place, not delete them).
    height: 220,
    borderRadius: radius.lg,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colors.darkInk,
  },
  slide: { width: '100%', height: '100%' },
  image: { width: '100%', height: '100%', position: 'absolute' },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(17,17,18,0.4)',
  },
  textBlock: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    maxWidth: 560,
  },
  title: { color: colors.white, fontSize: 26, fontWeight: '800', marginBottom: 8, lineHeight: 32 },
  subtitle: { color: 'rgba(255,255,255,0.9)', fontSize: 14, marginBottom: 16, lineHeight: 20 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
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
