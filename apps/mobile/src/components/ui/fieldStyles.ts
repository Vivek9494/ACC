import type { ReactNode } from 'react';

/** App orange used for field icons and accents. */
export const FIELD_ORANGE = '#F37021';

export const INPUT_SHADOW_STYLE = {
  shadowColor: '#000',
  shadowOpacity: 0.06,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 3 },
  elevation: 2,
} as const;

export const DEFAULT_INPUT_CLASS =
  'bg-white rounded-xl border border-[#F1F1F1] px-5 py-4 text-base text-[#1A1A1A] font-sans';

export const DEFAULT_PLACEHOLDER_COLOR = '#9AA0A6';

export type LabelVariant = 'muted' | 'strong';

const LABEL_CLASSES: Record<LabelVariant, string> = {
  muted: 'text-[#A0A0A0] text-sm font-sans-medium tracking-wide mb-2 ml-1',
  strong: 'text-[#1A1A1A] font-sans-bold text-sm mb-2 ml-1',
};

export function labelClassName(variant: LabelVariant = 'muted'): string {
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
  merged = `${stripRadius(merged)} rounded-xl`.trim();
  if (options?.hasLeadingIcon && !/\bpl-\d/.test(merged)) {
    merged = `${merged} pl-14`;
  }
  if (options?.hasTrailingAccessory && !/\bpr-\d/.test(merged)) {
    merged = `${merged} pr-12`;
  }
  return merged;
}

export interface FieldChromeOptions {
  label?: string;
  labelVariant?: LabelVariant;
  leadingIcon?: ReactNode;
  trailingAccessory?: ReactNode;
  containerClassName?: string;
}
