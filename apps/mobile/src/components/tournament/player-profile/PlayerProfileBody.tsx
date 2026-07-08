import type { TournamentPlayerProfileView } from '@acc/types';

import { PlayerCareerStatsContent } from './PlayerCareerStatsContent';
import { PlayerProfileHeader } from './PlayerProfileHeader';

export interface PlayerProfileBodyProps {
  profile: TournamentPlayerProfileView;
}

/** Player profile body without scroll wrapper — header, career cards, period drilldown. */
export function PlayerProfileBody({ profile }: PlayerProfileBodyProps): React.ReactElement {
  return (
    <>
      <PlayerProfileHeader profile={profile} />
      <PlayerCareerStatsContent
        ballTypeLabel={profile.ballTypeLabel}
        career={profile.career}
        byYear={profile.byYear}
        byTournament={profile.byTournament}
        showStumpingsCard={profile.showStumpingsCard}
      />
    </>
  );
}
