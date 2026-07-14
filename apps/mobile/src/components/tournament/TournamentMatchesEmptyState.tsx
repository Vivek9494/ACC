import { TabEmptyState } from '../ui/TabEmptyState';

const BatsmanIllustration = require('../../../assets/illustrations/batsman.png') as number;

export interface TournamentMatchesEmptyStateProps {
  /** When true with onSchedulePress, shows Schedule Matches on the empty illustration. */
  canSchedule?: boolean;
  onSchedulePress?: () => void;
  /**
   * Caption under the illustration. Pass `null` to hide (e.g. when CTAs sit above).
   * Default: `"No matches scheduled yet."`
   */
  message?: string | null;
}

/** Empty Matches tab — centered illustration; optional schedule CTA or message. */
export function TournamentMatchesEmptyState({
  canSchedule = false,
  onSchedulePress,
  message = 'No matches scheduled yet.',
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
      message={message ?? undefined}
    />
  );
}
