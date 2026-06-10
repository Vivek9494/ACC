import { View } from 'react-native';

import { Text } from './Text';

export type StatusPillVariant = 'ongoing' | 'upcoming' | 'completed' | 'live';

export interface StatusPillProps {
  variant: StatusPillVariant;
  label: string;
  className?: string;
}

const VARIANT_BG: Record<StatusPillVariant, string> = {
  ongoing: 'bg-[#E3F2FD]',
  upcoming: 'bg-[#FFF8E1]',
  completed: 'bg-surface-container-high',
  live: 'bg-error',
};

const VARIANT_TEXT: Record<StatusPillVariant, string> = {
  ongoing: 'text-[#1565C0]',
  upcoming: 'text-[#F57F17]',
  completed: 'text-on-surface-variant',
  live: 'text-on-error',
};

export function StatusPill({ variant, label, className }: StatusPillProps): React.ReactElement {
  if (variant === 'live') {
    return (
      <View
        className={`flex-row items-center gap-1 rounded-full px-3 py-1 ${VARIANT_BG.live} ${className ?? ''}`.trim()}
      >
        <View className="h-2 w-2 rounded-full bg-on-error" />
        <Text className={`font-sans-semibold text-[11px] uppercase tracking-wide ${VARIANT_TEXT.live}`}>
          {label}
        </Text>
      </View>
    );
  }

  return (
    <View className={`rounded-full px-3 py-1 ${VARIANT_BG[variant]} ${className ?? ''}`.trim()}>
      <Text className={`font-sans-semibold text-[11px] uppercase tracking-wide ${VARIANT_TEXT[variant]}`}>
        {label}
      </Text>
    </View>
  );
}
