import {
  formatLeaderboardAverage,
  formatLeaderboardEconomy,
  formatLeaderboardStrikeRate,
  formatSignedNetRunRate,
  type BattingLeaderboardEntry,
  type BowlingLeaderboardEntry,
  type TeamStandingRow,
  type TournamentBoundaryLeaderboardEntry,
} from '@acc/types';
import type { ColumnDef } from '@tanstack/react-table';

import { TeamLogo } from '@/components/TeamLogo';
import { UserAvatar, type AvatarPerson } from '@/components/UserAvatar';
import { cn } from '@/lib/utils';

import { bestBowlingSortValue } from './tournament-stats';

const NUM = { headerClassName: 'text-right [&>button]:justify-end', cellClassName: 'text-right tabular-nums' };
const KEY_NUM = { ...NUM, cellClassName: 'text-right font-semibold tabular-nums text-secondary' };

function RankCell({ rank }: { rank: number }): React.ReactElement {
  return (
    <span
      className={cn(
        'inline-flex size-7 items-center justify-center rounded-full text-xs font-bold tabular-nums',
        rank <= 3 ? 'bg-primary/15 text-accent-foreground' : 'text-muted-foreground',
      )}
    >
      {rank}
    </span>
  );
}

function PlayerCell({ person }: { person: AvatarPerson }): React.ReactElement {
  return (
    <div className="flex min-w-[180px] items-center gap-3">
      <UserAvatar person={person} className="size-8" />
      <span className="font-medium">
        {person.firstName} {person.lastName}
      </span>
    </div>
  );
}

function TeamCell({ name, logoUrl }: { name: string; logoUrl: string | null }): React.ReactElement {
  return (
    <div className="flex min-w-[140px] items-center gap-2">
      <TeamLogo name={name} logoUrl={logoUrl} className="size-6 text-[10px]" />
      <span className="text-muted-foreground">{name}</span>
    </div>
  );
}

function rankColumn<T extends { rank: number }>(): ColumnDef<T> {
  return {
    id: 'rank',
    accessorKey: 'rank',
    header: '#',
    cell: ({ row }) => <RankCell rank={row.original.rank} />,
    meta: { headerClassName: 'w-14' },
  };
}

function playerColumn<T extends AvatarPerson>(): ColumnDef<T> {
  return {
    id: 'player',
    accessorFn: (row) => `${row.firstName} ${row.lastName}`,
    header: 'Player',
    cell: ({ row }) => <PlayerCell person={row.original} />,
  };
}

function teamColumn<T extends { teamName: string; teamLogoUrl: string | null }>(): ColumnDef<T> {
  return {
    id: 'team',
    accessorKey: 'teamName',
    header: 'Team',
    cell: ({ row }) => <TeamCell name={row.original.teamName} logoUrl={row.original.teamLogoUrl} />,
  };
}

/** Nulls (÷0 guards) sort below every real value. */
const orMin = (value: number | null): number => value ?? Number.NEGATIVE_INFINITY;

export const battingColumns: ColumnDef<BattingLeaderboardEntry>[] = [
  rankColumn(),
  playerColumn(),
  teamColumn(),
  { id: 'matches', accessorKey: 'matches', header: 'M', meta: NUM },
  { id: 'runs', accessorKey: 'runs', header: 'Runs', meta: KEY_NUM },
  { id: 'thirties', accessorKey: 'thirties', header: '30s', meta: NUM },
  { id: 'fifties', accessorKey: 'fifties', header: '50s', meta: NUM },
  {
    id: 'average',
    accessorFn: (row) => orMin(row.average),
    header: 'Avg',
    cell: ({ row }) => formatLeaderboardAverage(row.original.average),
    meta: NUM,
  },
  {
    id: 'strikeRate',
    accessorFn: (row) => orMin(row.strikeRate),
    header: 'SR',
    cell: ({ row }) => formatLeaderboardStrikeRate(row.original.strikeRate),
    meta: NUM,
  },
];

export const bowlingColumns: ColumnDef<BowlingLeaderboardEntry>[] = [
  rankColumn(),
  playerColumn(),
  teamColumn(),
  { id: 'matches', accessorKey: 'matches', header: 'M', meta: NUM },
  { id: 'innings', accessorKey: 'innings', header: 'Inns', meta: NUM },
  { id: 'wickets', accessorKey: 'wickets', header: 'Wkts', meta: KEY_NUM },
  {
    id: 'bestBowling',
    accessorFn: (row) => bestBowlingSortValue(row.bestBowling),
    header: 'Best',
    cell: ({ row }) => row.original.bestBowling ?? '–',
    meta: NUM,
  },
  {
    id: 'economy',
    // Lower is better; no-balls-bowled rows sink to the bottom of an ascending sort.
    accessorFn: (row) => row.economy ?? Number.POSITIVE_INFINITY,
    header: 'Econ',
    cell: ({ row }) => formatLeaderboardEconomy(row.original.economy),
    meta: NUM,
  },
];

export function boundaryColumns(countLabel: string): ColumnDef<TournamentBoundaryLeaderboardEntry>[] {
  return [
    rankColumn(),
    playerColumn(),
    teamColumn(),
    { id: 'count', accessorKey: 'count', header: countLabel, meta: KEY_NUM },
  ];
}

/** Server order is the table order (PTS, NRR, name), so these columns don't sort. */
export function standingsColumns(showNetRunRate: boolean): ColumnDef<TeamStandingRow>[] {
  const columns: ColumnDef<TeamStandingRow>[] = [
    {
      id: 'position',
      header: 'Pos',
      cell: ({ row }) => <RankCell rank={row.index + 1} />,
      meta: { headerClassName: 'w-14' },
    },
    {
      id: 'team',
      header: 'Team',
      cell: ({ row }) => (
        <div className="flex min-w-[180px] items-center gap-3">
          <TeamLogo name={row.original.teamName} logoUrl={row.original.logoUrl} className="size-8 text-xs" />
          <span className="font-medium">{row.original.teamName}</span>
        </div>
      ),
    },
    { id: 'matches', accessorKey: 'matches', header: 'M', meta: NUM },
    { id: 'wins', accessorKey: 'wins', header: 'W', meta: NUM },
    { id: 'losses', accessorKey: 'losses', header: 'L', meta: NUM },
    { id: 'noResults', accessorKey: 'noResults', header: 'NR', meta: NUM },
    { id: 'points', accessorKey: 'points', header: 'Pts', meta: KEY_NUM },
  ];
  if (showNetRunRate) {
    columns.push({
      id: 'netRunRate',
      header: 'NRR',
      cell: ({ row }) => formatSignedNetRunRate(row.original.netRunRate),
      meta: NUM,
    });
  }
  return columns.map((column) => ({ ...column, enableSorting: false }));
}
