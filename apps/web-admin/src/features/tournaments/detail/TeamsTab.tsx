import { TEAM_FORM_MESSAGES, type TeamDetailPlayerRow, type TeamDetailView, type TeamSummary } from '@acc/types';
import type { UseQueryResult } from '@tanstack/react-query';
import { ShieldCheck, Trash2, UserPlus, Users } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { QueryErrorCard } from '@/components/QueryErrorCard';
import { type RowAction, RowActionsMenu } from '@/components/RowActionsMenu';
import { TeamLogo } from '@/components/TeamLogo';
import { UserAvatar } from '@/components/UserAvatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

import { AddPlayersDialog } from './AddPlayersDialog';
import { AssignRolesDialog } from './AssignRolesDialog';
import { TeamDialog, type TeamDialogValues } from './TeamDialog';
import { DETAIL_GRID } from './tournament-detail';
import {
  useRosterMutations,
  useTeamMutations,
  useTeamRosters,
  useTournamentDetail,
  useTournamentTeams,
} from './tournament-detail-api';

function roleTag(player: TeamDetailPlayerRow): string | null {
  if (player.isCaptain) return 'C';
  if (player.isViceCaptain) return 'VC';
  if (player.isManager) return 'M';
  return null;
}

function TeamCard({
  team,
  roster,
  onEdit,
  actions,
  onDelete,
  onRemovePlayer,
}: {
  team: TeamSummary;
  roster: UseQueryResult<TeamDetailView>;
  onEdit?: () => void;
  actions: readonly RowAction[];
  onDelete?: () => void;
  onRemovePlayer?: (player: TeamDetailPlayerRow) => void;
}): React.ReactElement {
  const players = roster.data?.players ?? [];
  return (
    <Card className="gap-0 py-0">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <TeamLogo name={team.name} logoUrl={team.logoUrl} className="size-10 text-sm" />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 leading-tight font-semibold break-words text-secondary" title={team.name}>
            {team.name}
          </p>
          <p className="text-xs text-muted-foreground">
            {team.memberCount} player{team.memberCount === 1 ? '' : 's'}
            {team.groupName ? ` · ${team.groupName}` : ''}
          </p>
        </div>
        {onEdit || onDelete || actions.length > 0 ? (
          <RowActionsMenu label={team.name} onEdit={onEdit} actions={actions} onDelete={onDelete} />
        ) : null}
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
              const name = `${player.firstName} ${player.lastName}`;
              return (
                <li key={player.userId} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50">
                  <UserAvatar person={player} className="size-8" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
                  {tag ? (
                    <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">
                      {tag}
                    </span>
                  ) : null}
                  {onRemovePlayer ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-destructive"
                      aria-label={`Remove ${name} from ${team.name}`}
                      onClick={() => onRemovePlayer(player)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
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
  const tournament = useTournamentDetail(tournamentId);
  const teams = useTournamentTeams(tournamentId);
  const rosters = useTeamRosters(tournamentId, teams.data ?? []);
  const mutations = useTeamMutations(tournamentId);
  const { removePlayer } = useRosterMutations(tournamentId);
  const [editing, setEditing] = useState<TeamSummary | null>(null);
  const [deleting, setDeleting] = useState<TeamSummary | null>(null);
  const [addingTo, setAddingTo] = useState<TeamSummary | null>(null);
  const [assigningFor, setAssigningFor] = useState<TeamSummary | null>(null);
  const [removing, setRemoving] = useState<{ team: TeamSummary; player: TeamDetailPlayerRow } | null>(null);

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

  const canManage = tournament.data?.canEdit === true;
  const rosterOf = (team: TeamSummary | null): TeamDetailView | undefined =>
    team ? rosters[teams.data.findIndex((t) => t.id === team.id)]?.data : undefined;

  const teamActions = (team: TeamSummary, roster: TeamDetailView | undefined): RowAction[] => {
    if (!roster) return [];
    const actions: RowAction[] = [];
    if (roster.canAddPlayers && roster.rosterSlotsRemaining !== 0) {
      actions.push({ label: 'Add Player', icon: UserPlus, onSelect: () => setAddingTo(team) });
    }
    if (roster.canAssignTeamRoles && roster.players.length > 0) {
      actions.push({ label: 'Assign Role', icon: ShieldCheck, onSelect: () => setAssigningFor(team) });
    }
    return actions;
  };

  const saveTeam = async ({ name, logoStorageKey }: TeamDialogValues) => {
    if (!editing) return;
    await mutations.update.mutateAsync({
      teamId: editing.id,
      body: { name, ...(logoStorageKey !== undefined ? { logoUrl: logoStorageKey } : {}) },
    });
    toast.success(`${name} updated`);
  };

  return (
    <div className="space-y-4">
      {teams.data.length === 0 ? (
        <Card className="py-0">
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <Users className="size-8 text-primary" />
            No teams have been created for this tournament yet.
          </CardContent>
        </Card>
      ) : (
        <div className={`${DETAIL_GRID} items-start`}>
          {teams.data.map((team, index) => {
            const roster = rosters[index];
            return roster ? (
              <TeamCard
                key={team.id}
                team={team}
                roster={roster}
                onEdit={canManage ? () => setEditing(team) : undefined}
                actions={teamActions(team, roster.data)}
                onDelete={canManage && !team.hasMatches ? () => setDeleting(team) : undefined}
                onRemovePlayer={roster.data?.canRemovePlayers ? (player) => setRemoving({ team, player }) : undefined}
              />
            ) : null;
          })}
        </div>
      )}

      <TeamDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        team={editing}
        teams={teams.data}
        onSubmit={saveTeam}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={TEAM_FORM_MESSAGES.delete.confirmTitle}
        description={deleting ? TEAM_FORM_MESSAGES.delete.confirmMessage(deleting.name) : ''}
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!deleting) return;
          await mutations.remove.mutateAsync(deleting.id);
          toast.success(`${deleting.name} deleted`);
        }}
      />
      <AddPlayersDialog
        tournamentId={tournamentId}
        team={addingTo}
        roster={rosterOf(addingTo)}
        onOpenChange={(open) => !open && setAddingTo(null)}
      />
      <AssignRolesDialog
        tournamentId={tournamentId}
        team={assigningFor}
        roster={rosterOf(assigningFor)}
        onOpenChange={(open) => !open && setAssigningFor(null)}
      />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Remove Player?"
        description={
          removing
            ? `Remove ${removing.player.firstName} ${removing.player.lastName} from ${removing.team.name}?${
                removing.player.isCaptain || removing.player.isViceCaptain || removing.player.isManager
                  ? ' Their leadership role on this team is cleared too.'
                  : ''
              }`
            : ''
        }
        confirmLabel="Remove"
        destructive
        onConfirm={async () => {
          if (!removing) return;
          await removePlayer.mutateAsync({ teamId: removing.team.id, userId: removing.player.userId });
          toast.success(`${removing.player.firstName} ${removing.player.lastName} removed from ${removing.team.name}`);
        }}
      />
    </div>
  );
}
