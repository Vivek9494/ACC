import { Pressable, ScrollView, View } from 'react-native';

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
  /**
   * `equal` — flex row, equal-width pills (Leather/Tennis, Home/Away).
   * `scroll` — horizontal scroll; pills size to label (team filters with many options).
   */
  layout?: 'equal' | 'scroll';
}

/**
 * Separate pill tabs — active fill primary orange, inactive outlined surface.
 * Shared by Leather/Tennis, team selectors, Home/Away, and innings tabs.
 */
export function PillTabBar<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  layout = 'equal',
}: PillTabBarProps<T>): React.ReactElement {
  const pills = options.map((option) => {
    const active = value === option.value;
    return (
      <Pressable
        key={option.value}
        onPress={() => onChange(option.value)}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        className={`rounded-full px-3 py-2.5 active:opacity-80 ${
          layout === 'equal' ? 'min-w-0 flex-1' : 'shrink-0'
        } ${active ? 'bg-primary' : 'border border-outline-variant bg-surface'}`}
      >
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit={layout === 'equal'}
          minimumFontScale={0.8}
          className={`text-center font-sans-semibold text-sm ${
            active ? 'text-on-primary' : 'text-on-surface'
          }`}
        >
          {option.label}
        </Text>
      </Pressable>
    );
  });

  if (layout === 'scroll') {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityRole="tablist"
        accessibilityLabel={accessibilityLabel}
        contentContainerClassName="flex-row gap-2"
      >
        {pills}
      </ScrollView>
    );
  }

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      className="flex-row gap-2"
    >
      {pills}
    </View>
  );
}
