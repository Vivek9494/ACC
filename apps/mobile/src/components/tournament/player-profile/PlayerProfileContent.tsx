import type { TournamentPlayerProfileView } from '@acc/types';
import { ScrollView, View } from 'react-native';

import { PlayerProfileBallTypeLabel, PlayerProfileHeader } from './PlayerProfileHeader';
import { PlayerProfileCareerStatsGrid } from './PlayerProfileCareerStatsGrid';
import { PlayerProfilePeriodSection } from './PlayerProfilePeriodSection';
import { VerifyPlayerRatingsRow } from '../verify-players/VerifyPlayerRatingsRow';

export interface PlayerProfileContentProps {
  profile: TournamentPlayerProfileView;
}

/** Full player profile body — header, career cards, and period drilldown. */
export function PlayerProfileContent({ profile }: PlayerProfileContentProps): React.ReactElement {
  return (
    <ScrollView className="flex-1" contentContainerClassName="px-4 pb-10 pt-2">
      <PlayerProfileHeader profile={profile} />
      <View className="mb-4">
        <VerifyPlayerRatingsRow
          batting={profile.battingRating}
          bowling={profile.bowlingRating}
          fielding={profile.fieldingRating}
        />
      </View>
      <PlayerProfileBallTypeLabel label={profile.ballTypeLabel} />
      <PlayerProfileCareerStatsGrid
        career={profile.career}
        showStumpingsCard={profile.showStumpingsCard}
      />
      <View className="mt-8">
        <PlayerProfilePeriodSection
          byYear={profile.byYear}
          byTournament={profile.byTournament}
        />
      </View>
    </ScrollView>
  );
}
