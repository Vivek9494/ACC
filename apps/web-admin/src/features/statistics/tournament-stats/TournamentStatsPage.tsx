import {
  BALL_TYPE_LABELS,
  TOURNAMENT_DISPLAY_STATUS_LABELS,
  TOURNAMENT_TYPE_LABELS,
  TournamentDisplayStatus,
  type TournamentAggregateStats,
} from '@acc/types';
import { RefreshCw, Trophy } from 'lucide-react';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { DataTable } from '@/components/data-table/DataTable';
import { QueryErrorCard } from '@/components/QueryErrorCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatTournamentDates } from '@/features/tournaments/tournament-list';
import { useTournaments } from '@/features/tournaments/use-tournaments';

import { StandingsTables } from './StandingsTables';
import { battingColumns, boundaryColumns, bowlingColumns } from './stat-columns';
import {
  parseStatView,
  resolveSelectedTournament,
  sortTournamentsForStats,
  type StatView,
} from './tournament-stats';
import { useTournamentLeaderboard, useTournamentStandings, useTournamentStatsView } from './tournament-stats-api';

const ALL_TEAMS = 'all';

const VIEW_OPTIONS: readonly { value: StatView; label: string }[] = [
  { value: 'batting', label: 'Batting' },
  { value: 'bowling', label: 'Bowling' },
  { value: 'points', label: 'Points table' },
  { value: 'boundaries', label: 'Sixes & fours' },
];

const AGGREGATE_TILES: readonly { key: keyof TournamentAggregateStats; label: string }[] = [
  { key: 'totalRuns', label: 'Runs' },
  { key: 'totalWickets', label: 'Wickets' },
  { key: 'sixes', label: 'Sixes' },
  { key: 'fours', label: 'Fours' },
  { key: 'fifties', label: 'Fifties' },
  { key: 'hundreds', label: 'Hundreds' },
  { key: 'fifers', label: '5-wicket hauls' },
];

const BATTING_BOWLING_SORT = [{ id: 'rank', desc: false }];
const SIXES_COLUMNS = boundaryColumns('Sixes');
const FOURS_COLUMNS = boundaryColumns('Fours');

