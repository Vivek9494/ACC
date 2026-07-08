import { Pressable, Text, View } from 'react-native';

import { INNINGS_TAB_COUNT } from '../lib/scorecardInningsTabs';

export interface InningsTabsProps {
  tabLabels: readonly string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  /** Larger labels for the Live Scoring Scorecard tab. */
  size?: 'default' | 'scorecard';
}

/** Two equal-width pill tabs — one per innings, labelled with the batting team. */
export function InningsTabs({
  tabLabels,
  selectedIndex,
  onSelect,
  size = 'default',
}: InningsTabsProps): React.ReactElement {
  const labelClass =
    size === 'scorecard'
      ? 'text-center font-sans-semibold text-base'
      : 'text-center font-sans-semibold text-sm';
  const padClass = size === 'scorecard' ? 'px-3 py-2.5' : 'px-3 py-2';

  return (
    <View className="w-full flex-row gap-2">
      {Array.from({ length: INNINGS_TAB_COUNT }, (_, idx) => (
        <Pressable
          key={idx}
          onPress={() => onSelect(idx)}
          className={`min-w-0 flex-1 rounded-full ${padClass} ${
            idx === selectedIndex ? 'bg-primary' : 'border border-outline-variant bg-surface'
          }`}
        >
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            className={`${labelClass} ${
              idx === selectedIndex ? 'text-on-primary' : 'text-on-surface'
            }`}
          >
            {tabLabels[idx] ?? `Innings ${idx + 1}`}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
