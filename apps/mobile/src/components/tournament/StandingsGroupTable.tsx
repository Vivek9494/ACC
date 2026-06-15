import type { StandingsTableSection } from '@acc/types';
import { ScrollView, View } from 'react-native';

import { GroupCardTeam, TournamentGroupCard } from './TournamentGroupCard';
import { StandingsStatsDataRow, StandingsStatsHeaderRow } from './StandingsTableStats';

function toGroupCardTeams(section: StandingsTableSection): GroupCardTeam[] {
  return section.teams.map((team) => ({
    id: team.teamId,
    name: team.teamName,
    logoUrl: team.logoUrl,
  }));
}

export interface StandingsGroupTableProps {
  section: StandingsTableSection;
  showGroupHeader: boolean;
}

/** Group-stage points table — one card per group with M/W/L/NR/PTS/NRR stat columns. */
export function StandingsGroupTable({
  section,
  showGroupHeader,
}: StandingsGroupTableProps): React.ReactElement {
  const lastIndex = section.teams.length - 1;

  return (
    <TournamentGroupCard
      groupName={section.groupName}
      teams={toGroupCardTeams(section)}
      showGroupHeader={showGroupHeader}
      statsContent={
        <ScrollView horizontal bounces={false} showsHorizontalScrollIndicator={false}>
          <View>
            <StandingsStatsHeaderRow />
            {section.teams.map((row, index) => (
              <StandingsStatsDataRow
                key={row.teamId}
                row={row}
                showBottomDivider={index < lastIndex}
              />
            ))}
          </View>
        </ScrollView>
      }
    />
  );
}
