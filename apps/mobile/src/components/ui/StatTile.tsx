import { View } from 'react-native';

import { Card } from './Card';
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
}

/** Horizontal stat columns separated by thin dividers (dashboard “At a Glance”). */
export function StatTile({ title, items, className }: StatTileProps): React.ReactElement {
  if (items.length === 0) {
    return <View />;
  }

  return (
    <Card className={`rounded-control${className ? ` ${className}` : ''}`}>
      {title ? (
        <Text className="mb-4 font-sans-bold text-lg text-on-surface">{title}</Text>
      ) : null}
      <View className="flex-row">
        {items.map((item, index) => (
          <View key={item.label} className="flex-1 flex-row">
            {index > 0 ? <View className="mr-4 w-0.5 self-stretch bg-separator" /> : null}
            <View className={`flex-1 ${index > 0 ? 'pl-4' : ''}`.trim()}>
              <Text className="font-sans-medium text-[11px] uppercase tracking-wider text-on-surface-variant">
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
