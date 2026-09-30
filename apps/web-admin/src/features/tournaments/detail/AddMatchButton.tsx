import {
  isMatchSchedulingFormatLocked,
  MATCH_SCHEDULING_FORMAT_LABELS,
  MATCH_SCHEDULING_FORMAT_OPTIONS,
  MatchSchedulingFormat,
  scheduleMatchesGuardMessage,
  type TournamentDetail,
} from '@acc/types';
import { GitBranch, Loader2, type LucideIcon, Pencil, Plus, Repeat, Users } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { errorMessage } from '@/lib/api-client';

import { MatchSetupDialog } from './MatchSetupDialog';
import { useMatchMutations } from './tournament-detail-api';

const FORMAT_ICONS: Record<MatchSchedulingFormat, LucideIcon> = {
  [MatchSchedulingFormat.RoundRobin]: Repeat,
  [MatchSchedulingFormat.GroupStageKnockout]: GitBranch,
  [MatchSchedulingFormat.Manual]: Pencil,
};

type Step =
  | { kind: 'idle' }
  | { kind: 'no-teams' }
  | { kind: 'format' }
  | { kind: 'groups-required' }
  | { kind: 'setup'; format: MatchSchedulingFormat };

function NoticeDialog({
  open,
  onClose,
  title,
  message,
  action,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  action?: React.ReactNode;
}): React.ReactElement {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-sm" showClose={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {action}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Matches-tab header "Add Match" — mobile's Schedule Matches flow: team guard → Select Format →
 * group guard → Match Setup. A locked Group Stage + Knockout skips the format picker.
 */
export function AddMatchButton({
  tournament,
}: {
  tournament: TournamentDetail;
}): React.ReactElement | null {
  const navigate = useNavigate();
  const { selectFormat } = useMatchMutations(tournament.id);
  const [step, setStep] = useState<Step>({ kind: 'idle' });
  const [formatError, setFormatError] = useState<string | null>(null);

  if (!tournament.canScheduleMatches) return null;

  const close = () => setStep({ kind: 'idle' });
  const teamCount = tournament.teams.length;

  const start = () => {
    setFormatError(null);
    if (teamCount < 2) {
      setStep({ kind: 'no-teams' });
    } else if (
      isMatchSchedulingFormatLocked(tournament.matchSchedulingFormat, tournament.groupCount)
    ) {
      setStep({ kind: 'setup', format: MatchSchedulingFormat.GroupStageKnockout });
    } else {
      setStep({ kind: 'format' });
    }
  };

  const pick = async (format: MatchSchedulingFormat) => {
    setFormatError(null);
    if (format === MatchSchedulingFormat.GroupStageKnockout && tournament.groupCount === 0) {
      setStep({ kind: 'groups-required' });
      return;
    }
    try {
      await selectFormat.mutateAsync(format);
      setStep({ kind: 'setup', format });
    } catch (err) {
      setFormatError(errorMessage(err, 'Could not save scheduling format.'));
    }
  };

  return (
    <>
      <Button onClick={start}>
        <Plus />
        Add Match
      </Button>

      <NoticeDialog
        open={step.kind === 'no-teams'}
        onClose={close}
        title="Schedule Matches"
        message={scheduleMatchesGuardMessage(teamCount, tournament.canEdit)}
        action={
          tournament.canEdit ? (
            <Button
              onClick={() =>
                void navigate(`/tournaments/${encodeURIComponent(tournament.id)}/teams`)
              }
            >
              <Users />
              Go to Teams
            </Button>
          ) : undefined
        }
      />

      <Dialog
        open={step.kind === 'format'}
        onOpenChange={(next) => !next && !selectFormat.isPending && close()}
      >
        <DialogContent className="max-w-sm" showClose={false}>
          <DialogHeader>
            <DialogTitle>Select Format</DialogTitle>
            <DialogDescription>
              How do you want to schedule matches for this tournament?
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {MATCH_SCHEDULING_FORMAT_OPTIONS.map((format) => {
              const Icon = FORMAT_ICONS[format];
              const busy = selectFormat.isPending && selectFormat.variables === format;
              return (
                <button
                  key={format}
                  type="button"
                  onClick={() => void pick(format)}
                  disabled={selectFormat.isPending}
                  className="flex items-center gap-3 rounded-md border border-primary/40 bg-card px-4 py-3 text-left text-sm font-semibold transition-colors hover:bg-primary/5 disabled:opacity-60"
                >
                  {busy ? (
                    <Loader2 className="size-5 animate-spin text-primary" />
                  ) : (
                    <Icon className="size-5 text-primary" />
                  )}
                  {MATCH_SCHEDULING_FORMAT_LABELS[format]}
                </button>
              );
            })}
          </div>
          {formatError ? (
            <p role="alert" className="text-center text-sm text-destructive">
              {formatError}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={selectFormat.isPending}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NoticeDialog
        open={step.kind === 'groups-required'}
        onClose={close}
        title="Setup Required"
        message={
          tournament.canEdit
            ? 'Create Groups and add teams in the groups.'
            : 'Groups have not been set up for this tournament yet. Please check back later.'
        }
      />

      <MatchSetupDialog
        tournament={tournament}
        open={step.kind === 'setup'}
        onOpenChange={(open) => !open && close()}
        format={step.kind === 'setup' ? step.format : MatchSchedulingFormat.Manual}
        matchId={null}
      />
    </>
  );
}
