import {
  MatchCardDisplayState,
  MatchSchedulingFormat,
  resolveMatchStateBadge,
  type MatchListItem,
  type MatchListTeamView,
} from '@acc/types';
import { CalendarDays, MapPin } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { QueryErrorCard } from '@/components/QueryErrorCard';
import { RowActionsMenu } from '@/components/RowActionsMenu';
import { TeamLogo } from '@/components/TeamLogo';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import { DETAIL_GRID, formatMatchWhen, splitScoreLine, visibleMatches } from './tournament-detail';
import { canDeleteMatch, canEditMatch } from './match-setup';
import { MatchSetupDialog } from './MatchSetupDialog';
import { useMatchMutations, useTournamentDetail, useTournamentMatches } from './tournament-detail-api';

const DISPLAY_BADGE: Record<MatchCardDisplayState, 'live' | 'upcoming' | 'muted' | 'destructive'> = {
  [MatchCardDisplayState.Live]: 'live',
  [MatchCardDisplayState.Scheduled]: 'upcoming',
  [MatchCardDisplayState.Completed]: 'muted',
  [MatchCardDisplayState.Cancelled]: 'destructive',
};

function TeamLine({ team }: { team: MatchListTeamView }): React.ReactElement {
  const line = team.scoreLine ? splitScoreLine(team.scoreLine) : null;
  return (
    <div className="flex items-center gap-2.5">
      <TeamLogo name={team.name} logoUrl={team.logoUrl} className="size-7 text-[11px]" />
      <span className="line-clamp-2 min-w-0 flex-1 text-sm leading-tight font-semibold">{team.name}</span>
      {line ? (
        <span className="shrink-0 text-right leading-tight whitespace-nowrap tabular-nums">
          <span className="block text-sm font-bold text-secondary">{line.score}</span>
          {line.overs ? <span className="block text-[11px] text-muted-foreground">{line.overs} ov</span> : null}
        </span>
      ) : null}
    </div>
  );
}

function MatchCard({
  match,
  onEdit,
  onDelete,
}: {
  match: MatchListItem;
  onEdit?: () => void;
  onDelete?: () => void;
}): React.ReactElement {
  const live = match.displayState === MatchCardDisplayState.Live;
  const hasActions = Boolean(onEdit || onDelete);
  return (
    <div className="relative">
      <Link
        to={match.id}
        className="group block h-full rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
        aria-label={`${match.teamA.name} vs ${match.teamB.name} scorecard`}
      >
        <Card
          className={cn(
            'h-full gap-3 py-4 transition-shadow group-hover:border-primary/40 group-hover:shadow-md',
            live && 'border-primary/50',
          )}
        >
          <div className={cn('flex items-center justify-between gap-2 px-4', hasActions && 'pr-12')}>
            <span className="truncate text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {[match.matchCode, match.groupName].filter(Boolean).join(' · ') || 'Match'}
            </span>
            <Badge variant={DISPLAY_BADGE[match.displayState]}>
              {live ? <span className="size-1.5 rounded-full bg-primary" /> : null}
              {resolveMatchStateBadge(match.state).label}
            </Badge>
          </div>
          <div className="space-y-2 px-4">
            <TeamLine team={match.teamA} />
            <TeamLine team={match.teamB} />
          </div>
          {match.resultSummary ? (
            <p className="px-4 text-xs font-semibold text-accent-foreground">{match.resultSummary}</p>
          ) : null}
          <div className="mt-auto space-y-1 border-t px-4 pt-3 text-xs text-muted-foreground">
            <p className="flex items-center gap-1.5">
              <CalendarDays className="size-3.5 shrink-0" />
              {formatMatchWhen(match)}
            </p>
            {match.groundLocation ? (
              <p className="flex items-center gap-1.5">
                <MapPin className="size-3.5 shrink-0" />
                <span className="truncate">{match.groundLocation}</span>
              </p>
            ) : null}
          </div>
        </Card>
      </Link>
      {hasActions ? (
        <div className="absolute top-2.5 right-2">
          <RowActionsMenu label={`${match.teamA.name} vs ${match.teamB.name}`} onEdit={onEdit} onDelete={onDelete} />
        </div>
      ) : null}
    </div>
  );
}

export function MatchesTab(): React.ReactElement {
  const { tournamentId = '' } = useParams();
  const matches = useTournamentMatches(tournamentId);
  const tournament = useTournamentDetail(tournamentId).data;
  const { remove } = useMatchMutations(tournamentId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<MatchListItem | null>(null);

  const dialogs = tournament ? (
    <>
      <MatchSetupDialog
        tournament={tournament}
        open={editingId !== null}
        onOpenChange={(open) => !open && setEditingId(null)}
        format={tournament.matchSchedulingFormat ?? MatchSchedulingFormat.Manual}
        matchId={editingId}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this match?"
        description="It will be removed from match lists. The record is kept and stays visible to Admins."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!deleting) return;
          await remove.mutateAsync(deleting.id);
          toast.success(`${deleting.teamA.name} vs ${deleting.teamB.name} deleted`);
        }}
      />
    </>
  ) : null;

  if (matches.isError) {
    return <QueryErrorCard title="Couldn't load matches" error={matches.error} onRetry={() => void matches.refetch()} />;
  }
  if (matches.isPending) {
    return (
      <div className={DETAIL_GRID}>
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-48 animate-pulse rounded-lg border bg-card" />
        ))}
      </div>
    );
  }
  const rows = visibleMatches(matches.data);
  if (rows.length === 0) {
    return (
      <Card className="py-0">
        <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
          <CalendarDays className="size-8 text-primary" />
          No matches have been scheduled yet.
        </CardContent>
      </Card>
    );
  }
  return (
    <>
      <div className={DETAIL_GRID}>
        {rows.map((match) => (
          <MatchCard
            key={match.id}
            match={match}
            onEdit={canEditMatch(match) ? () => setEditingId(match.id) : undefined}
            onDelete={canDeleteMatch(match) ? () => setDeleting(match) : undefined}
          />
        ))}
      </div>
      {dialogs}
    </>
  );
}
