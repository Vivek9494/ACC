import type { StandingsTableSection } from '@acc/types';
import { View } from 'react-native';

import { INPUT_SHADOW_STYLE } from '../ui/fieldStyles';
import { StandingsPinnedSplitTableBody } from './StandingsTableStats';

export interface StandingsCombinedTableProps {
  section: StandingsTableSection;
  groupLabelByTeamId?: Record<string, string>;
}

/** Round-robin points table — one combined standings card for the whole tournament. */
export function StandingsCombinedTable({
  section,
  groupLabelByTeamId,
}: StandingsCombinedTableProps): React.ReactElement {
  return (
    <View
      className="overflow-hidden rounded-control border border-outline-variant bg-surface"
      style={INPUT_SHADOW_STYLE}
    >
      <StandingsPinnedSplitTableBody
        teams={section.teams}
        groupLabelByTeamId={groupLabelByTeamId}
      />
    </View>
  );
}
