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
import { type LeaderboardRowView } from './leaderboard-card';
import { mountPremiumLeaderboardCard } from './premium-leaderboard-card';
import { mountPremiumPointsTableCard } from './premium-points-table-card';
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
  most_sixes: 'g-most-sixes',
  most_fours: 'g-most-fours',
};

export function isTournamentGraphicKind(
  kind: string | undefined,
): kind is TournamentGraphicKind {
  return (
    kind === 'points_table' ||
    kind === 'tournament_top_batsmen' ||
    kind === 'tournament_top_bowlers' ||
    kind === 'tournament_fours' ||
    kind === 'tournament_sixes' ||
    kind === 'most_sixes' ||
    kind === 'most_fours'
  );
}

export function buildTournamentGraphicsMarkup(): string {
  return (Object.entries(TOURNAMENT_GRAPHIC_IDS) as [TournamentGraphicKind, string][])
    .map(([kind, id]) => {
      const isStat = kind === 'tournament_fours' || kind === 'tournament_sixes';
      const cls = isStat
        ? 'graphic tournament-stat-graphic t1-tournament-graphic'
        : 'graphic graphic-centered t1-tournament-graphic';
      return `<div id="${id}" class="${cls}" hidden></div>`;
    })
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
  const missingWarned = new Set<string>();

  const hostOrNull = (kind: TournamentGraphicKind): HTMLElement | null => {
    const id = TOURNAMENT_GRAPHIC_IDS[kind];
    const node = root.querySelector(`#${CSS.escape(id)}`);
    if (!node) {
      if (!missingWarned.has(id)) {
        missingWarned.add(id);
        console.warn(
          `[tournament-graphics] Missing #${id} in graphics stage — graphic disabled`,
        );
      }
      return null;
    }
    return node as HTMLElement;
  };

  const mountCard = <T>(
    kind: TournamentGraphicKind,
    mount: (el: HTMLElement) => T,
  ): T | null => {
    const node = hostOrNull(kind);
    if (!node) {
      return null;
    }
    return mount(node);
  };

  const pointsTable = mountCard('points_table', mountPremiumPointsTableCard);
  const topBatsmen = mountCard('tournament_top_batsmen', mountPremiumLeaderboardCard);
  const topBowlers = mountCard('tournament_top_bowlers', mountPremiumLeaderboardCard);
  const foursCard = mountCard('tournament_fours', mountTournamentStatCard);
  const sixesCard = mountCard('tournament_sixes', mountTournamentStatCard);
  const mostSixesCard = mountCard('most_sixes', mountPremiumLeaderboardCard);
  const mostFoursCard = mountCard('most_fours', mountPremiumLeaderboardCard);

  const hideCard = (kind: TournamentGraphicKind): void => {
    if (kind === 'points_table') {
      pointsTable?.hide();
    } else if (kind === 'tournament_top_batsmen') {
      topBatsmen?.hide();
    } else if (kind === 'tournament_top_bowlers') {
      topBowlers?.hide();
    } else if (kind === 'tournament_fours') {
      foursCard?.hide();
    } else if (kind === 'tournament_sixes') {
      sixesCard?.hide();
    } else if (kind === 'most_sixes') {
      mostSixesCard?.hide();
    } else if (kind === 'most_fours') {
      mostFoursCard?.hide();
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

  const boundaryRows = (
    entries: Array<{
      rank: number;
      firstName: string;
      lastName: string;
      teamName: string;
      count: number;
    }>,
  ): LeaderboardRowView[] =>
    entries.map((entry) => ({
      rank: entry.rank,
      name: `${entry.firstName} ${entry.lastName}`.trim() || '—',
      teamName: entry.teamName,
      stat: entry.count,
    }));

  const showBoundaryLeaderboard = async (
    kind: 'most_sixes' | 'most_fours',
    tournamentId: string,
    token: number,
    teamId?: string | null,
  ): Promise<boolean> => {
    const card = kind === 'most_sixes' ? mostSixesCard : mostFoursCard;
    if (!card) {
      return false;
    }
    // Leather may pass teamId (top 5); non-leather omits it (top 10).
    const filterTeamId = teamId?.trim() || null;
    const stats = await fetchTournamentStats(apiBase, tournamentId, filterTeamId);
    if (token !== showToken || activeKind !== kind) {
      return false;
    }
    if (!stats) {
      return false;
    }
    const entries =
      kind === 'most_sixes'
        ? (stats.mostSixes ?? [])
        : (stats.mostFours ?? []);
    const mapped = boundaryRows(entries);
    const filterCtx = filterTeamId
      ? mapped.find((row) => row.teamName.trim())?.teamName.trim() || null
      : null;
    const rows = filterTeamId
      ? mapped.map((row) => ({ ...row, teamName: '' }))
      : mapped;
    return card.show({
      title: kind === 'most_sixes' ? 'Most Sixes' : 'Most Fours',
      statLabel: kind === 'most_sixes' ? 'Sixes' : 'Fours',
      topN: filterTeamId ? 5 : 10,
      rows,
      context: filterCtx,
    });
  };

  const showKind = async (
    kind: TournamentGraphicKind,
    tournamentId: string,
    token: number,
    teamId?: string | null,
  ): Promise<boolean> => {
    if (kind === 'points_table') {
      if (!pointsTable) {
        return false;
      }
      const standings = await fetchTournamentStandings(apiBase, tournamentId);
      if (token !== showToken || activeKind !== kind) {
        return false;
      }
      return pointsTable.show(standings);
    }

    if (kind === 'tournament_top_batsmen' || kind === 'tournament_top_bowlers') {
      // Leather Top 5 may pass teamId; non-leather omits it.
      const filterTeamId = teamId?.trim() || null;
      const leaderboard = await fetchTournamentLeaderboard(
        apiBase,
        tournamentId,
        filterTeamId,
      );
      if (token !== showToken || activeKind !== kind) {
        return false;
      }
      if (!leaderboard?.hasRecords) {
        return false;
      }
      if (kind === 'tournament_top_batsmen') {
        if (!topBatsmen) {
          return false;
        }
        const mapped = battingRows(leaderboard.batting.entries);
        const filterCtx = filterTeamId
          ? mapped.find((row) => row.teamName.trim())?.teamName.trim() || null
          : null;
        const rows = filterTeamId
          ? mapped.map((row) => ({ ...row, teamName: '' }))
          : mapped;
        return topBatsmen.show({
          title: 'Most Runs',
          statLabel: 'Runs',
          topN: 5,
          rows,
          context: filterCtx,
        });
      }
      if (!topBowlers) {
        return false;
      }
      const mapped = bowlingRows(leaderboard.bowling.entries);
      const filterCtx = filterTeamId
        ? mapped.find((row) => row.teamName.trim())?.teamName.trim() || null
        : null;
      const rows = filterTeamId
        ? mapped.map((row) => ({ ...row, teamName: '' }))
        : mapped;
      return topBowlers.show({
        title: 'Most Wickets',
        statLabel: 'Wickets',
        topN: 5,
        rows,
        context: filterCtx,
      });
    }

    if (kind === 'most_sixes' || kind === 'most_fours') {
      return showBoundaryLeaderboard(kind, tournamentId, token, teamId);
    }

    const card = kind === 'tournament_fours' ? foursCard : sixesCard;
    if (!card) {
      return false;
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
      const teamId = cmd.payload?.teamId?.trim() || null;
      void showKind(kind, tid, token, teamId)
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
