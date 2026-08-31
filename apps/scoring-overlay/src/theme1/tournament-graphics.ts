/**
 * Theme 1 tournament-scoped full-screen graphics (points table, leaderboards, boundary totals).
 * Data from GET /tournaments/:id/standings | /leaderboard | /stats — never from match scorecard.
 */

import {
  fetchTournamentLeaderboard,
  fetchTournamentStandings,
  fetchTournamentStats,
} from '../broadcast-fetch';
import type { GraphicsCommandMessage, TournamentGraphicKind } from '../types';
import {
  mountLeaderboardCard,
  type LeaderboardRowView,
} from './leaderboard-card';
import { mountPointsTableCard } from './points-table-card';
import {
  mountTournamentStatCard,
  type TournamentStatKind,
} from './tournament-stat-card';

const TOURNAMENT_GRAPHIC_IDS: Record<TournamentGraphicKind, string> = {
  points_table: 'g-points-table',
  tournament_top_batsmen: 'g-top-batsmen',
  tournament_top_bowlers: 'g-top-bowlers',
  tournament_fours: 'g-tournament-fours',
  tournament_sixes: 'g-tournament-sixes',
};

export function isTournamentGraphicKind(
  kind: string | undefined,
): kind is TournamentGraphicKind {
  return (
    kind === 'points_table' ||
    kind === 'tournament_top_batsmen' ||
    kind === 'tournament_top_bowlers' ||
    kind === 'tournament_fours' ||
    kind === 'tournament_sixes'
  );
}

export function buildTournamentGraphicsMarkup(): string {
  return Object.values(TOURNAMENT_GRAPHIC_IDS)
    .map(
      (id) =>
        `<div id="${id}" class="graphic graphic-centered t1-tournament-graphic" hidden></div>`,
    )
    .join('\n');
}

export interface TournamentGraphicsController {
  isOnAir(): boolean;
  activeKind(): TournamentGraphicKind | null;
  hideAll(): void;
  applyCommand(cmd: GraphicsCommandMessage, tournamentId: string | null): void;
}

export function mountTournamentGraphics(
  root: HTMLElement,
  apiBase: string,
): TournamentGraphicsController {
  let activeKind: TournamentGraphicKind | null = null;
  let showToken = 0;

  const host = (kind: TournamentGraphicKind): HTMLElement => {
    const id = TOURNAMENT_GRAPHIC_IDS[kind];
    const node = root.querySelector(`#${CSS.escape(id)}`);
    if (!node) {
      throw new Error(`Missing #${id} in graphics stage`);
    }
    return node as HTMLElement;
  };

  const pointsTable = mountPointsTableCard(host('points_table'));
  const topBatsmen = mountLeaderboardCard(host('tournament_top_batsmen'));
  const topBowlers = mountLeaderboardCard(host('tournament_top_bowlers'));
  const foursCard = mountTournamentStatCard(host('tournament_fours'));
  const sixesCard = mountTournamentStatCard(host('tournament_sixes'));

  const hideCard = (kind: TournamentGraphicKind): void => {
    if (kind === 'points_table') {
      pointsTable.hide();
    } else if (kind === 'tournament_top_batsmen') {
      topBatsmen.hide();
    } else if (kind === 'tournament_top_bowlers') {
      topBowlers.hide();
    } else if (kind === 'tournament_fours') {
      foursCard.hide();
    } else if (kind === 'tournament_sixes') {
      sixesCard.hide();
    }
  };

  const hideAll = (): void => {
    activeKind = null;
    showToken += 1;
    for (const kind of Object.keys(TOURNAMENT_GRAPHIC_IDS) as TournamentGraphicKind[]) {
      hideCard(kind);
    }
  };

  const battingRows = (
    entries: Array<{
      rank: number;
      firstName: string;
      lastName: string;
      teamName: string;
      runs: number;
    }>,
  ): LeaderboardRowView[] =>
    entries.map((entry) => ({
      rank: entry.rank,
      name: `${entry.firstName} ${entry.lastName}`.trim() || '—',
      teamName: entry.teamName,
      stat: entry.runs,
    }));

  const bowlingRows = (
    entries: Array<{
      rank: number;
      firstName: string;
      lastName: string;
      teamName: string;
      wickets: number;
    }>,
  ): LeaderboardRowView[] =>
    entries.map((entry) => ({
      rank: entry.rank,
      name: `${entry.firstName} ${entry.lastName}`.trim() || '—',
      teamName: entry.teamName,
      stat: entry.wickets,
    }));

  const showKind = async (
    kind: TournamentGraphicKind,
    tournamentId: string,
    token: number,
  ): Promise<boolean> => {
    if (kind === 'points_table') {
      const standings = await fetchTournamentStandings(apiBase, tournamentId);
      if (token !== showToken || activeKind !== kind) {
        return false;
      }
      return pointsTable.show(standings);
    }

    if (kind === 'tournament_top_batsmen' || kind === 'tournament_top_bowlers') {
      const leaderboard = await fetchTournamentLeaderboard(apiBase, tournamentId);
      if (token !== showToken || activeKind !== kind) {
        return false;
      }
      if (!leaderboard?.hasRecords) {
        return false;
      }
      if (kind === 'tournament_top_batsmen') {
        return topBatsmen.show('batting', battingRows(leaderboard.batting.entries));
      }
      return topBowlers.show('bowling', bowlingRows(leaderboard.bowling.entries));
    }

    const stats = await fetchTournamentStats(apiBase, tournamentId);
    if (token !== showToken || activeKind !== kind) {
      return false;
    }
    if (!stats?.hasRecords) {
      return false;
    }
    const statKind: TournamentStatKind =
      kind === 'tournament_fours' ? 'fours' : 'sixes';
    const total = statKind === 'fours' ? stats.aggregates.fours : stats.aggregates.sixes;
    const card = statKind === 'fours' ? foursCard : sixesCard;
    return card.show(statKind, total);
  };

  return {
    isOnAir: () => activeKind != null,
    activeKind: () => activeKind,
    hideAll,
    applyCommand(cmd, tournamentId) {
      if (cmd.action === 'hide_all') {
        hideAll();
        return;
      }
      if (!cmd.graphic || !isTournamentGraphicKind(cmd.graphic)) {
        return;
      }
      const kind = cmd.graphic;
      if (cmd.action === 'hide') {
        if (activeKind === kind) {
          activeKind = null;
        }
        hideCard(kind);
        return;
      }
      if (cmd.action !== 'show') {
        return;
      }

      const tid = tournamentId?.trim() ?? '';
      if (!tid) {
        return;
      }

      for (const k of Object.keys(TOURNAMENT_GRAPHIC_IDS) as TournamentGraphicKind[]) {
        if (k !== kind) {
          hideCard(k);
        }
      }

      activeKind = kind;
      const token = ++showToken;
      void showKind(kind, tid, token)
        .then((ok) => {
          if (token !== showToken || activeKind !== kind) {
            return;
          }
          if (!ok) {
            activeKind = null;
            hideCard(kind);
          }
        })
        .catch((err: unknown) => {
          console.warn('[tournament-graphics] show failed', err);
          if (activeKind === kind) {
            activeKind = null;
          }
          hideCard(kind);
        });
    },
  };
}
