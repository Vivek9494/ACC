import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Card } from './Card';
import { Text } from './Text';

export interface TournamentDetailSectionCardProps {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}

export function TournamentDetailSectionCard({
  title,
  icon,
  children,
}: TournamentDetailSectionCardProps): React.ReactElement {
  return (
    <Card className="rounded-control p-4">
      <View className="mb-3 flex-row items-center gap-2">
        {icon}
        <Text className="font-sans-bold text-base text-primary">{title}</Text>
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
