import { View } from 'react-native';

import { Text } from './Text';

export type StatusPillVariant = 'ongoing' | 'upcoming' | 'completed' | 'live' | 'cancelled';

export interface StatusPillProps {
  variant: StatusPillVariant;
  label: string;
  className?: string;
}

const VARIANT_BG: Record<StatusPillVariant, string> = {
  ongoing: 'bg-secondary-100',
  upcoming: 'bg-secondary-100',
  completed: 'bg-stone-200',
  live: 'bg-primary',
  cancelled: 'bg-surface-container-high',
};

const VARIANT_TEXT: Record<StatusPillVariant, string> = {
  ongoing: 'text-secondary-700',
  upcoming: 'text-secondary-700',
  completed: 'text-stone-700',
  live: 'text-text-inverse',
  cancelled: 'text-on-surface-variant',
};

export function StatusPill({ variant, label, className }: StatusPillProps): React.ReactElement {
  if (variant === 'live') {
    return (
      <View
        className={`flex-row items-center gap-1 rounded-full px-3 py-1 ${VARIANT_BG.live} ${className ?? ''}`.trim()}
      >
        <View className="h-2 w-2 rounded-full bg-text-inverse" />
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
