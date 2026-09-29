import { BALL_TYPE_LABELS, TOURNAMENT_DISPLAY_STATUS_LABELS, TOURNAMENT_TYPE_LABELS } from '@acc/types';
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  ListOrdered,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Link, NavLink, Outlet, useParams } from 'react-router';

import { QueryErrorCard } from '@/components/QueryErrorCard';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import { STATUS_BADGE } from '../columns';
import { formatTournamentDates, tournamentLocationLabel } from '../tournament-list';
import { AddTeamButton } from './AddTeamButton';
import { DETAIL_TABS, type DetailTabPath } from './tournament-detail';
import { useTournamentDetail } from './tournament-detail-api';

const TAB_ICONS: Record<DetailTabPath, LucideIcon> = {
  teams: Users,
  matches: CalendarDays,
  points: ListOrdered,
  stats: BarChart3,
  registrations: ClipboardCheck,
};

/** /tournaments/:tournamentId — header + Teams / Matches / Points table / Tournament stats / Registrations tabs. */
export function TournamentDetailLayout(): React.ReactElement {
  const { tournamentId = '' } = useParams();
  const detail = useTournamentDetail(tournamentId);
  const tournament = detail.data;

  return (
    <div>
      <Link
        to="/tournaments"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        All tournaments
      </Link>

      {detail.isError ? (
        <QueryErrorCard title="Couldn't load this tournament" error={detail.error} onRetry={() => void detail.refetch()} />
      ) : (
        <>
          <div className="mb-6">
            {tournament ? (
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-2xl font-bold tracking-tight text-secondary">{tournament.name}</h1>
                    <Badge variant={STATUS_BADGE[tournament.displayStatus]}>
                      {TOURNAMENT_DISPLAY_STATUS_LABELS[tournament.displayStatus]}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {TOURNAMENT_TYPE_LABELS[tournament.type]} · {BALL_TYPE_LABELS[tournament.ballType]} ·{' '}
                    {formatTournamentDates(tournament.startAt, tournament.endAt)} · {tournament.teamCount} teams ·{' '}
                    {tournamentLocationLabel(tournament)}
                  </p>
                </div>
                <AddTeamButton tournament={tournament} />
              </div>
            ) : (
              <div className="space-y-2">
                <div className="h-8 w-72 animate-pulse rounded bg-muted" />
                <div className="h-4 w-96 animate-pulse rounded bg-muted" />
              </div>
            )}
          </div>

          <nav className="mb-6 flex gap-1 overflow-x-auto border-b" aria-label="Tournament sections">
            {DETAIL_TABS.map((tab) => {
              const Icon = TAB_ICONS[tab.path];
              return (
                <NavLink
                  key={tab.path}
                  to={tab.path}
                  className={({ isActive }) =>
                    cn(
                      '-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors',
                      isActive
                        ? 'border-primary text-secondary'
                        : 'border-transparent text-muted-foreground hover:text-foreground',
                    )
                  }
                >
                  <Icon className="size-4" />
                  {tab.label}
                </NavLink>
              );
            })}
          </nav>

          <div className="@container">
            <Outlet />
          </div>

        </>
      )}
    </div>
  );
}
