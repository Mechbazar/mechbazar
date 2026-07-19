export const typography = {
  // The customer app (design reference) loads no custom typeface — only the
  // system font is used. Match that everywhere instead of inventing a brand font.
  fontFamily: {
    primary: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  },

  // Font sizes (web)
  fontSize: {
    xs: { size: 12, lineHeight: 1.4, letterSpacing: 0 },
    sm: { size: 14, lineHeight: 1.43, letterSpacing: 0 },
    base: { size: 16, lineHeight: 1.5, letterSpacing: 0 },
    lg: { size: 18, lineHeight: 1.56, letterSpacing: 0 },
    xl: { size: 20, lineHeight: 1.6, letterSpacing: 0 },
    '2xl': { size: 24, lineHeight: 1.67, letterSpacing: 0 },
    '3xl': { size: 32, lineHeight: 1.25, letterSpacing: 0 },
    '4xl': { size: 40, lineHeight: 1.1, letterSpacing: 0 },
    '5xl': { size: 48, lineHeight: 1, letterSpacing: 0 },
  },

  // Font weights
  fontWeight: {
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },

  // Heading styles
  headings: {
    h1: { fontSize: 40, fontWeight: 700, lineHeight: 1.1 },
    h2: { fontSize: 32, fontWeight: 700, lineHeight: 1.25 },
    h3: { fontSize: 24, fontWeight: 700, lineHeight: 1.35 },
    h4: { fontSize: 20, fontWeight: 600, lineHeight: 1.4 },
    h5: { fontSize: 16, fontWeight: 600, lineHeight: 1.5 },
    h6: { fontSize: 14, fontWeight: 600, lineHeight: 1.57 },
  },

  // Body text styles
  body: {
    lg: { fontSize: 16, fontWeight: 400, lineHeight: 1.5 },
    md: { fontSize: 14, fontWeight: 400, lineHeight: 1.43 },
    sm: { fontSize: 12, fontWeight: 400, lineHeight: 1.33 },
  },

  // Mobile font sizes (for React Native)
  mobile: {
    h1: 32,
    h2: 24,
    h3: 20,
    h4: 16,
    h5: 14,
    h6: 12,
    body: 14,
    caption: 12,
    small: 10,
  },
};
