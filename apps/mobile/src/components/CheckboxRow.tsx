import { Pressable, View } from 'react-native';
import { Text } from './ui/Text';

interface CheckboxRowProps {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
}

/** Labeled checkbox row matching the Add Tournament mockup (§6.1). */
export function CheckboxRow({
  label,
  description,
  value,
  onValueChange,
}: CheckboxRowProps): React.ReactElement {
  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      className="flex-row items-start gap-3"
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
    >
      <View
        className={`mt-0.5 h-6 w-6 items-center justify-center rounded-md border ${
          value ? 'border-primary bg-primary-container' : 'border-outline-variant bg-surface-container-lowest'
        }`}
      >
        {value ? <Text className="font-sans-semibold text-sm text-on-primary">✓</Text> : null}
      </View>
      <View className="flex-1">
        <Text className="font-sans-semibold text-base text-on-surface">{label}</Text>
        {description ? (
          <Text className="font-sans text-sm text-on-surface-variant">{description}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}
