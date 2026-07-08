import type { ManOfMatchEligibilityView } from '@acc/types';
import { View } from 'react-native';

import { Button } from '../ui/Button';
import { Text } from '../ui/Text';

export interface ManOfMatchActionCardProps {
  winningTeamName: string;
  momEligibility: ManOfMatchEligibilityView | null | undefined;
  /** True when no MoM has been selected yet. */
  momPending: boolean;
  working?: boolean;
  /** Match Detail: plain action button; scorecard: bordered required card. */
  inline?: boolean;
  onPress: () => void;
}

/** Winning-team Captain or Vice-Captain CTA to select or change Man of the Match (§13.3). */
export function ManOfMatchActionCard({
  winningTeamName,
  momEligibility,
  momPending,
  working = false,
  inline = false,
  onPress,
}: ManOfMatchActionCardProps): React.ReactElement {
  const overdue = momEligibility?.overdue ?? false;

  if (inline) {
    return (
      <Button
        label={momPending ? 'Select Man of the Match' : 'Change Man of the Match'}
        disabled={working}
        onPress={onPress}
        variant={momPending ? 'secondary' : 'outline'}
        className={momPending ? 'h-12' : 'h-12 border-primary'}
        textClassName={momPending ? undefined : 'text-primary'}
      />
    );
  }

  if (momPending) {
    return (
      <View
        className={`gap-2 rounded-xl border p-4 ${
          overdue
            ? 'border-secondary-700 bg-secondary-100/30'
            : 'border-primary bg-primary-container/40'
        }`}
      >
        <Text
          className={`font-sans-bold text-lg ${
            overdue ? 'text-secondary-900' : 'text-primary'
          }`}
        >
          Man of the Match — Required
        </Text>
        {momEligibility?.dueAt ? (
          <Text
            className={`font-sans text-sm ${
              overdue ? 'text-secondary-900' : 'text-on-surface-variant'
            }`}
          >
            {overdue
              ? `Overdue — required by end of match day (${momEligibility.dueAt.slice(0, 10)})`
              : `Required by end of match day (${momEligibility.dueAt.slice(0, 10)})`}
          </Text>
        ) : null}
        <Text className="font-sans text-sm text-on-surface-variant">
          Select the player of the match from {winningTeamName}.
        </Text>
        <Button
          label="Select Man of the Match"
          disabled={working}
          onPress={onPress}
          className="h-11"
        />
      </View>
    );
  }

  return (
    <Button
      label="Change Man of the Match"
      disabled={working}
      onPress={onPress}
      variant="outline"
      className="h-11 border-primary"
      textClassName="text-primary"
    />
  );
}
