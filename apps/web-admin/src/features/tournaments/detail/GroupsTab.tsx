import { GROUP_FORM_MESSAGES, type GroupSummary, shouldShowGroupsTab } from '@acc/types';
import { Layers, Lock } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { QueryErrorCard } from '@/components/QueryErrorCard';
import { RowActionsMenu } from '@/components/RowActionsMenu';
import { TeamLogo } from '@/components/TeamLogo';
import { Card, CardContent } from '@/components/ui/card';

import { GroupDialog, type GroupDialogValues } from './GroupDialog';
import { DETAIL_GRID, groupMemberDiff } from './tournament-detail';
import {
  useGroupMutations,
  useTournamentDetail,
  useTournamentGroups,
  useTournamentTeams,
} from './tournament-detail-api';

function GroupCard({
  group,
  onEdit,
  onDelete,
}: {
  group: GroupSummary;
  onEdit?: () => void;
  onDelete?: () => void;
}): React.ReactElement {
  return (
    <Card className="gap-0 py-0">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 leading-tight font-semibold break-words text-secondary" title={group.name}>
            {group.name}
          </p>
          <p className="text-xs text-muted-foreground">
            {group.teams.length} team{group.teams.length === 1 ? '' : 's'}
          </p>
        </div>
        {group.isLocked ? (
          <span title={GROUP_FORM_MESSAGES.locked} aria-label={GROUP_FORM_MESSAGES.locked} role="img">
            <Lock className="size-4 text-muted-foreground" />
          </span>
        ) : null}
        {onEdit || onDelete ? <RowActionsMenu label={group.name} onEdit={onEdit} onDelete={onDelete} /> : null}
      </div>
      <CardContent className="px-2 py-2">
        {group.teams.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">No teams in this group yet.</p>
        ) : (
          <ul>
            {group.teams.map((team) => (
              <li key={team.id} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50">
                <TeamLogo name={team.name} logoUrl={team.logoUrl} className="size-8 text-xs" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{team.name}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function GroupsTab(): React.ReactElement {
  const { tournamentId = '' } = useParams();
  const tournament = useTournamentDetail(tournamentId);
  const groups = useTournamentGroups(tournamentId, true);
  const teams = useTournamentTeams(tournamentId);
  const mutations = useGroupMutations(tournamentId);
  const [editing, setEditing] = useState<GroupSummary | null>(null);
  const [deleting, setDeleting] = useState<GroupSummary | null>(null);

  if (tournament.data && !shouldShowGroupsTab(tournament.data)) {
    return (
      <Card className="py-0">
        <CardContent className="py-16 text-center text-muted-foreground">
          Groups are only used by Group Stage + Knockout tournaments.
        </CardContent>
      </Card>
    );
  }
  if (groups.isError) {
    return <QueryErrorCard title="Couldn't load groups" error={groups.error} onRetry={() => void groups.refetch()} />;
  }
  if (groups.isPending) {
    return (
      <div className={DETAIL_GRID}>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-56 animate-pulse rounded-lg border bg-card" />
        ))}
      </div>
    );
  }

  const canManage = tournament.data?.canScheduleMatches === true;

  const saveGroup = async ({ name, teamIds }: GroupDialogValues) => {
    if (!editing) return;
    const diff = groupMemberDiff(
      editing.teams.map((team) => team.id),
      teamIds,
    );
    await mutations.update.mutateAsync({
      groupId: editing.id,
      body: {
        ...(name !== editing.name ? { name } : {}),
        ...(diff.addTeamIds.length > 0 ? { addTeamIds: diff.addTeamIds } : {}),
        ...(diff.removeTeamIds.length > 0 ? { removeTeamIds: diff.removeTeamIds } : {}),
      },
    });
    toast.success(`${name} updated`);
  };

  return (
    <div className="space-y-4">
      {groups.data.length === 0 ? (
        <Card className="py-0">
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <Layers className="size-8 text-primary" />
            No groups yet.
            {canManage ? ' Creating the first group sets this tournament to Group Stage + Knockout.' : ''}
          </CardContent>
        </Card>
      ) : (
        <div className={`${DETAIL_GRID} items-start`}>
          {groups.data.map((group) => {
            const manageable = canManage && !group.isLocked;
            return (
              <GroupCard
                key={group.id}
                group={group}
                onEdit={manageable ? () => setEditing(group) : undefined}
                onDelete={manageable ? () => setDeleting(group) : undefined}
              />
            );
          })}
        </div>
      )}

      <GroupDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        group={editing}
        groups={groups.data}
        teams={teams.data ?? []}
        onSubmit={saveGroup}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={GROUP_FORM_MESSAGES.delete.confirmTitle}
        description={deleting ? GROUP_FORM_MESSAGES.delete.confirmMessage(deleting.name) : ''}
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!deleting) return;
          await mutations.remove.mutateAsync(deleting.id);
          toast.success(`${deleting.name} deleted`);
        }}
      />
    </div>
  );
}
