import { TabEmptyState } from '../ui/TabEmptyState';

const BatsmanIllustration = require('../../../assets/illustrations/batsman.png') as number;

export interface TournamentMatchesEmptyStateProps {
  canSchedule: boolean;
  onSchedulePress?: () => void;
}

/** Empty Matches tab — centered illustration; schedule CTA below when permitted. */
export function TournamentMatchesEmptyState({
  canSchedule,
  onSchedulePress,
}: TournamentMatchesEmptyStateProps): React.ReactElement {
  if (canSchedule && onSchedulePress) {
    return (
      <TabEmptyState
        image={BatsmanIllustration}
        buttonLabel="Schedule Matches"
        buttonVariant="amber"
        onPress={onSchedulePress}
      />
    );
  }

  return (
    <TabEmptyState
      image={BatsmanIllustration}
      message="No matches scheduled yet."
    />
  );
}
