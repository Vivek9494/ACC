import {
  formatAutoConfirmCountdown,
  type PendingScorecardConfirmationCardView,
} from '@acc/types';
import { View } from 'react-native';

import { Button } from '../ui/Button';
import { Text } from '../ui/Text';

export interface ConfirmScorecardDashboardCardProps {
  item: PendingScorecardConfirmationCardView;
  onPress: () => void;
}

function teamProgressLine(label: string, confirmed: boolean): string {
  return `${label}: ${confirmed ? 'confirmed ✓' : 'pending'}`;
}

/** Captain/VC dashboard prompt — routes to the scorecard confirm card (§13.1). */
export function ConfirmScorecardDashboardCard({
  item,
  onPress,
}: ConfirmScorecardDashboardCardProps): React.ReactElement {
  const matchTitle = `${item.homeTeamName} vs ${item.awayTeamName}`;

  return (
    <View className="gap-2 rounded-xl border border-primary bg-primary-container/40 p-4">
      <Text className="font-sans-medium text-xs uppercase tracking-wider text-on-surface-variant">
        {item.tournamentName}
      </Text>
      <Text className="font-sans-bold text-lg text-primary">Confirm scorecard</Text>
      <Text className="font-sans-semibold text-base text-on-surface">{matchTitle}</Text>
      <Text className="font-sans text-sm text-on-surface-variant">
        Confirm for your team within 5 hours. Both teams must confirm before the scorecard locks.
        {item.autoConfirmDueAt
          ? ` Otherwise the system auto-confirms in ${formatAutoConfirmCountdown(item.autoConfirmDueAt)}.`
          : ''}
      </Text>
      <View className="gap-1">
        <Text className="font-sans text-sm text-on-surface">
          {teamProgressLine(item.homeTeamName, item.homeTeamConfirmed)}
        </Text>
        <Text className="font-sans text-sm text-on-surface">
          {teamProgressLine(item.awayTeamName, item.awayTeamConfirmed)}
        </Text>
      </View>
      <Button
        onPress={onPress}
        variant="secondary"
        className="h-12"
        label="Review & confirm"
      />
    </View>
  );
}
