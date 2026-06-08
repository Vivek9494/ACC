import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

/** True when `className` already sets a NativeWind font-family utility. */
function hasFontFamily(className?: string): boolean {
  return Boolean(className && /\bfont-(sans(-\w+)?|mono|display(-\w+)?)\b/.test(className));
}

export type TextProps = RNTextProps;

/**
 * App-wide Text wrapper. React Native does not inherit `fontFamily`, so every
 * Text gets `font-sans` (Montserrat Regular) unless a family utility is passed.
 */
export function Text({ className, ...props }: TextProps): React.ReactElement {
  const merged = hasFontFamily(className) ? className : `font-sans ${className ?? ''}`.trim();
  return <RNText className={merged} {...props} />;
}
