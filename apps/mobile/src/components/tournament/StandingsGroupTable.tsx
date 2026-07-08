import type { StandingsTableSection } from '@acc/types';
import { View } from 'react-native';

import { INPUT_SHADOW_STYLE } from '../ui/fieldStyles';
import { TournamentGroupCardHeaderWithCount } from './TournamentGroupCard';
import { StandingsPinnedSplitTableBody } from './StandingsTableStats';

export interface StandingsGroupTableProps {
  section: StandingsTableSection;
  showGroupHeader: boolean;
}

/** Group-stage points table — one card per group with M/W/L/NR/PTS/NRR stat columns. */
export function StandingsGroupTable({
  section,
  showGroupHeader,
}: StandingsGroupTableProps): React.ReactElement {
  return (
    <View
      className="overflow-hidden rounded-control border border-outline-variant bg-surface"
      style={INPUT_SHADOW_STYLE}
    >
      {showGroupHeader ? (
        <TournamentGroupCardHeaderWithCount
          groupName={section.groupName}
          teamCount={section.teams.length}
        />
      ) : null}

      <StandingsPinnedSplitTableBody teams={section.teams} />
    </View>
  );
}
