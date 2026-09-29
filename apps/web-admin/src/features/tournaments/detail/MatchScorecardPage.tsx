import {
  InningsType,
  extrasBreakdownParts,
  formatBatterStatus,
  formatBatterStrikeRateDisplay,
  formatBowlerEconomyDisplay,
  formatInningsTotalScore,
  originalFirstInningsRunsForChaseTotal,
  type DismissalNameResolver,
  type InningsScorecard,
  type MatchListItem,
  type ScorecardResponse,
} from '@acc/types';
import { ArrowLeft, ClipboardList, RefreshCw } from 'lucide-react';
import { Link, useParams } from 'react-router';

import { QueryErrorCard } from '@/components/QueryErrorCard';
import { TeamLogo } from '@/components/TeamLogo';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import {
  formatFallOfWicketsLine,
  formatMatchWhen,
  inningsTeams,
  orderedInnings,
  scorecardNameResolver,
} from './tournament-detail';
import { useMatchScorecard, useTournamentMatches } from './tournament-detail-api';

const NUM_HEAD = 'w-14 text-right';
const NUM_CELL = 'text-right tabular-nums';

function InningsCard({
  card,
  innings,
  match,
  nameOf,
}: {
  card: ScorecardResponse;
  innings: InningsScorecard;
  match: MatchListItem | null;
  nameOf: DismissalNameResolver;
}): React.ReactElement {
  const teams = inningsTeams(card, innings, match);
  const extrasParts = extrasBreakdownParts(innings.extras);
  const total = formatInningsTotalScore(
    innings.runs,
    innings.wickets,
    originalFirstInningsRunsForChaseTotal(card, innings),
  );
  const fallOfWickets = formatFallOfWicketsLine(innings, nameOf);
  const label = innings.inningsType === InningsType.SuperOver ? 'Super over' : `Innings ${innings.sequence}`;

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-secondary px-5 py-3 text-secondary-foreground">
        <div className="flex min-w-0 items-center gap-3">
          <TeamLogo name={teams.batting} logoUrl={teams.battingLogoUrl} className="size-9 bg-white text-sm" />
          <div className="min-w-0">
            <p className="truncate font-bold">{teams.batting}</p>
            <p className="text-xs opacity-80">
              {label}
              {innings.target != null ? ` · Target ${innings.target}` : ''}
            </p>
          </div>
        </div>
        <p className="text-right">
          <span className="text-2xl font-bold tabular-nums">{total}</span>
          <span className="ml-2 text-sm opacity-80">({innings.oversText} ov)</span>
        </p>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Batter</TableHead>
            <TableHead className="hidden md:table-cell" />
            <TableHead className={NUM_HEAD}>R</TableHead>
            <TableHead className={NUM_HEAD}>B</TableHead>
            <TableHead className={NUM_HEAD}>4s</TableHead>
            <TableHead className={NUM_HEAD}>6s</TableHead>
            <TableHead className="w-20 text-right">SR</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {innings.batters.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                No batters recorded.
              </TableCell>
            </TableRow>
          ) : (
            innings.batters.map((batter) => {
              const status = formatBatterStatus(batter, nameOf);
              return (
                <TableRow key={batter.playerId}>
                  <TableCell>
                    <p className="font-semibold">{nameOf(batter.playerId)}</p>
                    <p className="text-xs text-muted-foreground md:hidden">{status}</p>
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{status}</TableCell>
                  <TableCell className={`${NUM_CELL} font-bold text-secondary`}>{batter.runs}</TableCell>
                  <TableCell className={NUM_CELL}>{batter.balls}</TableCell>
                  <TableCell className={NUM_CELL}>{batter.fours}</TableCell>
                  <TableCell className={NUM_CELL}>{batter.sixes}</TableCell>
                  <TableCell className={NUM_CELL}>{formatBatterStrikeRateDisplay(batter)}</TableCell>
                </TableRow>
              );
            })
          )}
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableCell colSpan={2} className="text-sm text-muted-foreground">
              Extras{extrasParts.length > 0 ? ` (${extrasParts.join(', ')})` : ''}
            </TableCell>
            <TableCell className={`${NUM_CELL} font-semibold`}>{innings.extras.total}</TableCell>
            <TableCell colSpan={4} />
          </TableRow>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableCell colSpan={2} className="font-bold">
              Total
            </TableCell>
            <TableCell colSpan={5} className="text-right font-bold tabular-nums">
              {total} <span className="font-normal text-muted-foreground">({innings.oversText} ov)</span>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      {fallOfWickets ? (
        <p className="border-t px-5 py-3 text-xs leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">Fall of wickets: </span>
          {fallOfWickets}
        </p>
      ) : null}

      <div className="border-t">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Bowler · {teams.bowling}</TableHead>
              <TableHead className={NUM_HEAD}>O</TableHead>
              <TableHead className={NUM_HEAD}>M</TableHead>
              <TableHead className={NUM_HEAD}>R</TableHead>
              <TableHead className={NUM_HEAD}>W</TableHead>
              <TableHead className="w-20 text-right">Econ</TableHead>
              <TableHead className={NUM_HEAD}>Wd</TableHead>
              <TableHead className={NUM_HEAD}>Nb</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {innings.bowlers.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={8} className="py-6 text-center text-muted-foreground">
                  No bowlers recorded.
                </TableCell>
              </TableRow>
            ) : (
              innings.bowlers.map((bowler) => (
                <TableRow key={bowler.playerId}>
                  <TableCell className="font-semibold">{nameOf(bowler.playerId)}</TableCell>
                  <TableCell className={NUM_CELL}>{bowler.oversText}</TableCell>
                  <TableCell className={NUM_CELL}>{bowler.maidens}</TableCell>
                  <TableCell className={NUM_CELL}>{bowler.runsConceded}</TableCell>
                  <TableCell className={`${NUM_CELL} font-bold text-secondary`}>{bowler.wickets}</TableCell>
                  <TableCell className={NUM_CELL}>{formatBowlerEconomyDisplay(bowler)}</TableCell>
                  <TableCell className={NUM_CELL}>{bowler.wides}</TableCell>
                  <TableCell className={NUM_CELL}>{bowler.noBalls}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

/** /tournaments/:tournamentId/matches/:matchId — full scorecard (batting, bowling, extras, totals). */
export function MatchScorecardPage(): React.ReactElement {
  const { tournamentId = '', matchId = '' } = useParams();
  const scorecard = useMatchScorecard(matchId);
  const matches = useTournamentMatches(tournamentId);
  const match = matches.data?.find((row) => row.id === matchId) ?? null;
  const card = scorecard.data;
  const nameOf = card ? scorecardNameResolver(card) : () => '';
  const innings = card ? orderedInnings(card) : [];
  const result = match?.resultSummary ?? card?.result.note ?? null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to=".."
            relative="path"
            className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            All matches
          </Link>
          {match ? (
            <>
              <h2 className="text-lg font-bold text-secondary">
                {match.teamA.name} <span className="font-medium text-muted-foreground">vs</span> {match.teamB.name}
              </h2>
              <p className="text-sm text-muted-foreground">
                {[match.matchCode, formatMatchWhen(match), match.groundLocation].filter(Boolean).join(' · ')}
              </p>
            </>
          ) : (
            <h2 className="text-lg font-bold text-secondary">Scorecard</h2>
          )}
        </div>
        <Button variant="outline" onClick={() => void scorecard.refetch()} disabled={scorecard.isFetching}>
          <RefreshCw className={scorecard.isFetching ? 'animate-spin' : undefined} />
          Refresh
        </Button>
      </div>

      {result ? (
        <div className="rounded-md border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-accent-foreground">
          {result}
        </div>
      ) : null}

      {scorecard.isError ? (
        <QueryErrorCard
          title="Couldn't load the scorecard"
          error={scorecard.error}
          onRetry={() => void scorecard.refetch()}
        />
      ) : scorecard.isPending ? (
        <div className="space-y-4">
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="h-80 animate-pulse rounded-lg border bg-card" />
          ))}
        </div>
      ) : innings.length === 0 ? (
        <Card className="py-0">
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <ClipboardList className="size-8 text-primary" />
            Scoring hasn't started for this match yet.
          </CardContent>
        </Card>
      ) : (
        innings.map((row) =>
          card ? (
            <InningsCard key={row.inningsId ?? row.sequence} card={card} innings={row} match={match} nameOf={nameOf} />
          ) : null,
        )
      )}
    </div>
  );
}
