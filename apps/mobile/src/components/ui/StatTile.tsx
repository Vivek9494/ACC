import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { Card } from './Card';
import { FIELD_ORANGE, STAT_LABEL_TEXT_CLASS } from './fieldStyles';
import { Text } from './Text';

export interface StatItem {
  label: string;
  value: string | number;
  /** Renders the value in primary orange. */
  highlight?: boolean;
}

export interface StatTileProps {
  title?: string;
  items: StatItem[];
  className?: string;
  /** When set, shows an info icon beside the title that calls this on press. */
  onInfoPress?: () => void;
  /** Accessibility label for the info button. Defaults to “About {title}”. */
  infoAccessibilityLabel?: string;
}

/** Horizontal stat columns separated by thin dividers (dashboard “At a Glance”). */
export function StatTile({
  title,
  items,
  className,
  onInfoPress,
  infoAccessibilityLabel,
}: StatTileProps): React.ReactElement {
  if (items.length === 0) {
    return <View />;
  }

  return (
    <Card className={`rounded-control${className ? ` ${className}` : ''}`}>
      {title ? (
        <View className="mb-4 flex-row items-center gap-2">
          <Text variant="cardTitle" className="min-w-0 flex-1 font-sans-bold text-on-surface">
            {title}
          </Text>
          {onInfoPress ? (
            <Pressable
              onPress={onInfoPress}
              accessibilityRole="button"
              accessibilityLabel={infoAccessibilityLabel ?? `About ${title}`}
              hitSlop={8}
              className="h-8 w-8 items-center justify-center active:opacity-70"
            >
              <MaterialIcons name="info-outline" size={20} color={FIELD_ORANGE} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <View className="flex-row">
        {items.map((item, index) => (
          <View key={item.label} className="flex-1 flex-row">
            {index > 0 ? <View className="mr-4 w-0.5 self-stretch bg-separator" /> : null}
            <View className={`flex-1 ${index > 0 ? 'pl-4' : ''}`.trim()}>
              <Text className={STAT_LABEL_TEXT_CLASS}>
                {item.label}
              </Text>
              <Text
                className={`mt-1 font-sans-bold text-2xl ${
                  item.highlight ? 'text-primary' : 'text-on-surface'
                }`}
              >
                {item.value}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}

/** Alias for design-doc naming. */
export const StatRow = StatTile;
