/**
 * ACC brand palette — 4 colors only (orange, navy, cream, taupe + tints).
 * Components should use semantic aliases (background, surface, text, border, primary, secondary).
 *
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  /** Web: avoid css-interop "darkMode media" throw when colorScheme is set. App stays light. */
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ---- Brand: Orange #F17633 — primary / action / affirmative ----
        primary: {
          50: '#FEF3EC',
          100: '#FCE0CE',
          200: '#F9C2A0',
          300: '#F5A472',
          400: '#F38D52',
          500: '#F17633',
          600: '#D85F1F',
          700: '#B04C17',
          800: '#883A12',
          900: '#5C270C',
          DEFAULT: '#F17633',
        },
        // ---- Brand: Navy #294C74 — structure / headers / negative ----
        secondary: {
          50: '#EAEEF4',
          100: '#C9D4E2',
          200: '#93A8C2',
          300: '#5D7BA0',
          400: '#3D5F85',
          500: '#294C74',
          600: '#233F61',
          700: '#1C334E',
          800: '#15263A',
          900: '#0E1926',
          DEFAULT: '#294C74',
        },
        // ---- Neutral: Taupe #C0B9AB — borders / muted / neutral ----
        stone: {
          50: '#FAF9F7',
          100: '#F0EDE8',
          200: '#E1DCD3',
          300: '#D2CBBE',
          400: '#C0B9AB',
          500: '#A89F8D',
          600: '#8C8472',
          700: '#6E6859',
          800: '#4F4B40',
          900: '#2F2C26',
          DEFAULT: '#C0B9AB',
        },
        // ---- Neutral: Sand/Cream #E7E1DB — backgrounds ----
        sand: {
          50: '#FBFAF8',
          100: '#F4EFEA',
          200: '#E7E1DB',
          300: '#DAD2C9',
          DEFAULT: '#E7E1DB',
        },

        // ---- Semantic aliases — USE THESE IN COMPONENTS ----
        background: '#F4EFEA',
        surface: '#FFFFFF',
        'surface-muted': '#E7E1DB',
        border: '#D2CBBE',
        text: {
          DEFAULT: '#15263A',
          muted: '#8C8472',
          inverse: '#FBFAF8',
        },
        'text-muted': '#8C8472',
        'text-inverse': '#FBFAF8',

        // ---- Legacy M3 names mapped to brand (migrate away over time) ----
        'on-surface': {
          DEFAULT: '#15263A',
          variant: '#8C8472',
        },
        'on-background': '#15263A',
        'on-primary': {
          DEFAULT: '#FBFAF8',
          container: '#883A12',
        },
        'on-secondary': {
          DEFAULT: '#FBFAF8',
          container: '#1C334E',
        },
        'on-tertiary': {
          DEFAULT: '#FBFAF8',
          container: '#1C334E',
        },
        'on-error': {
          DEFAULT: '#FBFAF8',
          container: '#15263A',
        },
        outline: {
          DEFAULT: '#A89F8D',
          variant: '#D2CBBE',
        },
        /** Validation / negative — navy, not red. */
        error: {
          DEFAULT: '#1C334E',
          container: '#C9D4E2',
        },
        /** Mapped to navy scale (no separate blue). */
        tertiary: {
          DEFAULT: '#294C74',
          container: '#5D7BA0',
        },
        'inverse-surface': '#15263A',
        'inverse-on-surface': '#FBFAF8',
        'inverse-primary': '#F5A472',
        separator: '#D2CBBE',
        'surface-container': {
          lowest: '#FFFFFF',
          low: '#E7E1DB',
          DEFAULT: '#E7E1DB',
          high: '#E1DCD3',
          highest: '#D2CBBE',
        },
        'surface-container-lowest': '#FFFFFF',
        'surface-container-low': '#E7E1DB',
        'surface-container-high': '#E1DCD3',
        'surface-container-highest': '#D2CBBE',
        'surface-bright': '#FBFAF8',
        'surface-dim': '#E7E1DB',
        'surface-variant': '#E1DCD3',
        'primary-container': '#FCE0CE',
        'primary-fixed': '#FCE0CE',
        'secondary-container': '#C9D4E2',
        'secondary-fixed': '#EAEEF4',
        'tertiary-container': '#5D7BA0',
        'tertiary-fixed': '#EAEEF4',
      },
      fontFamily: {
        sans: ['Montserrat_400Regular'],
        'sans-medium': ['Montserrat_500Medium'],
        'sans-semibold': ['Montserrat_600SemiBold'],
        'sans-bold': ['Montserrat_700Bold'],
      },
      borderRadius: {
        sm: '0.25rem',
        DEFAULT: '0.5rem',
        md: '0.75rem',
        lg: '1rem',
        xl: '0.75rem',
        control: '8px',
        full: '9999px',
      },
      height: {
        '0.75': '0.75px',
      },
      width: {
        '0.5': '0.5px',
      },
    },
  },
  plugins: [],
};
