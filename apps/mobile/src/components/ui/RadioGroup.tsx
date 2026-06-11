import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { INPUT_SHADOW_STYLE } from './fieldStyles';
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
}

/** Single-select radio group with optional leading icons per option. */
export function RadioGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  error,
}: RadioGroupProps<T>): React.ReactElement {
  return (
    <View className="gap-2">
      {label ? (
        <Text className="font-sans-bold text-sm uppercase tracking-wider text-primary">{label}</Text>
      ) : null}
      <View className="gap-3">
        {(options ?? []).map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              className={`flex-row items-center gap-3 rounded-control border bg-white px-4 py-3 ${
                selected ? 'border-primary bg-[#FDF1EA]' : 'border-[#F1F1F1]'
              }`}
              style={INPUT_SHADOW_STYLE}
            >
              <View
                className={`h-5 w-5 items-center justify-center rounded-full border ${
                  selected ? 'border-primary' : 'border-[#D1D1D1]'
                }`}
              >
                {selected ? <View className="h-2.5 w-2.5 rounded-full bg-primary" /> : null}
              </View>
              {option.icon ? <View>{option.icon}</View> : null}
              <Text
                className={`flex-1 font-sans text-base ${
                  selected ? 'font-sans-semibold text-primary' : 'text-on-surface'
                }`}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text className="font-sans text-sm text-error">{error}</Text> : null}
    </View>
  );
}
