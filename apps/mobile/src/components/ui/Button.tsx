import { forwardRef, type ReactNode } from 'react';
import { Pressable, type PressableProps, type View } from 'react-native';

import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'destructive';

const VARIANT_PRESSABLE: Record<ButtonVariant, string> = {
  /** Solid orange — main CTAs (Create Account, Log in, Save). */
  primary: 'bg-primary',
  secondary: 'bg-primary',
  outline: 'border border-outline-variant bg-transparent',
  destructive: 'border border-[#c1121f] bg-transparent',
};

const VARIANT_TEXT: Record<ButtonVariant, string> = {
  primary: 'text-on-primary',
  secondary: 'text-on-primary',
  outline: 'text-on-surface',
  destructive: 'text-[#c1121f]',
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
 * App-wide button wrapper. All variants share `rounded-xl` (12px). Text uses the
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
    'items-center justify-center rounded-xl active:opacity-80 disabled:opacity-60',
    VARIANT_PRESSABLE[variant],
    stripRadius(className),
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
