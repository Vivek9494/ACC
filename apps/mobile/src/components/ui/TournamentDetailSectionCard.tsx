import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Card } from './Card';
import { Text } from './Text';

export interface TournamentDetailSectionCardProps {
  title: string;
  icon: ReactNode;
  /** Optional control aligned to the trailing edge of the title row. */
  headerRight?: ReactNode;
  children: ReactNode;
}

export function TournamentDetailSectionCard({
  title,
  icon,
  headerRight,
  children,
}: TournamentDetailSectionCardProps): React.ReactElement {
  return (
    <Card className="rounded-control p-4">
      <View className="mb-3 flex-row items-center gap-2">
        {icon}
        <Text className="min-w-0 flex-1 font-sans-bold text-base text-primary">{title}</Text>
        {headerRight ? <View className="shrink-0">{headerRight}</View> : null}
      </View>
      <View className="gap-3">{children}</View>
    </Card>
  );
}

export function TournamentDetailInfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.ReactElement {
  return (
    <View className="gap-1">
      <Text className="font-sans text-sm text-on-surface-variant">{label}</Text>
      <Text className="font-sans-semibold text-base text-on-surface" numberOfLines={0}>
        {value}
      </Text>
    </View>
  );
}
