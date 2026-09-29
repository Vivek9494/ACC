import { formatCanadianMobileForDisplay, type TeamDetailView, type TeamSummary } from '@acc/types';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { UserAvatar } from '@/components/UserAvatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { errorMessage } from '@/lib/api-client';

import { RoleCheckbox } from './RoleCheckbox';
import {
  roleSelectionFromRoster,
  type TeamRoleSelection,
  teamRoleColumns,
  toAssignRolesRequest,
} from './team-roles';
import { useRosterMutations } from './tournament-detail-api';

/** Captain / Vice-Captain (/ Manager for tennis) for players already on the team; current holders pre-checked. */
export function AssignRolesDialog({
  tournamentId,
  team,
  roster,
  onOpenChange,
}: {
  tournamentId: string;
  team: TeamSummary | null;
  roster: TeamDetailView | undefined;
  onOpenChange: (open: boolean) => void;
}): React.ReactElement {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={team !== null} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-3xl">
        {team && roster ? (
          <AssignRolesBody
            key={team.id}
            tournamentId={tournamentId}
            team={team}
            roster={roster}
            onBusyChange={setBusy}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function AssignRolesBody({
  tournamentId,
  team,
  roster,
  onBusyChange,
  onDone,
}: {
  tournamentId: string;
  team: TeamSummary;
  roster: TeamDetailView;
  onBusyChange: (busy: boolean) => void;
  onDone: () => void;
}): React.ReactElement {
  const { assignRoles } = useRosterMutations(tournamentId);
  const [initial] = useState(() => roleSelectionFromRoster(roster.players));
  const [selection, setSelection] = useState<TeamRoleSelection>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const columns = teamRoleColumns(roster.ballType);
  const changed = columns.some((c) => selection[c.key] !== initial[c.key]);

  const save = async () => {
    setPending(true);
    onBusyChange(true);
    setError(null);
    try {
      await assignRoles.mutateAsync({
        teamId: team.id,
        body: toAssignRolesRequest(selection, roster.ballType),
      });
      toast.success(`${team.name} roles updated`);
      onBusyChange(false);
      onDone();
    } catch (err) {
      setError(errorMessage(err));
      onBusyChange(false);
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Assign Roles — {team.name}</DialogTitle>
        <DialogDescription>
          One player per role, and a player can hold only one role.
        </DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-md border">
        {roster.players.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Add players to this team first.
          </p>
        ) : (
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted">
              <TableRow>
                <TableHead>Player</TableHead>
                <TableHead>Mobile</TableHead>
                {columns.map((c) => (
                  <TableHead key={c.key} className="text-center">
                    {c.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {roster.players.map((player) => {
                const name = `${player.firstName} ${player.lastName}`;
                return (
                  <TableRow key={player.userId}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <UserAvatar person={player} className="size-8" />
                        <span className="font-medium">{name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {player.mobileNumber
                        ? formatCanadianMobileForDisplay(player.mobileNumber)
                        : '—'}
                    </TableCell>
                    {columns.map((c) => (
                      <TableCell key={c.key} className="text-center">
                        <RoleCheckbox
                          selection={selection}
                          onChange={setSelection}
                          userId={player.userId}
                          playerName={name}
                          role={c.key}
                          label={c.label}
                          locked={pending}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
        >
          {error}
        </p>
      ) : null}

      <DialogFooter>
        <Button variant="outline" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button onClick={() => void save()} disabled={pending || !changed}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          Save roles
        </Button>
      </DialogFooter>
    </>
  );
}
