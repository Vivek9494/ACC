import {
  battingTeamLabel,
  inningsKey,
  latestFallOfWicket,
  normTeamId,
  playerName,
  shortName,
} from './graphics-format';
import { formatPlayingXiPreview } from './playing-xi-card';
import type {
  GraphicsCommandMessage,
  InningsBreakView,
  InningsScorecard,
  MatchContext,
  ScorecardResponse,
} from './types';

export type TeamSide = 'a' | 'b';

export type PlayingXiVariant = 'both' | 'single' | 'lineup';

export type TeamControlAction =
  | 'playing_xi'
  | 'batting_lineup'
  | 'bowling'
  | 'partnerships'
  | 'fow'
  | 'batsman'
  | 'bowler'
  | 'batsman_career'
  | 'bowler_career';

export interface TeamSectionBinding {
  side: TeamSide;
  teamId: string | null;
  name: string;
  isExternal: boolean;
}

export function resolveTeamSection(
  ctx: MatchContext | null,
  side: TeamSide,
): TeamSectionBinding {
  if (side === 'a') {
    return {
      side,
      teamId: normTeamId(ctx?.homeTeamId ?? null),
      name: ctx?.homeTeamName?.trim() || 'Team A',
      isExternal: false,
    };
  }
  const awayId = normTeamId(ctx?.awayTeamId ?? null);
  const external = Boolean(ctx?.externalOpponentName?.trim() && !awayId);
  return {
    side,
    teamId: awayId,
    name:
      ctx?.awayTeamName?.trim() ||
      ctx?.externalOpponentName?.trim() ||
      'Team B',
    isExternal: external,
  };
}

export function findBattingInningsForTeam(
  card: ScorecardResponse | null,
  team: TeamSectionBinding,
): InningsScorecard | null {
  if (!card) {
    return null;
  }
  for (const inn of card.innings) {
    if (team.isExternal) {
      if (inn.battingIsExternal === true) {
        return inn;
      }
      continue;
    }
    if (team.teamId && normTeamId(inn.battingTeamId) === team.teamId) {
      return inn;
    }
  }
  return null;
}

export function findBowlingInningsForTeam(
  card: ScorecardResponse | null,
  team: TeamSectionBinding,
): InningsScorecard | null {
  if (!card || team.isExternal) {
    return null;
  }
  for (const inn of card.innings) {
    if (team.teamId && normTeamId(inn.bowlingTeamId) === team.teamId) {
      return inn;
    }
  }
  return null;
}

export function teamHasPlayingXi(
  ctx: MatchContext | null,
  team: TeamSectionBinding,
): boolean {
  if (!ctx) {
    return false;
  }
  if (team.isExternal) {
    return ctx.externalPlayers.length > 0;
  }
  if (!team.teamId) {
    return false;
  }
  const squad = ctx.squads.find((s) => s.teamId === team.teamId);
  return Boolean(
    squad?.players.some((p) => p.role === 'PLAYING_XI'),
  );
}

export function nameOfPlayer(
  card: ScorecardResponse | null,
  id: string | null | undefined,
): string {
  if (!id || !card) {
    return '—';
  }
  return shortName(playerName(card.display, id));
}

export function previewTeamLastWicket(
  card: ScorecardResponse | null,
  team: TeamSectionBinding,
): string | null {
  const innings = findBattingInningsForTeam(card, team);
  const fow = latestFallOfWicket(innings);
  if (!fow || !innings) {
    return null;
  }
  const batter = innings.batters.find((row) => row.playerId === fow.playerId);
  return `${nameOfPlayer(card, fow.playerId)} · ${batter ? `${batter.runs} (${batter.balls})` : '0 (0)'}`;
}

export function teamMatchesInningsBatting(
  team: TeamSectionBinding,
  innings: InningsScorecard | null | undefined,
): boolean {
  if (!innings) {
    return false;
  }
  if (team.isExternal) {
    return innings.battingIsExternal === true;
  }
  return Boolean(team.teamId && normTeamId(innings.battingTeamId) === team.teamId);
}

export function teamMatchesInningsBowling(
  team: TeamSectionBinding,
  innings: InningsScorecard | null | undefined,
): boolean {
  if (!innings || team.isExternal) {
    return false;
  }
  return Boolean(team.teamId && normTeamId(innings.bowlingTeamId) === team.teamId);
}

export function teamActionToInningsView(
  action: TeamControlAction,
): InningsBreakView | null {
  if (action === 'bowling') {
    return 'bowling';
  }
  if (action === 'partnerships') {
    return 'partnerships';
  }
  return null;
}

export function buildTeamShowCommand(
  action: TeamControlAction,
  team: TeamSectionBinding,
  card: ScorecardResponse | null,
  ctx: MatchContext | null,
  playerId?: string | null,
): Omit<GraphicsCommandMessage, 'matchId'> | null {
  switch (action) {
    case 'playing_xi':
      if (!teamHasPlayingXi(ctx, team)) {
        return null;
      }
      return {
        action: 'show',
        graphic: 'playing_xi',
        payload: {
          teamId: team.teamId,
          variant: 'single',
        },
      };
    case 'batting_lineup':
      if (!teamHasPlayingXi(ctx, team)) {
        return null;
      }
      return {
        action: 'show',
        graphic: 'playing_xi',
        payload: {
          teamId: team.teamId,
          variant: 'lineup',
        },
      };
    case 'bowling': {
      const innings = findBattingInningsForTeam(card, team);
      if (!innings) {
        return null;
      }
      return {
        action: 'show',
        graphic: 'innings_break',
        payload: {
          view: 'bowling',
          inningsId: inningsKey(innings),
          source: 'scorecard',
        },
      };
    }
    case 'partnerships': {
      const innings = findBattingInningsForTeam(card, team);
      if (!innings) {
        return null;
      }
      return {
        action: 'show',
        graphic: 'innings_break',
        payload: {
          view: 'partnerships',
          inningsId: inningsKey(innings),
          source: 'scorecard',
        },
      };
    }
    case 'fow': {
      const innings = findBattingInningsForTeam(card, team);
      if (!innings || !latestFallOfWicket(innings)) {
        return null;
      }
      return {
        action: 'show',
        graphic: 'fow',
        payload: { inningsId: inningsKey(innings) },
      };
    }
    case 'batsman':
      return playerId
        ? { action: 'show', graphic: 'batsman', payload: { playerId } }
        : null;
    case 'bowler':
      return playerId
        ? { action: 'show', graphic: 'bowler', payload: { playerId } }
        : null;
    case 'batsman_career':
      return playerId
        ? { action: 'show', graphic: 'batsman_career', payload: { playerId } }
        : null;
    case 'bowler_career':
      return playerId
        ? { action: 'show', graphic: 'bowler_career', payload: { playerId } }
        : null;
    default:
      return null;
  }
}

export function inningsBreakPreview(
  card: ScorecardResponse | null,
  team: TeamSectionBinding,
): string | null {
  const innings = findBattingInningsForTeam(card, team);
  if (!innings || !card) {
    return null;
  }
  return `${battingTeamLabel(card, innings)} ${innings.runs}/${innings.wickets}`;
}

export function bothTeamsPreview(ctx: MatchContext | null): string | null {
  return formatPlayingXiPreview(ctx);
}
