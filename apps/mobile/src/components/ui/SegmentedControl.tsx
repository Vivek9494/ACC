import { Pressable, View } from 'react-native';

import { CARD_ELEVATION_STYLE, CARD_SHELL_CHROME_CLASS } from './Card';
import { Text } from './Text';

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedControlOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
  /** `sm` fits header rows; `md` for wider layouts. */
  size?: 'sm' | 'md';
}

/** Two-or-more-way pill switch — active segment filled primary orange. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  size = 'sm',
}: SegmentedControlProps<T>): React.ReactElement {
  const shellPadding = size === 'sm' ? 'p-0.5' : 'p-1';
  const segmentPadding = size === 'sm' ? 'px-2.5 py-1.5' : 'px-4 py-2';
  const segmentRadiusClass = size === 'sm' ? 'rounded-[14px]' : 'rounded-xl';
  const labelClass = size === 'sm' ? 'text-xs' : 'text-sm';
  const segmentFlexClass = size === 'sm' ? 'shrink' : 'flex-1';

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      className={`max-w-full shrink flex-row bg-stone-200 ${CARD_SHELL_CHROME_CLASS} ${shellPadding}`}
      style={CARD_ELEVATION_STYLE}
    >
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            className={`${segmentFlexClass} ${segmentRadiusClass} ${segmentPadding} ${selected ? 'bg-primary' : ''}`}
          >
            <Text
              numberOfLines={1}
              className={`font-sans-semibold ${labelClass} ${
                selected ? 'text-text-inverse' : 'text-text-muted'
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
