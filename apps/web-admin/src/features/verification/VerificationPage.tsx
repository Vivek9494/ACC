import {
  BALL_TYPE_LABELS,
  BallType,
  TOURNAMENT_DISPLAY_STATUS_LABELS,
  TOURNAMENT_TYPE_LABELS,
  TournamentDisplayStatus,
} from '@acc/types';
import { ArrowUpRight, BadgeCheck } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';

import { QueryErrorCard } from '@/components/QueryErrorCard';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { resolveSelectedTournament, sortTournamentsForStats } from '@/features/statistics/tournament-stats/tournament-stats';
import { STATUS_BADGE } from '@/features/tournaments/columns';
import { RegistrationsPanel } from '@/features/tournaments/detail/RegistrationsTab';
import { formatTournamentDates } from '@/features/tournaments/tournament-list';
import { useTournaments } from '@/features/tournaments/use-tournaments';

/** Tournament picker → registered players and verification (tennis only; leather has no verification step). */
export function VerificationPage(): React.ReactElement {
  const [params, setParams] = useSearchParams();
  const tournamentsQuery = useTournaments();
  const tennis = useMemo(
    () =>
      sortTournamentsForStats(
        (tournamentsQuery.data ?? []).filter(
          (t) => t.ballType === BallType.Tennis && t.displayStatus !== TournamentDisplayStatus.Cancelled,
        ),
      ),
    [tournamentsQuery.data],
  );
  const tournament = resolveSelectedTournament(tennis, params.get('tournament'));

  if (tournamentsQuery.isError) {
    return (
      <QueryErrorCard
        title="Couldn't load tournaments"
        error={tournamentsQuery.error}
        onRetry={() => void tournamentsQuery.refetch()}
      />
    );
  }

  if (!tournamentsQuery.isPending && !tournament) {
    return (
      <Card className="py-0">
        <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
          <BadgeCheck className="size-8 text-primary" />
          No tennis tournaments yet — registrations to verify appear here once one opens.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Select
        value={tournament?.id ?? undefined}
        onValueChange={(id) => setParams({ tournament: id }, { replace: true })}
        disabled={tournamentsQuery.isPending}
      >
        <SelectTrigger className="w-[360px]" aria-label="Tournament">
          <SelectValue placeholder="Loading tournaments…" />
        </SelectTrigger>
        <SelectContent>
          {tennis.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {tournament ? (
        <>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="text-lg font-bold text-secondary">{tournament.name}</h2>
            <Badge variant={STATUS_BADGE[tournament.displayStatus]}>
              {TOURNAMENT_DISPLAY_STATUS_LABELS[tournament.displayStatus]}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {TOURNAMENT_TYPE_LABELS[tournament.type]} · {BALL_TYPE_LABELS[tournament.ballType]} ·{' '}
              {formatTournamentDates(tournament.startAt, tournament.endAt)}
            </span>
            <Link
              to={`/tournaments/${encodeURIComponent(tournament.id)}/teams`}
              className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Open tournament
              <ArrowUpRight className="size-4" />
            </Link>
          </div>
          <RegistrationsPanel key={tournament.id} tournamentId={tournament.id} />
        </>
      ) : null}
    </div>
  );
}
