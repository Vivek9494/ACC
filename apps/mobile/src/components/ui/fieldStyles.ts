import type { ReactNode } from 'react';
import { Platform, type TextStyle, type ViewStyle } from 'react-native';

/** App orange used for field icons and accents. */
export const FIELD_ORANGE = '#F37021';

/**
 * Standard single-line control height (h-14 / 56px). Matches the Signup Email field
 * with mail icon: symmetric 16px vertical padding + 16px text + 1px borders ≈ 56px.
 */
export const FIELD_CONTROL_HEIGHT = 56;

/** Shorter shell for compact fields (h-11 / 44px) — fits 16px text without extra vertical gap. */
export const COMPACT_FIELD_CONTROL_HEIGHT = 44;

export const FIELD_PADDING_X = 20;
export const FIELD_PADDING_X_WITH_LEADING_ICON = 56;
export const FIELD_PADDING_X_WITH_TRAILING_ACCESSORY = 48;

export const INPUT_FIELD_BORDER_COLOR = '#ECECEC';
export const INPUT_FIELD_RADIUS = 12;

/** Soft drop shadow for field shells — iOS needs a solid background on the same view. */
export const INPUT_SHADOW_STYLE = {
  shadowColor: '#000',
  shadowOpacity: 0.1,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 3,
} as const;

export const INPUT_SHELL_LAYOUT_STYLE: ViewStyle = {
  width: '100%',
  alignSelf: 'stretch',
};

/** Tailwind height class for a given control height. */
export function fieldShellHeightClass(height: number = FIELD_CONTROL_HEIGHT): string {
  return height === COMPACT_FIELD_CONTROL_HEIGHT ? 'h-11' : 'h-14';
}

/** Outer field shell layout; fixed height via `fieldShellHeightClass`. */
export function fieldShellLayoutClass(height: number = FIELD_CONTROL_HEIGHT): string {
  return `relative w-full min-w-0 ${fieldShellHeightClass(height)} justify-center`;
}

/** Opaque fill + fallback border so fields read on warm backgrounds even if shadow fails. */
export const INPUT_SHELL_SURFACE_STYLE: ViewStyle = {
  backgroundColor: '#ffffff',
  borderWidth: 1,
  borderColor: INPUT_FIELD_BORDER_COLOR,
  borderRadius: INPUT_FIELD_RADIUS,
};

/** Single style object for the field shell (layout + surface + shadow). No overflow:hidden. */
export function inputFieldShellStyle(height: number = FIELD_CONTROL_HEIGHT): ViewStyle {
  return {
    ...INPUT_SHELL_LAYOUT_STYLE,
    height,
    minHeight: height,
    maxHeight: height,
    ...INPUT_SHELL_SURFACE_STYLE,
    ...INPUT_SHADOW_STYLE,
  };
}

/**
 * Inner TextInput classes. Font size lives in inputTextLayoutStyle (not text-base, which
 * adds a lineHeight that inflates the iOS selection highlight).
 */
export const DEFAULT_INPUT_CLASS =
  'h-full w-full min-w-0 border-0 bg-transparent text-[#1A1A1A] font-sans';

export const DEFAULT_PLACEHOLDER_COLOR = '#9AA0A6';

export type LabelVariant = 'brand' | 'muted' | 'strong';

const LABEL_CLASSES: Record<LabelVariant, string> = {
  brand: 'font-sans text-base leading-6 text-[#5A4136] mb-2 ml-1',
  muted: 'text-[#A0A0A0] text-sm font-sans-medium tracking-wide mb-2 ml-1',
  strong: 'text-[#1A1A1A] font-sans-bold text-sm mb-2 ml-1',
};

export function labelClassName(variant: LabelVariant = 'brand'): string {
  return LABEL_CLASSES[variant];
}

function stripRadius(className?: string): string {
  if (!className) return '';
  return className.replace(/\brounded-[\w[\]-]+\b/g, '').replace(/\s+/g, ' ').trim();
}

/** Remove typography and height overrides from input className. */
function stripInputTypography(className?: string): string {
  if (!className) return '';
  return className
    .replace(/\bleading-[\w-]+\b/g, '')
    .replace(/\btext-base\b/g, '')
    .replace(/\bflex-1\b/g, '')
    .replace(/\bh-\S+/g, '')
    .replace(/\bpy-\S+/g, '')
    .replace(/\bpt-\S+/g, '')
    .replace(/\bpb-\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function mergeFieldClassName(className?: string): string {
  const stripped = stripInputTypography(stripRadius(className ?? ''));
  return stripped ? `${DEFAULT_INPUT_CLASS} ${stripped}` : DEFAULT_INPUT_CLASS;
}

function stripShellOverrides(className?: string): string {
  if (!className) return '';
  return className
    .replace(/\boverflow-hidden\b/g, '')
    .replace(/\bbg-\S+/g, '')
    .replace(/\bborder(?:-\S+)?/g, '')
    .replace(/\brounded-[\w[\]-]+\b/g, '')
    .replace(/\bh-\S+/g, '')
    .replace(/\bpy-\S+/g, '')
    .replace(/\bpt-\S+/g, '')
    .replace(/\bpb-\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function mergeFieldShellClassName(
  className?: string,
  height: number = FIELD_CONTROL_HEIGHT,
): string {
  const stripped = stripShellOverrides(className ?? '');
  const base = fieldShellLayoutClass(height);
  return stripped ? `${base} ${stripped}` : base;
}

/** Horizontal padding only; height comes from the fixed shell. No lineHeight, no py. */
export function inputTextLayoutStyle(options?: {
  hasLeadingIcon?: boolean;
  hasTrailingAccessory?: boolean;
}): TextStyle {
  const paddingLeft = options?.hasLeadingIcon
    ? FIELD_PADDING_X_WITH_LEADING_ICON
    : FIELD_PADDING_X;
  const paddingRight = options?.hasTrailingAccessory
    ? FIELD_PADDING_X_WITH_TRAILING_ACCESSORY
    : FIELD_PADDING_X;

  return {
    width: '100%',
    height: '100%',
    fontSize: 16,
    paddingLeft,
    paddingRight,
    paddingVertical: 0,
    backgroundColor: 'transparent',
    ...(Platform.OS === 'android' ? { textAlignVertical: 'center' as const } : {}),
  };
}

/** Single-line field value text (Select, DateField) — font size only, no lineHeight. */
export const FIELD_VALUE_TEXT_STYLE: TextStyle = {
  fontSize: 16,
};

export function fieldValueTextClassName(selected: boolean): string {
  return `font-sans ${selected ? 'text-[#1A1A1A]' : 'text-[#9AA0A6]'}`;
}

/** Horizontal inset for Pressable fields (Select, DateField); height from inputFieldShellStyle. */
export function fieldBodyPaddingClass(options?: {
  hasLeadingIcon?: boolean;
  hasTrailingAccessory?: boolean;
}): string {
  if (options?.hasLeadingIcon) {
    return 'pl-14 pr-5';
  }
  if (options?.hasTrailingAccessory) {
    return 'px-5 pr-12';
  }
  return 'px-5';
}

export interface FieldChromeOptions {
  label?: string;
  labelVariant?: LabelVariant;
  leadingIcon?: ReactNode;
  trailingAccessory?: ReactNode;
  containerClassName?: string;
}