/** Tournament picker → cached leaderboards, points table and aggregates (Admin + Club Manager). */
export function TournamentStatsPage(): React.ReactElement {
  const [params, setParams] = useSearchParams();
  const tournamentsQuery = useTournaments();
  const sorted = useMemo(() => sortTournamentsForStats(tournamentsQuery.data ?? []), [tournamentsQuery.data]);
  const tournament = resolveSelectedTournament(sorted, params.get('tournament'));
  const tournamentId = tournament?.id ?? null;
  const view = parseStatView(params.get('view'));

  // The team param is cleared whenever the tournament changes, so it always belongs to this tournament.
  const teamId = params.get('team');
  const leaderboard = useTournamentLeaderboard(tournamentId, teamId);
  const stats = useTournamentStatsView(tournamentId, teamId);
  const teams = leaderboard.data?.teams ?? [];
  const standings = useTournamentStandings(tournamentId);

  const setParam = (updates: Record<string, string | null>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(updates)) {
          if (value === null) next.delete(key);
          else next.set(key, value);
        }
        return next;
      },
      { replace: true },
    );

  const refreshAll = () => {
    void leaderboard.refetch();
    void stats.refetch();
    void standings.refetch();
  };
  const fetching = leaderboard.isFetching || stats.isFetching || standings.isFetching;

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
          <Trophy className="size-8 text-primary" />
          No tournaments yet — stats appear here once a tournament has completed matches.
        </CardContent>
      </Card>
    );
  }

  const playerTableEmpty = 'No completed-match stats for this tournament yet.';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <Select
          value={tournamentId ?? undefined}
          onValueChange={(id) => setParam({ tournament: id, team: null })}
          disabled={tournamentsQuery.isPending}
        >
          <SelectTrigger className="w-[360px]" aria-label="Tournament">
            <SelectValue placeholder="Loading tournaments…" />
          </SelectTrigger>
          <SelectContent>
            {sorted.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
                {t.displayStatus === TournamentDisplayStatus.Live ? ' · Live' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {view !== 'points' ? (
          <Select value={teamId ?? ALL_TEAMS} onValueChange={(v) => setParam({ team: v === ALL_TEAMS ? null : v })}>
            <SelectTrigger className="w-[220px]" aria-label="Team">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_TEAMS}>All teams</SelectItem>
              {teams.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <Button variant="outline" className="ml-auto" onClick={refreshAll} disabled={fetching || !tournamentId}>
          <RefreshCw className={fetching ? 'animate-spin' : undefined} />
          Refresh
        </Button>
      </div>

      {tournament ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 className="text-lg font-bold text-secondary">{tournament.name}</h2>
          <Badge variant={tournament.displayStatus === TournamentDisplayStatus.Live ? 'live' : 'muted'}>
            {TOURNAMENT_DISPLAY_STATUS_LABELS[tournament.displayStatus]}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {TOURNAMENT_TYPE_LABELS[tournament.type]} · {BALL_TYPE_LABELS[tournament.ballType]} ·{' '}
            {formatTournamentDates(tournament.startAt, tournament.endAt)} · {tournament.teamCount} teams
          </span>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {AGGREGATE_TILES.map((tile) => (
          <div key={tile.key} className="rounded-lg border bg-card px-4 py-3 shadow-xs">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{tile.label}</p>
            <p className="text-2xl font-bold text-foreground tabular-nums">
              {stats.data ? stats.data.aggregates[tile.key].toLocaleString() : '—'}
            </p>
          </div>
        ))}
      </div>
      <p className="-mt-3 text-xs text-muted-foreground">
        Completed matches only — live matches count once they finish.
        {teamId ? ' Filtered to the selected team.' : ''}
      </p>

      <SegmentedControl
        ariaLabel="Statistics view"
        value={view}
        options={VIEW_OPTIONS}
        onChange={(v) => setParam({ view: v === 'batting' ? null : v })}
      />

      {view === 'batting' || view === 'bowling' ? (
        leaderboard.isError ? (
          <QueryErrorCard title="Couldn't load the leaderboard" error={leaderboard.error} onRetry={() => void leaderboard.refetch()} />
        ) : view === 'batting' ? (
          <DataTable
            key={`batting-${tournamentId}`}
            columns={battingColumns}
            data={leaderboard.data?.batting.entries ?? []}
            isLoading={leaderboard.isPending}
            getRowId={(row) => row.userId}
            initialSorting={BATTING_BOWLING_SORT}
            resetPageKey={`${tournamentId}-${teamId}`}
            emptyState={playerTableEmpty}
          />
        ) : (
          <DataTable
            key={`bowling-${tournamentId}`}
            columns={bowlingColumns}
            data={leaderboard.data?.bowling.entries ?? []}
            isLoading={leaderboard.isPending}
            getRowId={(row) => row.userId}
            initialSorting={BATTING_BOWLING_SORT}
            resetPageKey={`${tournamentId}-${teamId}`}
            emptyState={playerTableEmpty}
          />
        )
      ) : null}

      {view === 'points' ? <StandingsTables standings={standings} /> : null}

      {view === 'boundaries' ? (
        stats.isError ? (
          <QueryErrorCard title="Couldn't load tournament stats" error={stats.error} onRetry={() => void stats.refetch()} />
        ) : (
          <div className="grid items-start gap-6 xl:grid-cols-2">
            <section className="space-y-2">
              <h3 className="text-sm font-bold tracking-wide text-secondary uppercase">Most sixes</h3>
              <DataTable
                key={`sixes-${tournamentId}`}
                columns={SIXES_COLUMNS}
                data={stats.data?.mostSixes ?? []}
                isLoading={stats.isPending}
                getRowId={(row) => row.userId}
                initialSorting={BATTING_BOWLING_SORT}
                resetPageKey={`${tournamentId}-${teamId}`}
                emptyState="No sixes hit yet."
              />
            </section>
            <section className="space-y-2">
              <h3 className="text-sm font-bold tracking-wide text-secondary uppercase">Most fours</h3>
              <DataTable
                key={`fours-${tournamentId}`}
                columns={FOURS_COLUMNS}
                data={stats.data?.mostFours ?? []}
                isLoading={stats.isPending}
                getRowId={(row) => row.userId}
                initialSorting={BATTING_BOWLING_SORT}
                resetPageKey={`${tournamentId}-${teamId}`}
                emptyState="No fours hit yet."
              />
            </section>
          </div>
        )
      ) : null}
    </div>
  );
}
