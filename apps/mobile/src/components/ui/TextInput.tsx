import { forwardRef, type ReactNode } from 'react';
import {
  Platform,
  TextInput as RNTextInput,
  View,
  type TextInputProps as RNTextInputProps,
} from 'react-native';

import {
  COMPACT_FIELD_CONTROL_HEIGHT,
  DEFAULT_PLACEHOLDER_COLOR,
  FIELD_CONTROL_HEIGHT,
  inputFieldShellStyle,
  inputTextLayoutStyle,
  labelClassName,
  mergeFieldClassName,
  mergeFieldShellClassName,
  type LabelVariant,
} from './fieldStyles';
import { Text } from './Text';

export interface TextInputProps extends RNTextInputProps {
  label?: string;
  labelVariant?: LabelVariant;
  /** Rendered inside the field on the left (e.g. phone/mail icons). */
  leadingIcon?: ReactNode;
  /** Rendered inside the field on the right (e.g. password visibility toggle). */
  rightAccessory?: ReactNode;
  /** Shorter shell (44px) for fields that should hug single-line text, e.g. name fields. */
  compact?: boolean;
  containerClassName?: string;
}

function isOverlayInput(className?: string): boolean {
  return Boolean(className && /\babsolute\b/.test(className));
}

/**
 * App-wide TextInput wrapper. White field, soft shadow, 12px corners (`rounded-xl`),
 * optional label, leading icon, and trailing accessory.
 */
export const TextInput = forwardRef<RNTextInput, TextInputProps>(function TextInput(
  {
    label,
    labelVariant = 'brand',
    leadingIcon,
    rightAccessory,
    compact = false,
    className,
    containerClassName,
    style,
    placeholderTextColor = DEFAULT_PLACEHOLDER_COLOR,
    ...props
  },
  ref,
) {
  const overlay = isOverlayInput(className);
  const shellHeight = compact ? COMPACT_FIELD_CONTROL_HEIGHT : FIELD_CONTROL_HEIGHT;
  const hasChrome = Boolean(label || leadingIcon || rightAccessory);
  const iconOptions = {
    hasLeadingIcon: Boolean(leadingIcon),
    hasTrailingAccessory: Boolean(rightAccessory),
  };
  const inputClassName = mergeFieldClassName(className);

  const androidInputProps =
    Platform.OS === 'android' ? ({ includeFontPadding: false } as RNTextInputProps) : {};

  const input = (
    <RNTextInput
      ref={ref}
      className={inputClassName}
      placeholderTextColor={placeholderTextColor}
      textAlignVertical="center"
      style={[overlay ? undefined : inputTextLayoutStyle(iconOptions), overlay ? { width: '100%' } : undefined, style]}
      {...androidInputProps}
      {...props}
    />
  );

  const fieldBody = overlay ? (
    input
  ) : (
    <View className={mergeFieldShellClassName(undefined, shellHeight)} style={inputFieldShellStyle(shellHeight)}>
      {input}
      {leadingIcon ? (
        <View pointerEvents="none" className="absolute inset-y-0 left-5 justify-center">
          {leadingIcon}
        </View>
      ) : null}
      {rightAccessory ? (
        <View className="absolute inset-y-0 right-5 justify-center">{rightAccessory}</View>
      ) : null}
    </View>
  );

  if (!hasChrome) {
    return fieldBody;
  }

  const containerClasses = ['w-full min-w-0', containerClassName].filter(Boolean).join(' ');

  return (
    <View className={containerClasses}>
      {label ? <Text className={labelClassName(labelVariant)}>{label}</Text> : null}
      {fieldBody}
    </View>
  );
});
