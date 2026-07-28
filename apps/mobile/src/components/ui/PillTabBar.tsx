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

/** Shared tab chip tokens — shape matches View Profile (`Button` + `rounded-control`). */
export const PILL_TAB_CHIP_SHAPE_CLASS =
  'min-h-9 items-center justify-center rounded-control active:opacity-80';
export const PILL_TAB_CHIP_PADDING_CLASS = 'px-4 py-2';
export const PILL_TAB_CHIP_BASE_CLASS = `${PILL_TAB_CHIP_SHAPE_CLASS} ${PILL_TAB_CHIP_PADDING_CLASS}`;
export const PILL_TAB_CHIP_ACTIVE_CLASS = 'bg-primary';
export const PILL_TAB_CHIP_INACTIVE_CLASS = 'border border-outline-variant bg-surface';
export const PILL_TAB_LABEL_ACTIVE_CLASS = 'text-center font-sans-semibold text-sm text-on-primary';
export const PILL_TAB_LABEL_INACTIVE_CLASS = 'text-center font-sans-semibold text-sm text-on-surface';

/**
 * Separate tab chips — active fill primary orange, inactive outlined surface.
 * Corner radius / padding aligned with View Profile (`rounded-control` / ~h-9).
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
        className={`${PILL_TAB_CHIP_BASE_CLASS} ${
          layout === 'equal' ? 'min-w-0 flex-1' : 'shrink-0'
        } ${active ? PILL_TAB_CHIP_ACTIVE_CLASS : PILL_TAB_CHIP_INACTIVE_CLASS}`}
      >
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit={layout === 'equal'}
          minimumFontScale={0.8}
          className={active ? PILL_TAB_LABEL_ACTIVE_CLASS : PILL_TAB_LABEL_INACTIVE_CLASS}
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
        // Nested in vertical ScrollViews with flexGrow:1 content (e.g. forms),
        // horizontal ScrollViews otherwise stretch on the cross-axis and inflate pills.
        style={{ flexGrow: 0 }}
        contentContainerClassName="flex-row items-center gap-2"
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
