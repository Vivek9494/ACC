import { Pressable, View } from 'react-native';

import { Text } from './Text';
import {
  PILL_TAB_CHIP_ACTIVE_CLASS,
  PILL_TAB_CHIP_INACTIVE_CLASS,
  PILL_TAB_CHIP_SHAPE_CLASS,
} from './PillTabBar';

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

/**
 * Multi-way tab switch — same chip shape as {@link PillTabBar} / View Profile
 * (`rounded-control`, orange active / light inactive).
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  size = 'sm',
}: SegmentedControlProps<T>): React.ReactElement {
  const sizePadding = size === 'sm' ? 'px-2.5 py-1.5' : 'px-4 py-2';
  const labelSize = size === 'sm' ? 'text-xs' : 'text-sm';
  const segmentFlexClass = size === 'sm' ? 'shrink' : 'min-w-0 flex-1';

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      className="max-w-full shrink flex-row gap-2"
    >
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            className={`${PILL_TAB_CHIP_SHAPE_CLASS} ${sizePadding} ${segmentFlexClass} ${
              selected ? PILL_TAB_CHIP_ACTIVE_CLASS : PILL_TAB_CHIP_INACTIVE_CLASS
            }`}
          >
            <Text
              numberOfLines={1}
              className={`text-center font-sans-semibold ${labelSize} ${
                selected ? 'text-on-primary' : 'text-on-surface'
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
