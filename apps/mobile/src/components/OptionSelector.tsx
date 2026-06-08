import { View } from 'react-native';

import { Button } from './ui/Button';
import { Text } from './ui/Text';

export interface SelectorOption<T extends string> {
  value: T;
  label: string;
}

interface OptionSelectorProps<T extends string> {
  label: string;
  options: SelectorOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
}

/** Chip-style single-select used for ball type, format, year, overs, etc. */
export function OptionSelector<T extends string>({
  label,
  options,
  value,
  onChange,
}: OptionSelectorProps<T>): React.ReactElement {
  return (
    <View className="gap-2">
      <Text className="font-sans-medium text-xs uppercase tracking-wider text-on-surface-variant">
        {label}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Button
              key={option.value}
              onPress={() => onChange(option.value)}
              variant={selected ? 'primary' : 'outline'}
              className={`px-4 py-2 ${selected ? 'border-primary' : 'bg-surface-container-lowest'}`}
              textClassName={`font-sans text-sm ${selected ? 'text-on-primary' : 'text-on-surface'}`}
              label={option.label}
            />
          );
        })}
      </View>
    </View>
  );
}
