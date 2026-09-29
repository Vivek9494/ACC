import { teamCapError, type TournamentDetail } from '@acc/types';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

import { TeamDialog, type TeamDialogValues } from './TeamDialog';
import { useTeamMutations, useTournamentTeams } from './tournament-detail-api';

/** Header "Add Team" for organizers; disabled at the team cap. Lands on the Teams tab after adding. */
export function AddTeamButton({
  tournament,
}: {
  tournament: TournamentDetail;
}): React.ReactElement | null {
  const teams = useTournamentTeams(tournament.id);
  const { create } = useTeamMutations(tournament.id);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  if (!tournament.canEdit) return null;

  const teamCount = teams.data?.length ?? tournament.teamCount;
  const atCap = tournament.numberOfTeams > 0 && teamCount >= tournament.numberOfTeams;

  const addTeam = async ({ name, logoStorageKey }: TeamDialogValues) => {
    await create.mutateAsync({ name, logoUrl: logoStorageKey ?? null });
    toast.success(`${name} added`);
    if (!pathname.endsWith('/teams')) void navigate('teams');
  };

  return (
    // Disabled buttons don't receive pointer events, so the hover target is the wrapper.
    <div
      className="group relative"
      tabIndex={atCap ? 0 : undefined}
      aria-describedby={atCap ? 'add-team-cap' : undefined}
    >
      <Button onClick={() => setOpen(true)} disabled={atCap || teams.isPending}>
        <Plus />
        Add Team
      </Button>
      {atCap ? (
        <span
          id="add-team-cap"
          role="tooltip"
          className="pointer-events-none absolute top-full right-0 z-20 mt-2 rounded-md bg-secondary px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-secondary-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          {teamCapError(tournament.numberOfTeams)}
        </span>
      ) : null}
      <TeamDialog
        open={open}
        onOpenChange={setOpen}
        team={null}
        teams={teams.data ?? []}
        onSubmit={addTeam}
      />
    </div>
  );
}
