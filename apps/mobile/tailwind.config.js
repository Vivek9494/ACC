/**
 * Theme seeded from the Stitch "Warm Professionalism" mockup
 * (docs/designs/warm_professionalism/DESIGN.md): warm off-white surface with an
 * orange primary. Extend/replace as more screens are designed.
 *
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#fff8f5',
          dim: '#e2d8d3',
          bright: '#fff8f5',
          variant: '#ebe0db',
          container: {
            lowest: '#ffffff',
            low: '#fcf1ec',
            DEFAULT: '#f7ece6',
            high: '#f1e6e1',
            highest: '#ebe0db',
          },
        },
        'on-surface': {
          DEFAULT: '#1f1b18',
          variant: '#5a4136',
        },
        'inverse-surface': '#352f2c',
        'inverse-on-surface': '#f9efe9',
        outline: {
          DEFAULT: '#8e7164',
          variant: '#e2bfb0',
        },
        primary: {
          DEFAULT: '#a04100',
          container: '#ff6b00',
          tint: '#a04100',
        },
        'on-primary': {
          DEFAULT: '#ffffff',
          container: '#572000',
        },
        'inverse-primary': '#ffb693',
        secondary: {
          DEFAULT: '#765b00',
          container: '#ffc703',
        },
        'on-secondary': {
          DEFAULT: '#ffffff',
          container: '#6e5400',
        },
        tertiary: {
          DEFAULT: '#0062a1',
          container: '#059eff',
        },
        'on-tertiary': {
          DEFAULT: '#ffffff',
          container: '#003357',
        },
        error: {
          DEFAULT: '#ba1a1a',
          container: '#ffdad6',
        },
        'on-error': {
          DEFAULT: '#ffffff',
          container: '#93000a',
        },
        background: '#fff8f5',
        'on-background': '#1f1b18',
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
        full: '9999px',
      },
    },
  },
  plugins: [],
};
