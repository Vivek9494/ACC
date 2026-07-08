import { Pressable, View } from 'react-native';

import { Text } from './Text';

export interface UnderlineTabOption<T extends string> {
  value: T;
  label: string;
  /** Shown beside the label, e.g. "Paid (3)". */
  count?: number;
}

export interface UnderlineTabBarProps<T extends string> {
  options: readonly UnderlineTabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
  /** `spread` — full-width centered tabs (leaderboard style); `inline` — left-aligned (default). */
  layout?: 'inline' | 'spread';
}

/** Left-aligned text tabs — active tab in primary orange with underline. */
export function UnderlineTabBar<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  layout = 'inline',
}: UnderlineTabBarProps<T>): React.ReactElement {
  const spread = layout === 'spread';

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      className={`flex-row border-b border-outline-variant ${spread ? '' : 'gap-6'}`}
    >
      {options.map((option) => {
        const active = value === option.value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            className={
              spread
                ? `flex-1 items-center py-3 -mb-px ${active ? 'border-b-2 border-primary' : ''}`
                : `pb-3 -mb-px ${active ? 'border-b-2 border-primary' : 'border-b-2 border-transparent'}`
            }
          >
            <Text
              className={`text-center font-sans-semibold text-sm ${
                active ? 'text-primary' : 'text-on-surface-variant'
              }`}
              numberOfLines={2}
            >
              {option.count != null ? `${option.label} (${option.count})` : option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
