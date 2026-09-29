import { TournamentDisplayStatus, type TournamentSummary } from '@acc/types';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ApiError } from '@/lib/api-client';

import { useDeleteTournament } from './tournament-manage-api';

export type DeletableTournament = Pick<TournamentSummary, 'id' | 'name' | 'displayStatus'>;

export function deleteTournamentDescription(tournament: DeletableTournament): string {
  const base = `Delete "${tournament.name}"? It will be removed for everyone`;
  switch (tournament.displayStatus) {
    case TournamentDisplayStatus.Live:
      return `${base}. This tournament is LIVE — scoring and live updates stop immediately.`;
    case TournamentDisplayStatus.Completed:
      return `${base}. This tournament is completed — its results, scorecards and stats will no longer be shown.`;
    default:
      return `${base}, and registered players are notified if registration is open.`;
  }
}

/** Same confirm as mobile's "Delete Tournament?" alert; the server re-checks organizer permission. */
export function DeleteTournamentDialog({
  tournament,
  onOpenChange,
  onDeleted,
}: {
  tournament: DeletableTournament | null;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}): React.ReactElement {
  const deleteTournament = useDeleteTournament();

  return (
    <ConfirmDialog
      open={tournament !== null}
      onOpenChange={onOpenChange}
      title="Delete Tournament?"
      description={tournament ? deleteTournamentDescription(tournament) : ''}
      confirmLabel="Delete"
      destructive
      onConfirm={async () => {
        if (!tournament) return;
        try {
          await deleteTournament.mutateAsync(tournament.id);
        } catch (err) {
          if (err instanceof ApiError && err.status === 403) {
            throw new Error('You do not have permission to delete this tournament.');
          }
          throw err;
        }
        toast.success(`${tournament.name} deleted`);
        onDeleted?.();
      }}
    />
  );
}
