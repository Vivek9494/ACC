import type {
  PlayerProfileCareerStats,
  PlayerProfileTournamentSummary,
  PlayerProfileYearSummary,
} from '@acc/types';
import { View } from 'react-native';

import { PlayerProfileBallTypeLabel } from './PlayerProfileHeader';
import { PlayerProfileCareerStatsGrid } from './PlayerProfileCareerStatsGrid';
import { PlayerProfilePeriodSection } from './PlayerProfilePeriodSection';

export interface PlayerCareerStatsContentProps {
  ballTypeLabel: string;
  career: PlayerProfileCareerStats;
  byYear: PlayerProfileYearSummary[];
  byTournament: PlayerProfileTournamentSummary[];
  showStumpingsCard: boolean;
  /** When true, omits the ball-type caption (e.g. when Leather/Tennis sub-tabs are shown). */
  hideBallTypeLabel?: boolean;
  /** Optional slot after the career stat grid (e.g. Man of the Match on the Stats tab). */
  afterStatsGrid?: React.ReactNode;
}

/** Career stat cards + period drilldowns (shared by tournament and admin user stats). */
export function PlayerCareerStatsContent({
  ballTypeLabel,
  career,
  byYear,
  byTournament,
  showStumpingsCard,
  hideBallTypeLabel = false,
  afterStatsGrid,
}: PlayerCareerStatsContentProps): React.ReactElement {
  return (
    <View>
      {hideBallTypeLabel ? null : <PlayerProfileBallTypeLabel label={ballTypeLabel} />}
      <PlayerProfileCareerStatsGrid career={career} showStumpingsCard={showStumpingsCard} />
      {afterStatsGrid ? <View className="mt-3">{afterStatsGrid}</View> : null}
      <View className="mt-8">
        <PlayerProfilePeriodSection byYear={byYear} byTournament={byTournament} />
      </View>
    </View>
  );
}
