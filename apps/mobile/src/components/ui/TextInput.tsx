import { forwardRef, type ReactNode } from 'react';
import {
  TextInput as RNTextInput,
  View,
  type TextInputProps as RNTextInputProps,
} from 'react-native';

import {
  DEFAULT_PLACEHOLDER_COLOR,
  INPUT_SHADOW_STYLE,
  labelClassName,
  mergeFieldClassName,
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
  containerClassName?: string;
}

/**
 * App-wide TextInput wrapper. White field, soft shadow, 12px corners (`rounded-xl`),
 * optional label, leading icon, and trailing accessory.
 */
export const TextInput = forwardRef<RNTextInput, TextInputProps>(function TextInput(
  {
    label,
    labelVariant = 'muted',
    leadingIcon,
    rightAccessory,
    className,
    containerClassName,
    style,
    placeholderTextColor = DEFAULT_PLACEHOLDER_COLOR,
    ...props
  },
  ref,
) {
  const hasChrome = Boolean(label || leadingIcon || rightAccessory);
  const inputClassName = mergeFieldClassName(className, {
    hasLeadingIcon: Boolean(leadingIcon),
    hasTrailingAccessory: Boolean(rightAccessory),
  });

  const input = (
    <RNTextInput
      ref={ref}
      className={inputClassName}
      placeholderTextColor={placeholderTextColor}
      style={[INPUT_SHADOW_STYLE, style]}
      {...props}
    />
  );

  const fieldBody =
    leadingIcon || rightAccessory ? (
      <View className="relative">
        {input}
        {leadingIcon ? (
          <View className="absolute inset-y-0 left-5 justify-center">{leadingIcon}</View>
        ) : null}
        {rightAccessory ? (
          <View className="absolute inset-y-0 right-5 justify-center">{rightAccessory}</View>
        ) : null}
      </View>
    ) : (
      input
    );

  if (!hasChrome) {
    return fieldBody;
  }

  return (
    <View className={containerClassName}>
      {label ? <Text className={labelClassName(labelVariant)}>{label}</Text> : null}
      {fieldBody}
    </View>
  );
});
