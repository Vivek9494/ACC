import type { GroupSummary } from '@acc/types';

import { TournamentGroupCard } from './TournamentGroupCard';

export interface TournamentGroupSectionProps {
  group: GroupSummary;
}

/** Groups tab card — shared group-card shell, team list only (no stats columns). */
export function TournamentGroupSection({ group }: TournamentGroupSectionProps): React.ReactElement {
  return (
    <TournamentGroupCard
      groupName={group.name}
      teams={group.teams.map((team) => ({
        id: team.id,
        name: team.name,
        logoUrl: team.logoUrl,
      }))}
      emptyMessage="No teams assigned yet."
    />
  );
}
