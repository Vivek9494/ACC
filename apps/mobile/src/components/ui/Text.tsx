import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { TYPE_CLASS, type TypeToken } from '@/theme/typography';

/** True when `className` already sets a NativeWind font-family utility. */
function hasFontFamily(className?: string): boolean {
  return Boolean(className && /\bfont-(sans(-\w+)?|mono|display(-\w+)?)\b/.test(className));
}

/** Product size variants — prefer these over inventing `text-*` / `text-[Npx]`. */
export type TextVariant = TypeToken;

export type TextProps = RNTextProps & {
  /**
   * Applies the named type-scale size from {@link TYPE_CLASS}.
   * Omit to leave size to `className` (legacy call sites).
   */
  variant?: TextVariant;
};

/**
 * App-wide Text wrapper. React Native does not inherit `fontFamily`, so every
 * Text gets `font-sans` (Montserrat Regular) unless a family utility is passed.
 * Optional {@link TextProps.variant} applies the product type scale.
 */
export function Text({ className, variant, ...props }: TextProps): React.ReactElement {
  const sizeClass = variant ? TYPE_CLASS[variant] : '';
  const withFamily = hasFontFamily(className)
    ? className
    : `font-sans ${className ?? ''}`.trim();
  const merged = [sizeClass, withFamily].filter(Boolean).join(' ').trim();
  return <RNText className={merged} {...props} />;
}
