import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { INPUT_SHADOW_STYLE, labelClassName, type LabelVariant } from './fieldStyles';
import { Text } from './Text';

export interface RadioOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

export interface RadioGroupProps<T extends string> {
  label?: string;
  options: RadioOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  error?: string;
  /** When true, only the radio dot reflects selection (no row border/text emphasis). */
  indicatorOnly?: boolean;
  /** When true, options render side by side in one row (each flex:1). */
  horizontal?: boolean;
  labelVariant?: LabelVariant;
}

/** Single-select radio group with optional trailing icons per option. */
export function RadioGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  error,
  indicatorOnly = false,
  horizontal = false,
  labelVariant = 'brand',
}: RadioGroupProps<T>): React.ReactElement {
  return (
    <View className="gap-2">
      {label ? <Text className={labelClassName(labelVariant)}>{label}</Text> : null}
      <View className={horizontal ? 'flex-row items-stretch gap-3' : 'gap-3'}>
        {(options ?? []).map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              className={`min-w-0 flex-row items-center rounded-control border bg-white py-3 ${
                horizontal ? 'flex-1 gap-2 px-3' : 'gap-3 px-4'
              } ${
                !indicatorOnly && selected ? 'border-primary bg-[#FDF1EA]' : 'border-[#F1F1F1]'
              }`}
              style={INPUT_SHADOW_STYLE}
            >
              <View
                className={`h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                  selected ? 'border-primary' : 'border-[#D1D1D1]'
                }`}
              >
                {selected ? <View className="h-2.5 w-2.5 rounded-full bg-primary" /> : null}
              </View>
              <View className="min-w-0 flex-1 flex-row items-center">
                <Text
                  className={`min-w-0 flex-1 font-sans text-base text-on-surface ${
                    !indicatorOnly && selected ? 'font-sans-semibold text-primary' : ''
                  }`}
                  numberOfLines={2}
                >
                  {option.label}
                </Text>
                {option.icon ? <View className="ml-1 shrink-0">{option.icon}</View> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text className="font-sans text-sm text-error">{error}</Text> : null}
    </View>
  );
}
