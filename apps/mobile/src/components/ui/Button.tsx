import { forwardRef, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, type PressableProps, type View } from 'react-native';

import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'destructive';

const VARIANT_PRESSABLE: Record<ButtonVariant, string> = {
  primary: 'bg-primary-container',
  secondary: 'bg-primary',
  outline: 'border border-outline-variant bg-transparent',
  destructive: 'border border-[#c1121f] bg-transparent',
};

const VARIANT_TEXT: Record<ButtonVariant, string> = {
  primary: 'font-sans-medium text-sm uppercase tracking-wider text-on-primary',
  secondary: 'font-sans-semibold text-sm text-on-primary',
  outline: 'font-sans-semibold text-sm text-on-surface',
  destructive: 'font-sans-semibold text-sm text-[#c1121f]',
};

function stripRadius(className?: string): string {
  if (!className) return '';
  return className.replace(/\brounded-[\w[\]-]+\b/g, '').replace(/\s+/g, ' ').trim();
}

export interface ButtonProps extends PressableProps {
  variant?: ButtonVariant;
  /** Shorthand label; ignored when `children` is provided. */
  label?: string;
  /** Shows a spinner and disables interaction. */
  loading?: boolean;
  className?: string;
  textClassName?: string;
  children?: ReactNode;
}

/**
 * App-wide button wrapper. All variants share `rounded-xl` (12px). Text uses the
 * shared Text component with `font-sans-semibold` unless overridden via `textClassName`.
 */
export const Button = forwardRef<View, ButtonProps>(function Button(
  {
    variant = 'primary',
    label,
    children,
    loading = false,
    className,
    textClassName,
    disabled,
    ...props
  },
  ref,
) {
  const pressableClass = [
    'items-center justify-center rounded-xl active:opacity-80 disabled:opacity-60',
    VARIANT_PRESSABLE[variant],
    stripRadius(className),
  ]
    .filter(Boolean)
    .join(' ');

  const content =
    loading && variant === 'primary' ? (
      <ActivityIndicator color="#ffffff" />
    ) : (
      children ??
      (label ? (
        <Text className={`${VARIANT_TEXT[variant]} ${textClassName ?? ''}`.trim()}>{label}</Text>
      ) : null)
    );

  return (
    <Pressable ref={ref} disabled={disabled || loading} className={pressableClass} {...props}>
      {content}
    </Pressable>
  );
});
