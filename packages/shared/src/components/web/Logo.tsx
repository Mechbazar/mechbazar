import React from 'react';
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
  className?: string;
  /** Override only when the logo is decorative next to a visible "MechBazar". */
  title?: string;
}

/**
 * The MechBazar wordmark: "MECH" in brand ink (white on dark surfaces) +
 * "BAZAR" in brand red.
 *
 * Inline SVG from vector outlines rather than styled text, so the panels and
 * the apps render an identical logo. The colours are fixed by the brand and
 * deliberately not taken from Tailwind: apps/admin and apps/vendor both define
 * `primary-500` as #db0000, a much darker red than the brand's, which is what
 * made the old `MECH<span className="text-primary-500">BAZAR</span>` markup
 * render off-brand.
 *
 * Pass exactly one of `height` / `width`; the other is derived.
 */
export const Logo: React.FC<LogoProps> = ({
  height,
  width,
  tone = 'light',
  className,
  title = 'MechBazar',
}) => {
  const h = height ?? (width != null ? width / WORDMARK_ASPECT : 32);
  const w = height != null ? height * WORDMARK_ASPECT : (width ?? 32 * WORDMARK_ASPECT);

  return (
    <svg
      width={w}
      height={h}
      viewBox={WORDMARK_VIEW_BOX}
      className={className}
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d={MECH_PATH} fill={tone === 'dark' ? LOGO_COLORS.inkOnDark : LOGO_COLORS.ink} />
      <path d={BAZAR_PATH} fill={LOGO_COLORS.red} />
    </svg>
  );
};
