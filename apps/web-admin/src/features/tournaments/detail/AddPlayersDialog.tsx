import {
  formatCanadianMobileForDisplay,
  RegistrationPlayerType,
  type TeamDetailView,
  type TeamSummary,
  type UnassignedTeamPlayerCandidate,
} from '@acc/types';
import { Loader2, Search, UserPlus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { UserAvatar } from '@/components/UserAvatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
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
  EMPTY_ROLE_SELECTION,
  hasAnyLeadership,
  rolesHeldBy,
  type TeamRoleSelection,
  teamRoleColumns,
  toAssignRolesRequest,
} from './team-roles';
import { useAddPlayerCandidates, useRosterMutations } from './tournament-detail-api';

const rating = (value: number | null): string => (value == null ? '—' : String(value));
const fullName = (p: { firstName: string; lastName: string }): string =>
  `${p.firstName} ${p.lastName}`;

/** Registered players not on any team → add one at a time, optionally naming Captain / VC (/ Manager). */
export function AddPlayersDialog({
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
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-5xl">
        {team && roster ? (
          <AddPlayersBody
            key={team.id}
            tournamentId={tournamentId}
            team={team}
            roster={roster}
            onBusyChange={setBusy}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function AddPlayersBody({
  tournamentId,
  team,
  roster,
  onBusyChange,
}: {
  tournamentId: string;
  team: TeamSummary;
  roster: TeamDetailView;
  onBusyChange: (busy: boolean) => void;
}): React.ReactElement {
  const candidates = useAddPlayerCandidates(tournamentId, team.id);
  const { addPlayers, assignRoles } = useRosterMutations(tournamentId);
  const [search, setSearch] = useState('');
  const [selection, setSelection] = useState<TeamRoleSelection>(EMPTY_ROLE_SELECTION);
  // Snapshot at open so the Role column doesn't vanish once the first leader is named.
  const [showRoles] = useState(() => roster.canAssignTeamRoles && !hasAnyLeadership(roster));
  const [addingId, setAddingIdState] = useState<string | null>(null);
  const setAddingId = (id: string | null) => {
    setAddingIdState(id);
    onBusyChange(id !== null);
  };

  const rows = useMemo((): UnassignedTeamPlayerCandidate[] => {
    const data = candidates.data;
    if (!data) return [];
    const all = data.showPlayerTypeTabs
      ? [...data.fulltimeCandidates, ...data.parttimeCandidates]
      : data.candidates;
    const query = search.trim().toLowerCase();
    return all
      .filter((p) => !query || fullName(p).toLowerCase().includes(query))
      .sort(
        (a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName),
      );
  }, [candidates.data, search]);

  const ballType = roster.ballType;
  const roleColumns = showRoles ? teamRoleColumns(ballType) : [];
  const slotsRemaining = candidates.data?.rosterSlotsRemaining ?? roster.rosterSlotsRemaining;
  const full = slotsRemaining === 0;

  const add = async (player: UnassignedTeamPlayerCandidate) => {
    const name = fullName(player);
    setAddingId(player.userId);
    try {
      await addPlayers.mutateAsync({ teamId: team.id, body: { userIds: [player.userId] } });
    } catch (err) {
      toast.error(errorMessage(err));
      setAddingId(null);
      return;
    }
    const roles = rolesHeldBy(selection, player.userId);
    if (roles.length > 0) {
      try {
        await assignRoles.mutateAsync({
          teamId: team.id,
          body: toAssignRolesRequest(selection, ballType, roles),
        });
        const labels = roleColumns.filter((c) => roles.includes(c.key)).map((c) => c.label);
        toast.success(`${name} added as ${labels.join(' & ')}`);
      } catch (err) {
        setSelection((s) => ({ ...s, ...Object.fromEntries(roles.map((r) => [r, null])) }));
        toast.error(`${name} was added, but the role wasn't assigned: ${errorMessage(err)}`);
      }
    } else {
      toast.success(`${name} added to ${team.name}`);
    }
    setAddingId(null);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add Players — {team.name}</DialogTitle>
        <DialogDescription>
          Registered players who aren't on any team yet.
          {slotsRemaining != null
            ? ` ${slotsRemaining} slot${slotsRemaining === 1 ? '' : 's'} left.`
            : ''}
          {roleColumns.length > 0 ? ' Tick a role before adding to name the team leaders.' : ''}
        </DialogDescription>
      </DialogHeader>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search players"
          className="pl-9"
          aria-label="Search players"
        />
      </div>

      {full ? (
        <p
          role="status"
          className="rounded-md bg-primary/10 px-3 py-2 text-sm font-medium text-accent-foreground"
        >
          Team reached max capacity.
        </p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto rounded-md border">
        {candidates.isPending ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : candidates.isError ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
            {errorMessage(candidates.error)}
            <Button variant="outline" size="sm" onClick={() => void candidates.refetch()}>
              Try again
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {search
              ? 'No players match your search.'
              : 'Every registered player is already on a team.'}
          </p>
        ) : (
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted">
              <TableRow>
                <TableHead>Player</TableHead>
                <TableHead>Mobile</TableHead>
                <TableHead className="text-center">Bat</TableHead>
                <TableHead className="text-center">Bowl</TableHead>
                <TableHead className="text-center">Field</TableHead>
                {roleColumns.map((c) => (
                  <TableHead key={c.key} className="text-center">
                    {c.label}
                  </TableHead>
                ))}
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((player) => {
                const name = fullName(player);
                return (
                  <TableRow key={player.userId}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <UserAvatar person={player} className="size-8" />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{name}</p>
                          <p className="text-xs text-muted-foreground">
                            {player.centerName}
                            {player.playerType
                              ? ` · ${player.playerType === RegistrationPlayerType.FullTime ? 'Full-time' : 'Part-time'}`
                              : ''}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {player.mobileNumber
                        ? formatCanadianMobileForDisplay(player.mobileNumber)
                        : '—'}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      {rating(player.battingRating)}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      {rating(player.bowlingRating)}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      {rating(player.fieldingRating)}
                    </TableCell>
                    {roleColumns.map((c) => (
                      <TableCell key={c.key} className="text-center">
                        <RoleCheckbox
                          selection={selection}
                          onChange={setSelection}
                          userId={player.userId}
                          playerName={name}
                          role={c.key}
                          label={c.label}
                          locked={addingId !== null}
                        />
                      </TableCell>
                    ))}
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() => void add(player)}
                        disabled={full || addingId !== null}
                        aria-label={`Add ${name}`}
                      >
                        {addingId === player.userId ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <UserPlus />
                        )}
                        Add
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </>
  );
}
