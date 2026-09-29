import { RefreshCw } from 'lucide-react';
import { useParams } from 'react-router';

import { QueryErrorCard } from '@/components/QueryErrorCard';
import { UserAvatar } from '@/components/UserAvatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  useTournamentLeaderboard,
  useTournamentStatsView,
} from '@/features/statistics/tournament-stats/tournament-stats-api';
import { cn } from '@/lib/utils';

import { buildLeaderCards, DETAIL_GRID, type LeaderCard } from './tournament-detail';

function LeaderCardView({ card, isLoading }: { card: LeaderCard; isLoading: boolean }): React.ReactElement {
  return (
    <Card className="gap-0 py-0">
      <div className="flex items-end justify-between gap-2 border-b px-4 py-3">
        <div>
          <p className="font-bold text-secondary">{card.title}</p>
          <p className="text-xs text-muted-foreground">{card.note ?? 'Top 10'}</p>
        </div>
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{card.metric}</span>
      </div>
      {isLoading ? (
        <ul className="space-y-1 px-4 py-3">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="flex items-center gap-3 py-1">
              <span className="size-8 animate-pulse rounded-full bg-muted" />
              <span className="h-3.5 flex-1 animate-pulse rounded bg-muted" />
            </li>
          ))}
        </ul>
      ) : card.rows.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">{card.emptyText}</p>
      ) : (
        <ol className="px-2 py-2">
          {card.rows.map((row, index) => (
            <li key={row.userId} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50">
              <span
                className={cn(
                  'w-5 shrink-0 text-center text-xs font-bold tabular-nums',
                  index < 3 ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                {index + 1}
              </span>
              <UserAvatar person={row} className="size-8" />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm leading-tight font-semibold">
                  {row.firstName} {row.lastName}
                </p>
                <p className="truncate text-xs text-muted-foreground">{row.teamName}</p>
              </div>
              <span className="text-sm font-bold text-secondary tabular-nums">{row.value}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

export function StatsTab(): React.ReactElement {
  const { tournamentId = '' } = useParams();
  const leaderboard = useTournamentLeaderboard(tournamentId, null);
  const stats = useTournamentStatsView(tournamentId, null);
  const cards = buildLeaderCards(leaderboard.data, stats.data);
  const fetching = leaderboard.isFetching || stats.isFetching;
  const error = leaderboard.error ?? stats.error;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Completed matches only — live matches count once they finish.</p>
        <Button
          variant="outline"
          onClick={() => {
            void leaderboard.refetch();
            void stats.refetch();
          }}
          disabled={fetching}
        >
          <RefreshCw className={fetching ? 'animate-spin' : undefined} />
          Refresh
        </Button>
      </div>
      {error ? (
        <QueryErrorCard
          title="Couldn't load tournament stats"
          error={error}
          onRetry={() => {
            void leaderboard.refetch();
            void stats.refetch();
          }}
        />
      ) : (
        <div className={`${DETAIL_GRID} items-start`}>
          {cards.map((card) => (
            <LeaderCardView
              key={card.id}
              card={card}
              isLoading={card.id === 'sixes' || card.id === 'fours' ? stats.isPending : leaderboard.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}
