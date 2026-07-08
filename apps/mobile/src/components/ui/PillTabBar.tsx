import { Pressable, View } from 'react-native';

import { Text } from './Text';

export interface PillTabOption<T extends string> {
  value: T;
  label: string;
}

export interface PillTabBarProps<T extends string> {
  options: readonly PillTabOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
}

/**
 * Separate equal-width pill tabs — active fill primary orange, inactive outlined surface.
 * Shared by Leather/Tennis, team selectors, Home/Away, and innings tabs.
 */
export function PillTabBar<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: PillTabBarProps<T>): React.ReactElement {
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      className="flex-row gap-2"
    >
      {options.map((option) => {
        const active = value === option.value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            className={`min-w-0 flex-1 rounded-full px-3 py-2.5 active:opacity-80 ${
              active ? 'bg-primary' : 'border border-outline-variant bg-surface'
            }`}
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              className={`text-center font-sans-semibold text-sm ${
                active ? 'text-on-primary' : 'text-on-surface'
              }`}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
