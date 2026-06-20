import { forwardRef, type ReactNode } from 'react';
import { Pressable, type PressableProps, type View } from 'react-native';

import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'amber' | 'outline' | 'destructive' | 'tertiary';

const VARIANT_PRESSABLE: Record<ButtonVariant, string> = {
  primary: 'bg-primary active:bg-primary-600',
  secondary: 'bg-secondary active:bg-secondary-700',
  /** @deprecated Use `primary` — kept for call-site compat. */
  amber: 'bg-primary active:bg-primary-600',
  tertiary: 'bg-secondary active:bg-secondary-700',
  outline: 'border border-secondary bg-transparent active:bg-secondary-50',
  destructive: 'border border-secondary-700 bg-transparent active:bg-secondary-50',
};

const VARIANT_TEXT: Record<ButtonVariant, string> = {
  primary: 'text-text-inverse',
  secondary: 'text-text-inverse',
  amber: 'text-text-inverse',
  tertiary: 'text-text-inverse',
  outline: 'text-secondary',
  destructive: 'text-secondary-800',
};

function stripRadius(className?: string): string {
  if (!className) return '';
  return className.replace(/\brounded-[\w[\]-]+\b/g, '').replace(/\s+/g, ' ').trim();
}

export interface ButtonProps extends PressableProps {
  variant?: ButtonVariant;
  /** Shorthand label; ignored when `children` is provided. */
  label?: string;
  className?: string;
  textClassName?: string;
  children?: ReactNode;
}

/**
 * App-wide button wrapper. All variants share `rounded-control` (8px). Text uses the
 * shared Text component with `font-sans-semibold` unless overridden via `textClassName`.
 */
export const Button = forwardRef<View, ButtonProps>(function Button(
  {
    variant = 'primary',
    label,
    children,
    className,
    textClassName,
    disabled,
    ...props
  },
  ref,
) {
  const pressableClass = [
    'items-center justify-center disabled:opacity-60',
    VARIANT_PRESSABLE[variant],
    stripRadius(className),
    'rounded-control',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Pressable ref={ref} disabled={disabled} className={pressableClass} {...props}>
      {children ??
        (label ? (
          <Text
            className={`font-sans-semibold text-sm ${VARIANT_TEXT[variant]} ${textClassName ?? ''}`.trim()}
          >
            {label}
          </Text>
        ) : null)}
    </Pressable>
  );
});
