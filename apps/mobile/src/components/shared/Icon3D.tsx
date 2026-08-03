import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

export type Icon3DSet = 'ionicons' | 'mci';

export interface Icon3DProps {
  /** Which glyph family `name` comes from. */
  set?: Icon3DSet;
  name: string;
  /** Outer chip size in px. */
  size?: number;
  /** Glyph size; defaults to ~46% of the chip. */
  iconSize?: number;
  /** Pastel/base fill for the chip. */
  tint: string;
  /** Glyph color -- pick something with contrast against `tint`. */
  iconColor: string;
  /** 'circle' for orbs/pills, 'squircle' for pedestal-style tiles. */
  shape?: 'circle' | 'squircle';
  /** Very small idle up/down drift. Reserved for a handful of prominent,
   * non-scrolling tiles -- see the note in HomeScreen.tsx's QUICK_ACTIONS.
   * Left off everywhere else (scrolling rows, the tab bar) since motion on
   * a tap target a user is actively scrolling past or staring at to aim a
   * tap works against precision and calm, not for it. */
  floating?: boolean;
  /** Deeper shadow, for tiles that need to read as sitting above the page. */
  elevated?: boolean;
  style?: ViewStyle;
}

/**
 * One consistent "glossy 3D chip" treatment for every icon in the app:
 * a tinted rounded chip, a soft shadow for lift, and a top-left highlight
 * ellipse to fake glass/sheen -- the same recipe WelcomeScreen's hero
 * FloatingChip already established, now shared so Services/Categories/
 * the tab bar/Feature Cards/icon buttons all read as one system instead of
 * each screen inventing its own icon styling.
 *
 * Deliberately NOT a real 3D render (no three.js/expo-gl in this project --
 * see the WelcomeScreen redesign notes for why that's the right call for a
 * screen that has to stay light and fast). This fakes depth with layered
 * vector shading, which is the standard technique premium RN apps use here
 * and costs nothing at runtime beyond one extra View per icon.
 */
export function Icon3D({
  set = 'ionicons',
  name,
  size = 44,
  iconSize,
  tint,
  iconColor,
  shape = 'circle',
  floating = false,
  elevated = false,
  style,
}: Icon3DProps) {
  const glyphSize = iconSize ?? Math.round(size * 0.46);
  const radius = shape === 'circle' ? size / 2 : size * 0.32;
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!floating) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [floating]);

  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -3] });
  const IconGlyph: any = set === 'mci' ? MaterialCommunityIcons : Ionicons;

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#0B1220',
          shadowOffset: { width: 0, height: elevated ? 8 : 5 },
          shadowOpacity: elevated ? 0.16 : 0.1,
          shadowRadius: elevated ? 14 : 8,
          elevation: elevated ? 6 : 3,
          transform: floating ? [{ translateY }] : undefined,
        },
        style,
      ]}
    >
      <View style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden', backgroundColor: tint }]}>
        {/* Top-left glass highlight */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: size * 0.09,
            left: size * 0.14,
            width: size * 0.44,
            height: size * 0.26,
            borderRadius: size * 0.2,
            backgroundColor: '#FFFFFF',
            opacity: 0.4,
          }}
        />
        {/* Bottom-right soft shade -- reads as a sphere/dome instead of a flat disc */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            bottom: -size * 0.12,
            right: -size * 0.12,
            width: size * 0.7,
            height: size * 0.7,
            borderRadius: size * 0.35,
            backgroundColor: '#0B1220',
            opacity: 0.07,
          }}
        />
      </View>
      <IconGlyph name={name} size={glyphSize} color={iconColor} />
    </Animated.View>
  );
}
