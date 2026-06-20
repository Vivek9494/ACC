import { Pressable, Text, View } from 'react-native';

import { INNINGS_TAB_COUNT } from '../lib/scorecardInningsTabs';

export interface InningsTabsProps {
  tabLabels: readonly string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

/** Two equal-width pill tabs — one per innings, labelled with the batting team. */
export function InningsTabs({
  tabLabels,
  selectedIndex,
  onSelect,
}: InningsTabsProps): React.ReactElement {
  return (
    <View className="w-full flex-row gap-2">
      {Array.from({ length: INNINGS_TAB_COUNT }, (_, idx) => (
        <Pressable
          key={idx}
          onPress={() => onSelect(idx)}
          className={`min-w-0 flex-1 rounded-full px-3 py-2 ${
            idx === selectedIndex ? 'bg-primary' : 'border border-outline-variant bg-surface'
          }`}
        >
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            className={`text-center font-sans-semibold text-sm ${
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
