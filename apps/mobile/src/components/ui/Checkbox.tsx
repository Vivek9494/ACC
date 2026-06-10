import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  className?: string;
}

/**
 * Small rounded checkbox with a separate label area (supports inline link Text nodes).
 */
export function Checkbox({
  checked,
  onChange,
  children,
  className,
}: CheckboxProps): React.ReactElement {
  return (
    <View className={`flex-row items-start gap-3 ${className ?? ''}`.trim()}>
      <Pressable
        onPress={() => onChange(!checked)}
        className={`mt-0.5 h-5 w-5 items-center justify-center rounded-md border ${
          checked ? 'border-primary bg-primary' : 'border-[#D1D1D1] bg-white'
        }`}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
      >
        {checked ? <Ionicons name="checkmark" size={14} color="#ffffff" /> : null}
      </Pressable>
      <View className="flex-1">{children}</View>
    </View>
  );
}
