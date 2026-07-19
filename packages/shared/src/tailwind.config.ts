/**
 * Tailwind Config for MechBazar Applications
 * This is the unified design system configuration used across all web apps
 */

const defaultTheme = require('tailwindcss/defaultTheme');

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand Colors — anchored on the real customer-app accent (#E23B22)
        primary: {
          50: '#fdece8',
          100: '#fbd2c9',
          200: '#f6a894',
          300: '#f07d5f',
          400: '#e85a3d',
          500: '#E23B22', // Main brand color
          600: '#c0362c', // matches the app's own "cancelled/strong" shade
          700: '#9c2a20',
          800: '#7a2018',
          900: '#5c1710',
          DEFAULT: '#E23B22',
        },
        navy: {
          50: '#e9f1f9',
          100: '#c8ddf0',
          200: '#a2c6e6',
          300: '#7bafdb',
          400: '#3d7cbd',
          500: '#14508C', // Main navy/info color
          600: '#12477c',
          700: '#0f3c69',
          800: '#0c3057',
          900: '#092444',
          DEFAULT: '#14508C',
        },
        // Neutral Colors — matches the app's text/border/surface grays
        neutral: {
          50: '#F5F6F8',
          100: '#F2F3F5',
          200: '#E6E9ED',
          300: '#C5CAD3',
          400: '#9AA5B1',
          500: '#6B7480',
          600: '#486581',
          700: '#3A4552',
          800: '#2A3340',
          900: '#1C2430',
          DEFAULT: '#1C2430',
        },
        // Semantic Colors
        success: {
          50: '#EEF9F1',
          100: '#d3f0dd',
          200: '#a8e2bc',
          300: '#7cd39a',
          400: '#4bc077',
          500: '#1E9E5A',
          600: '#1a8a4e',
          700: '#156f3f',
          800: '#105530',
          900: '#0b3b21',
          DEFAULT: '#1E9E5A',
        },
        warning: {
          50: '#fef5e6',
          100: '#fce6bf',
          200: '#f9d089',
          300: '#f7ba52',
          400: '#f6ac2c',
          500: '#F5A300',
          600: '#d68f00',
          700: '#a86f00',
          800: '#7a5000',
          900: '#4d3200',
          DEFAULT: '#F5A300',
        },
        danger: {
          50: '#fdece8',
          100: '#fbd2c9',
          200: '#f6a894',
          300: '#f07d5f',
          400: '#e85a3d',
          500: '#E23B22',
          600: '#C0362C',
          700: '#9c2a20',
          800: '#7a2018',
          900: '#5c1710',
          DEFAULT: '#E23B22',
        },
        info: {
          50: '#e9f1f9',
          100: '#c8ddf0',
          200: '#a2c6e6',
          300: '#7bafdb',
          400: '#3d7cbd',
          500: '#14508C',
          600: '#12477c',
          700: '#0f3c69',
          800: '#0c3057',
          900: '#092444',
          DEFAULT: '#14508C',
        },
        // Background and Surface Colors
        bg: {
          primary: '#F5F6F8',
          secondary: '#ffffff',
          tertiary: '#F2F3F5',
          DEFAULT: '#F5F6F8',
        },
        surface: {
          hover: '#F2F3F5',
          active: '#E6E9ED',
          DEFAULT: '#ffffff',
        },
      },

      // Typography — the customer app (design reference) loads no custom
      // typeface, so match system-default rendering rather than force a brand font.
      fontFamily: {
        sans: defaultTheme.fontFamily.sans,
        mono: defaultTheme.fontFamily.mono,
      },

      fontSize: {
        xs: ['12px', { lineHeight: '1.4', letterSpacing: '0' }],
        sm: ['14px', { lineHeight: '1.43', letterSpacing: '0' }],
        base: ['16px', { lineHeight: '1.5', letterSpacing: '0' }],
        lg: ['18px', { lineHeight: '1.56', letterSpacing: '0' }],
        xl: ['20px', { lineHeight: '1.6', letterSpacing: '0' }],
        '2xl': ['24px', { lineHeight: '1.67', letterSpacing: '0' }],
        '3xl': ['32px', { lineHeight: '1.25', letterSpacing: '0' }],
        '4xl': ['40px', { lineHeight: '1.1', letterSpacing: '0' }],
        '5xl': ['48px', { lineHeight: '1', letterSpacing: '0' }],
      },

      fontWeight: {
        light: 300,
        normal: 400,
        medium: 500,
        semibold: 600,
        bold: 700,
        extrabold: 800,
      },

      // Spacing
      spacing: {
        0: '0',
        1: '4px',
        2: '8px',
        3: '12px',
        4: '16px',
        5: '20px',
        6: '24px',
        7: '28px',
        8: '32px',
        9: '36px',
        10: '40px',
        12: '48px',
        14: '56px',
        16: '64px',
        20: '80px',
        24: '96px',
        28: '112px',
        32: '128px',
        36: '144px',
        40: '160px',
        44: '176px',
        48: '192px',
        52: '208px',
        56: '224px',
        60: '240px',
        64: '256px',
        72: '288px',
        80: '320px',
        96: '384px',
      },

      // Border Radius
      borderRadius: {
        xs: '2px',
        sm: '4px',
        base: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '24px',
        '3xl': '32px',
        full: '9999px',
      },

      // Shadows
      boxShadow: {
        xs: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        sm: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        base: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        md: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        lg: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        xl: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        'primary-sm': '0 4px 12px 0 rgba(219, 0, 0, 0.15)',
        'success-sm': '0 4px 12px 0 rgba(40, 167, 69, 0.15)',
        'danger-sm': '0 4px 12px 0 rgba(219, 0, 0, 0.15)',
        none: 'none',
      },

      // Transitions
      transitionDuration: {
        0: '0ms',
        75: '75ms',
        100: '100ms',
        150: '150ms',
        200: '200ms',
        300: '300ms',
        500: '500ms',
        700: '700ms',
        1000: '1000ms',
      },

      // Animations
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-in-out',
        'pulse-subtle': 'pulseSubtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },

      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '.95' },
        },
      },
    },
  },
  plugins: [],
}
