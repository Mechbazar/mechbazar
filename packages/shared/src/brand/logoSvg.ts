import {
  BAZAR_PATH,
  LOGO_COLORS,
  MECH_PATH,
  WORDMARK_ASPECT,
  WORDMARK_VIEW_BOX,
} from './logoPaths';

export interface LogoSvgOptions {
  /** Rendered width in px. Height is derived from the wordmark's aspect ratio. */
  width?: number;
  /** `'dark'` switches "MECH" to white, for dark backgrounds. */
  tone?: 'light' | 'dark';
}

/**
 * The MechBazar wordmark as a standalone `<svg>` string.
 *
 * For HTML that is built as a string rather than rendered as components --
 * the invoice/receipt templates handed to expo-print, which run in a WebView
 * where the <Logo/> component doesn't exist. Same outlines and colours as the
 * component, so a printed invoice matches the screen it was generated from.
 */
export function logoSvgMarkup({ width = 160, tone = 'light' }: LogoSvgOptions = {}): string {
  const height = width / WORDMARK_ASPECT;
  const ink = tone === 'dark' ? LOGO_COLORS.inkOnDark : LOGO_COLORS.ink;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height.toFixed(1)}" ` +
    `viewBox="${WORDMARK_VIEW_BOX}" role="img" aria-label="MechBazar">` +
    `<path fill="${ink}" d="${MECH_PATH}"/>` +
    `<path fill="${LOGO_COLORS.red}" d="${BAZAR_PATH}"/>` +
    `</svg>`
  );
}
