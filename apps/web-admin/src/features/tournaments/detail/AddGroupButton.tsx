import { GROUP_FORM_MESSAGES, MatchSchedulingFormat, type TournamentDetail } from '@acc/types';
import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

import { GroupDialog, type GroupDialogValues } from './GroupDialog';
import { allTeamsAssigned, NEW_GROUP_PARAM } from './tournament-detail';
import { useGroupMutations, useTournamentGroups, useTournamentTeams } from './tournament-detail-api';

/**
 * Groups-tab header "Add New Group" for group managers; disabled once every team is in a group.
 * The first group finalizes Group Stage + Knockout.
 */
export function AddGroupButton({
  tournament,
}: {
  tournament: TournamentDetail;
}): React.ReactElement | null {
  const teams = useTournamentTeams(tournament.id);
  const groups = useTournamentGroups(tournament.id, true);
  const { create } = useGroupMutations(tournament.id);
  const [open, setOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const canManage = tournament.canScheduleMatches;
  const full = allTeamsAssigned(teams.data ?? []);

  useEffect(() => {
    if (!searchParams.has(NEW_GROUP_PARAM) || teams.isPending) return;
    if (canManage && !full) setOpen(true);
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete(NEW_GROUP_PARAM);
        return next;
      },
      { replace: true },
    );
  }, [canManage, full, searchParams, setSearchParams, teams.isPending]);

  if (!canManage) return null;

  const addGroup = async ({ name, teamIds }: GroupDialogValues) => {
    await create.mutateAsync({
      name,
      teamIds,
      ...(tournament.groupCount === 0
        ? { schedulingFormat: MatchSchedulingFormat.GroupStageKnockout }
        : {}),
    });
    toast.success(`${name} added`);
  };

  return (
    // Disabled buttons don't receive pointer events, so the hover target is the wrapper.
    <div
      className="group relative"
      tabIndex={full ? 0 : undefined}
      aria-describedby={full ? 'add-group-full' : undefined}
    >
      <Button onClick={() => setOpen(true)} disabled={full || teams.isPending}>
        <Plus />
        Add New Group
      </Button>
      {full ? (
        <span
          id="add-group-full"
          role="tooltip"
          className="pointer-events-none absolute top-full right-0 z-20 mt-2 rounded-md bg-secondary px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-secondary-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          {GROUP_FORM_MESSAGES.allTeamsAssigned}
        </span>
      ) : null}
      <GroupDialog
        open={open}
        onOpenChange={setOpen}
        group={null}
        groups={groups.data ?? []}
        teams={teams.data ?? []}
        onSubmit={addGroup}
      />
    </div>
  );
}
