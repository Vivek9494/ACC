import type { TeamDetailPlayerRow, TeamDetailView, TeamSummary } from '@acc/types';
import type { UseQueryResult } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { useParams } from 'react-router';

import { QueryErrorCard } from '@/components/QueryErrorCard';
import { TeamLogo } from '@/components/TeamLogo';
import { UserAvatar } from '@/components/UserAvatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

import { DETAIL_GRID } from './tournament-detail';
import { useTeamRosters, useTournamentTeams } from './tournament-detail-api';

function roleTag(player: TeamDetailPlayerRow): string | null {
  if (player.isCaptain) return 'C';
  if (player.isViceCaptain) return 'VC';
  if (player.isManager) return 'M';
  return null;
}

function TeamCard({ team, roster }: { team: TeamSummary; roster: UseQueryResult<TeamDetailView> }): React.ReactElement {
  const players = roster.data?.players ?? [];
  return (
    <Card className="gap-0 py-0">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <TeamLogo name={team.name} logoUrl={team.logoUrl} className="size-10 text-sm" />
        <div className="min-w-0">
          <p className="line-clamp-2 leading-tight font-semibold text-secondary">{team.name}</p>
          <p className="text-xs text-muted-foreground">
            {team.memberCount} player{team.memberCount === 1 ? '' : 's'}
            {team.groupName ? ` · ${team.groupName}` : ''}
          </p>
        </div>
      </div>
      <CardContent className="px-2 py-2">
        {roster.isPending ? (
          <ul className="space-y-1 px-2 py-1">
            {Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="flex items-center gap-3 py-1.5">
                <span className="size-8 animate-pulse rounded-full bg-muted" />
                <span className="h-3.5 w-32 animate-pulse rounded bg-muted" />
              </li>
            ))}
          </ul>
        ) : roster.isError ? (
          <div className="flex flex-col items-center gap-2 px-2 py-6 text-center text-sm text-muted-foreground">
            Couldn't load this roster.
            <Button variant="outline" size="sm" onClick={() => void roster.refetch()}>
              Try again
            </Button>
          </div>
        ) : players.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">No players on this team yet.</p>
        ) : (
          <ul>
            {players.map((player) => {
              const tag = roleTag(player);
              return (
                <li key={player.userId} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50">
                  <UserAvatar person={player} className="size-8" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {player.firstName} {player.lastName}
                  </span>
                  {tag ? (
                    <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">
                      {tag}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function TeamsTab(): React.ReactElement {
  const { tournamentId = '' } = useParams();
  const teams = useTournamentTeams(tournamentId);
  const rosters = useTeamRosters(tournamentId, teams.data ?? []);

  if (teams.isError) {
    return <QueryErrorCard title="Couldn't load teams" error={teams.error} onRetry={() => void teams.refetch()} />;
  }
  if (teams.isPending) {
    return (
      <div className={DETAIL_GRID}>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-72 animate-pulse rounded-lg border bg-card" />
        ))}
      </div>
    );
  }
  if (teams.data.length === 0) {
    return (
      <Card className="py-0">
        <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
          <Users className="size-8 text-primary" />
          No teams have been created for this tournament yet.
        </CardContent>
      </Card>
    );
  }
  return (
    <div className={`${DETAIL_GRID} items-start`}>
      {teams.data.map((team, index) => {
        const roster = rosters[index];
        return roster ? <TeamCard key={team.id} team={team} roster={roster} /> : null;
      })}
    </div>
  );
}
