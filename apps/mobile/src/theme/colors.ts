export const palette = {
  orange: '#F17633',
  navy: '#294C74',
  taupe: '#C0B9AB',
  cream: '#E7E1DB',
} as const;

export const colors = {
  primary: '#F17633',
  primaryDark: '#D85F1F',
  primaryLight: '#FCE0CE',
  secondary: '#294C74',
  secondaryDark: '#1C334E',
  secondaryLight: '#C9D4E2',
  secondaryDeep: '#0E1926',
  background: '#F4EFEA',
  surface: '#FFFFFF',
  surfaceMuted: '#E7E1DB',
  border: '#D2CBBE',
  text: '#15263A',
  textMuted: '#8C8472',
  textInverse: '#FBFAF8',
  shadow: '#000000',
  placeholder: '#8C8472',
} as const;

/** React Navigation theme — import separately to avoid pulling navigation types everywhere. */
export function buildNavTheme(): import('@react-navigation/native').Theme {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DefaultTheme } = require('@react-navigation/native') as typeof import('@react-navigation/native');
  return {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      notification: colors.primary,
    },
  };
}
