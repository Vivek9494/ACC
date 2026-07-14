import type { ReactNode } from 'react';

import { colors } from '@/theme/colors';

/** Mirrors tailwind `primary` — use for non-className APIs (ActivityIndicator, Ionicons). */
export const FIELD_ORANGE = colors.primary;

export const INPUT_SHADOW_STYLE = {
  shadowColor: colors.shadow,
  shadowOpacity: 0.06,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 3 },
  elevation: 2,
} as const;

/** Profile avatar circle in stack headers ({@link ProfileMenu}). */
export const HEADER_PROFILE_AVATAR_SIZE_CLASS = 'h-11 w-11';

/** Initial letter inside the profile avatar. */
export const HEADER_PROFILE_AVATAR_INITIAL_CLASS = 'font-sans-bold text-lg text-primary';

/** Icon glyph size balanced inside {@link HEADER_PROFILE_AVATAR_SIZE_CLASS} (~text-lg weight). */
export const HEADER_PROFILE_AVATAR_ICON_SIZE = 18;

export const INPUT_TEXT_STYLE = { fontSize: 16 } as const;

export const DEFAULT_INPUT_CLASS =
  'bg-surface rounded-control border border-border px-5 py-4 text-text font-sans';

/**
 * Shared min height for picker-style controls (DateField / TimeField) so side-by-side
 * date+time rows stay vertically aligned when the value/placeholder text differs.
 */
export const FIELD_CONTROL_MIN_HEIGHT_CLASS = 'min-h-14';

/** Display text for Select/DateField values (same typography rules as TextInput). */
export const FIELD_VALUE_TEXT_CLASS = 'font-sans';

function stripInputTypography(className: string): string {
  return className
    .replace(
      /\btext-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)\b/g,
      '',
    )
    .replace(/\bleading-[\w-]+\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export const DEFAULT_PLACEHOLDER_COLOR = colors.placeholder;

export type LabelVariant = 'brand' | 'muted' | 'strong';

const LABEL_CLASSES: Record<LabelVariant, string> = {
  brand: 'font-sans text-base leading-6 text-text-muted mb-2 ml-1',
  muted: 'text-text-muted text-sm font-sans-medium tracking-wide mb-2 ml-1',
  strong: 'text-text font-sans-bold text-sm mb-2 ml-1',
};

/** Label typography without block spacing — inline checkbox labels, etc. */
export const FIELD_LABEL_TEXT_CLASS = 'font-sans text-base leading-6 text-text-muted';

export function labelClassName(variant: LabelVariant = 'brand'): string {
  return LABEL_CLASSES[variant];
}

function stripRadius(className?: string): string {
  if (!className) return '';
  return className.replace(/\brounded-[\w[\]-]+\b/g, '').replace(/\s+/g, ' ').trim();
}

export function mergeFieldClassName(
  className?: string,
  options?: { hasLeadingIcon?: boolean; hasTrailingAccessory?: boolean },
): string {
  const stripped = stripRadius(className ?? '');
  let merged = stripped ? `${DEFAULT_INPUT_CLASS} ${stripped}` : DEFAULT_INPUT_CLASS;
  merged = `${stripRadius(merged)} rounded-control`.trim();
  if (options?.hasLeadingIcon && !/\bpl-\d/.test(merged)) {
    merged = `${merged} pl-14`;
  }
  if (options?.hasTrailingAccessory && !/\bpr-\d/.test(merged)) {
    merged = `${merged} pr-12`;
  }
  return stripInputTypography(merged);
}

/** Dashboard stat column labels (MATCHES / RUNS / WICKETS) and matching metadata rows. */
export const STAT_LABEL_TEXT_CLASS =
  'font-sans-medium text-[11px] uppercase tracking-wider text-on-surface-variant';

/** Validation / form error text — primary orange app-wide. */
export const ERROR_TEXT_CLASS = 'font-sans text-sm text-primary';

/** Inline helper below a field (includes spacing). */
export const FIELD_ERROR_TEXT_CLASS = 'ml-1 mt-1 font-sans text-sm text-primary';

/** Error-state field border. */
export const ERROR_BORDER_CLASS = 'border-primary';

/** Optional alert surface for grouped form/API errors. */
export const ERROR_ALERT_SURFACE_CLASS = 'rounded-xl border border-primary/30 bg-primary-50 p-3';

/** Validation error border on shared inputs. */
export function applyFieldErrorBorder(className: string): string {
  return className.replace(/\bborder-border\b/, ERROR_BORDER_CLASS);
}

export interface FieldChromeOptions {
  label?: string;
  labelVariant?: LabelVariant;
  leadingIcon?: ReactNode;
  trailingAccessory?: ReactNode;
  containerClassName?: string;
}
