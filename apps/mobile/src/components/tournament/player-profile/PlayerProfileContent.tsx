import type { TournamentPlayerProfileView } from '@acc/types';
import { ScrollView } from 'react-native';

import { PlayerProfileBody } from './PlayerProfileBody';

export interface PlayerProfileContentProps {
  profile: TournamentPlayerProfileView;
}

/** Full player profile body — header, career cards, and period drilldown. */
export function PlayerProfileContent({ profile }: PlayerProfileContentProps): React.ReactElement {
  return (
    <ScrollView className="flex-1" contentContainerClassName="px-4 pb-10 pt-2">
      <PlayerProfileBody profile={profile} />
    </ScrollView>
  );
}
