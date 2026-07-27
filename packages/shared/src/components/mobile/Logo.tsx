import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import {
  BAZAR_PATH,
  LOGO_COLORS,
  MECH_PATH,
  WORDMARK_ASPECT,
  WORDMARK_VIEW_BOX,
} from '../../brand/logoPaths';

export type LogoTone = 'light' | 'dark';

export interface LogoProps {
  /** Rendered height in px. Width is derived from the wordmark's aspect ratio. */
  height?: number;
  /** Rendered width in px. Ignored when `height` is given. */
  width?: number;
  /**
   * Which surface the logo sits on -- `'dark'` switches "MECH" to white.
   * "BAZAR" stays brand red either way.
   */
  tone?: LogoTone;
  style?: StyleProp<ViewStyle>;
  /** Override only when the logo is decorative next to a visible "MechBazar". */
  accessibilityLabel?: string;
}

/**
 * The MechBazar wordmark: "MECH" in brand ink (white on dark surfaces) +
 * "BAZAR" in brand red.
 *
 * Drawn from vector outlines, not text, so it is the same shape on Android,
 * iOS and web -- a `fontWeight: '900'` <Text> wordmark reflows into whatever
 * heavy sans each platform ships, which is why the old per-app versions all
 * looked slightly different. Colours are fixed by the brand rather than taken
 * from the host app's palette, for the same reason.
 *
 * Pass exactly one of `height` / `width`; the other is derived.
 */
export const Logo: React.FC<LogoProps> = ({
  height,
  width,
  tone = 'light',
  style,
  accessibilityLabel = 'MechBazar',
}) => {
  const h = height ?? (width != null ? width / WORDMARK_ASPECT : 32);
  const w = height != null ? height * WORDMARK_ASPECT : (width ?? 32 * WORDMARK_ASPECT);

  return (
    <View style={style} accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <Svg width={w} height={h} viewBox={WORDMARK_VIEW_BOX}>
        <Path
          d={MECH_PATH}
          fill={tone === 'dark' ? LOGO_COLORS.inkOnDark : LOGO_COLORS.ink}
        />
        <Path d={BAZAR_PATH} fill={LOGO_COLORS.red} />
      </Svg>
    </View>
  );
};
