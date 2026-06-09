import { View } from 'react-native';

import { Text } from './Text';

export type StatusPillVariant = 'ongoing' | 'upcoming' | 'completed';

export interface StatusPillProps {
  variant: StatusPillVariant;
  label: string;
  className?: string;
}

const VARIANT_BG: Record<StatusPillVariant, string> = {
  ongoing: 'bg-[#E3F2FD]',
  upcoming: 'bg-[#FFF8E1]',
  completed: 'bg-surface-container-high',
};

const VARIANT_TEXT: Record<StatusPillVariant, string> = {
  ongoing: 'text-[#1565C0]',
  upcoming: 'text-[#F57F17]',
  completed: 'text-on-surface-variant',
};

export function StatusPill({ variant, label, className }: StatusPillProps): React.ReactElement {
  return (
    <View className={`rounded-full px-3 py-1 ${VARIANT_BG[variant]} ${className ?? ''}`.trim()}>
      <Text className={`font-sans-semibold text-[11px] uppercase tracking-wide ${VARIANT_TEXT[variant]}`}>
        {label}
      </Text>
    </View>
  );
}
