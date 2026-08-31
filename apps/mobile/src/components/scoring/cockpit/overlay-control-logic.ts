/**
 * Graphics-command helpers for the cockpit Overlay Control panel.
 * Mirrors apps/scoring-overlay/src/control-team.ts show/hide command shapes —
 * same graphics:command events, no new kinds.
 */
import type {
  GraphicsCommandMessage,
  InningsScorecard,
  MatchDetail,
  ScorecardResponse,
} from '@acc/types';
import { timelineEntryHasShotPlacement } from '@acc/types';

export type OverlayTeamSide = 'a' | 'b';

export type OverlayTeamAction =
  | 'playing_xi'
  | 'batting_lineup'
  | 'bowling'
  | 'partnerships'
  | 'fow'
  | 'batsman'
  | 'bowler'
  | 'batsman_career'
  | 'bowler_career';

export const OVERLAY_TEAM_ACTIONS: { action: OverlayTeamAction; label: string; needsPicker?: boolean }[] =
  [
    { action: 'playing_xi', label: 'Playing XI' },
    { action: 'batting_lineup', label: 'Batting line-up' },
    { action: 'bowling', label: 'Bowling' },
    { action: 'partnerships', label: 'Partnership' },
    { action: 'fow', label: 'Last wicket' },
    { action: 'batsman', label: 'Batsman', needsPicker: true },
    { action: 'bowler', label: 'Bowler', needsPicker: true },
    { action: 'batsman_career', label: 'Batsman career', needsPicker: true },
    { action: 'bowler_career', label: 'Bowler career', needsPicker: true },
  ];

export interface OverlayTeamBinding {
  side: OverlayTeamSide;
  teamId: string | null;
  name: string;
  isExternal: boolean;
}

function normTeamId(id: string | null | undefined): string | null {
  const t = id?.trim();
  return t ? t : null;
}

export function resolveOverlayTeam(
  match: MatchDetail,
  side: OverlayTeamSide,
): OverlayTeamBinding {
  if (side === 'a') {
    return {
      side,
      teamId: normTeamId(match.homeTeamId),
      name: match.homeTeamName?.trim() || 'Home',
      isExternal: false,
    };
  }
  const awayId = normTeamId(match.awayTeamId);
  const external = Boolean(match.externalOpponentName?.trim() && !awayId);
  return {
    side,
    teamId: awayId,
    name: match.awayTeamName?.trim() || match.externalOpponentName?.trim() || 'Away',
    isExternal: external,
  };
}

/** Which toggle side is currently batting in the active innings. */
export function battingOverlayTeamSide(
  match: MatchDetail,
  innings: InningsScorecard,
): OverlayTeamSide {
  if (innings.battingIsExternal) {
    return 'b';
  }
  const batId = normTeamId(innings.battingTeamId);
  const homeId = normTeamId(match.homeTeamId);
  if (batId && homeId && batId === homeId) {
    return 'a';
  }
  return 'b';
}

function findBattingInnings(
  card: ScorecardResponse,
  team: OverlayTeamBinding,
): InningsScorecard | null {
  for (const inn of card.innings) {
    if (team.isExternal) {
      if (inn.battingIsExternal) {
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

function teamHasPlayingXi(match: MatchDetail, team: OverlayTeamBinding): boolean {
  if (team.isExternal) {
    return match.externalPlayers.length > 0;
  }
  if (!team.teamId) {
    return false;
  }
  const squad = match.squads.find((s) => s.teamId === team.teamId);
  return Boolean(squad?.players.some((p) => p.role === 'PLAYING_XI'));
}

function inningsKey(innings: InningsScorecard): string | null {
  return innings.inningsId ?? null;
}

export function buildOverlayTeamShowCommand(
  action: OverlayTeamAction,
  team: OverlayTeamBinding,
  card: ScorecardResponse,
  match: MatchDetail,
  playerId?: string | null,
): Omit<GraphicsCommandMessage, 'matchId'> | null {
  switch (action) {
    case 'playing_xi':
      if (!teamHasPlayingXi(match, team)) {
        return null;
      }
      return {
        action: 'show',
        graphic: 'playing_xi',
        payload: { teamId: team.teamId, variant: 'single' },
      };
    case 'batting_lineup':
      if (!teamHasPlayingXi(match, team)) {
        return null;
      }
      return {
        action: 'show',
        graphic: 'playing_xi',
        payload: { teamId: team.teamId, variant: 'lineup' },
      };
    case 'bowling': {
      const innings = findBattingInnings(card, team);
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
      const innings = findBattingInnings(card, team);
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
      const innings = findBattingInnings(card, team);
      if (!innings || innings.fallOfWickets.length === 0) {
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

export function formatOverlayTossLine(match: MatchDetail): string | null {
  if (!match.tossWinner || !match.tossDecision) {
    return null;
  }
  const winnerName =
    match.tossWinner === 'TEAM_A'
      ? match.homeTeamName?.trim() || 'Home'
      : match.awayTeamName?.trim() || match.externalOpponentName?.trim() || 'Away';
  const decisionWord = match.tossDecision === 'BAT' ? 'bat' : 'bowl';
  return `${winnerName} won the toss and chose to ${decisionWord}`;
}

export function formatOverlayChaseLine(
  card: ScorecardResponse,
  innings: InningsScorecard,
): string | null {
  if (innings.sequence < 2 && innings.target == null) {
    return null;
  }
  const target =
    innings.target ?? card.effectiveTarget ?? card.dlsTarget ?? card.originalTarget;
  if (target == null || target <= 0) {
    return null;
  }
  const needs = Math.max(0, target - innings.runs);
  if (needs <= 0) {
    return `TARGET ${target}`;
  }
  const allotted = innings.oversAllotted;
  if (allotted == null) {
    return `NEED ${needs}`;
  }
  const ballsLeft = Math.max(0, allotted * 6 - innings.legalBalls);
  return `NEED ${needs} OFF ${ballsLeft}`;
}

export function formatOverlayPlayingXiPreview(match: MatchDetail): string | null {
  const a = match.homeTeamName?.trim();
  const b = match.awayTeamName?.trim() || match.externalOpponentName?.trim();
  if (!a && !b) {
    return null;
  }
  return `${a || 'Home'} vs ${b || 'Away'}`;
}

/** Momentary strip flash line — same shape as overlay Theme 1 boundaries sub-line. */
export function formatOverlayBoundariesLine(innings: InningsScorecard): string {
  let fours = 0;
  let sixes = 0;
  for (const b of innings.batters) {
    fours += b.fours ?? 0;
    sixes += b.sixes ?? 0;
  }
  return `FOURS ${fours} | SIXES ${sixes}`;
}

/** Match-level innings-break card views (same payload.view values as scoring-overlay). */
export type OverlayInningsBreakView =
  | 'batting'
  | 'bowling'
  | 'fow'
  | 'partnerships'
  | 'overs';

export const OVERLAY_INNINGS_BREAK_VIEWS: {
  view: OverlayInningsBreakView;
  label: string;
}[] = [
  { view: 'batting', label: 'Batting' },
  { view: 'bowling', label: 'Bowling' },
  { view: 'fow', label: 'Fall of Wickets' },
  { view: 'partnerships', label: 'Partnerships' },
  { view: 'overs', label: 'Overs Summary' },
];

/** Preview line for the Common innings-break card (mirrors overlay control previewInnings). */
export function formatOverlayInningsBreakPreview(
  card: ScorecardResponse,
): string | null {
  if (card.innings.length === 0) {
    return null;
  }
  const parts = card.innings.map((inn) => {
    const labels = card.display.innings.find(
      (row) =>
        (inn.inningsId != null && row.inningsId === inn.inningsId) ||
        (row.battingTeamId != null &&
          inn.battingTeamId != null &&
          row.battingTeamId === inn.battingTeamId),
    );
    const label =
      labels?.battingTeamName?.trim() ||
      (inn.battingIsExternal ? 'External' : 'Batting');
    return `${label} ${inn.runs}/${inn.wickets} (${inn.oversText})`;
  });
  const target =
    card.effectiveTarget != null && card.effectiveTarget > 0
      ? ` · Target ${card.effectiveTarget}`
      : '';
  return `${parts.join(' · ')}${target}`;
}

export function teamMatchesInningsBatting(
  team: OverlayTeamBinding,
  innings: InningsScorecard,
): boolean {
  if (team.isExternal) {
    return innings.battingIsExternal === true;
  }
  return Boolean(team.teamId && normTeamId(innings.battingTeamId) === team.teamId);
}

export function teamMatchesInningsBowling(
  team: OverlayTeamBinding,
  innings: InningsScorecard,
): boolean {
  if (innings.bowlingIsExternal && team.isExternal) {
    return true;
  }
  if (team.isExternal) {
    return false;
  }
  return Boolean(team.teamId && normTeamId(innings.bowlingTeamId) === team.teamId);
}

export type OverlayOnAirState = {
  graphic: GraphicsCommandMessage['graphic'] | null;
  teamSide: OverlayTeamSide | null;
  teamAction: OverlayTeamAction | null;
  playingXiVariant: 'both' | 'single' | 'lineup';
  inningsSource: 'break' | 'scorecard';
  stripMode: 'default' | 'toss' | 'chase';
};

export const EMPTY_OVERLAY_ON_AIR: OverlayOnAirState = {
  graphic: null,
  teamSide: null,
  teamAction: null,
  playingXiVariant: 'both',
  inningsSource: 'break',
  stripMode: 'default',
};

export function isInningsBreakOnAir(state: OverlayOnAirState): boolean {
  return state.graphic === 'innings_break' && state.inningsSource === 'break';
}

export type OverlayWagonWheelFilter = '4s' | '6s' | '4s6s' | 'all';

export type OverlayWagonWheelOption = {
  key: string;
  label: string;
  subject: 'team' | string;
  filter: OverlayWagonWheelFilter;
};

function battingSideLabel(
  card: ScorecardResponse,
  innings: InningsScorecard,
): string {
  const labels = card.display.innings.find(
    (row) =>
      (innings.inningsId != null && row.inningsId === innings.inningsId) ||
      (row.battingTeamId != null &&
        innings.battingTeamId != null &&
        row.battingTeamId === innings.battingTeamId),
  );
  return (
    labels?.battingTeamName?.trim() ||
    (innings.battingIsExternal ? 'External' : 'Team')
  );
}

/** Flat dropdown options: team boundary filters + batters with saved shot placements. */
export function buildOverlayWagonWheelOptions(
  card: ScorecardResponse,
  innings: InningsScorecard,
  nameOf: (id: string | null) => string,
): OverlayWagonWheelOption[] {
  const hasShots = innings.timeline.some((e) => timelineEntryHasShotPlacement(e));
  if (!hasShots) {
    return [];
  }
  const team = battingSideLabel(card, innings);
  const options: OverlayWagonWheelOption[] = [
    { key: 'team:4s', label: `${team} — 4s`, subject: 'team', filter: '4s' },
    { key: 'team:6s', label: `${team} — 6s`, subject: 'team', filter: '6s' },
    {
      key: 'team:4s6s',
      label: `${team} — 4s & 6s`,
      subject: 'team',
      filter: '4s6s',
    },
  ];
  const seen = new Set<string>();
  for (const entry of innings.timeline) {
    if (!timelineEntryHasShotPlacement(entry)) {
      continue;
    }
    const id = entry.strikerId?.trim();
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    options.push({
      key: `batter:${id}`,
      label: `${nameOf(id)} — all shots`,
      subject: id,
      filter: 'all',
    });
  }
  return options;
}

export function parseOverlayWagonWheelKey(
  key: string,
): Pick<OverlayWagonWheelOption, 'subject' | 'filter'> | null {
  if (key === 'team:4s') {
    return { subject: 'team', filter: '4s' };
  }
  if (key === 'team:6s') {
    return { subject: 'team', filter: '6s' };
  }
  if (key === 'team:4s6s') {
    return { subject: 'team', filter: '4s6s' };
  }
  if (key.startsWith('batter:')) {
    const id = key.slice('batter:'.length).trim();
    return id ? { subject: id, filter: 'all' } : null;
  }
  return null;
}

export function isTeamActionOnAir(
  state: OverlayOnAirState,
  side: OverlayTeamSide,
  action: OverlayTeamAction,
): boolean {
  if (state.teamSide !== side || state.teamAction !== action) {
    return false;
  }
  if (action === 'playing_xi') {
    return state.graphic === 'playing_xi' && state.playingXiVariant === 'single';
  }
  if (action === 'batting_lineup') {
    return state.graphic === 'playing_xi' && state.playingXiVariant === 'lineup';
  }
  if (action === 'bowling' || action === 'partnerships') {
    return state.graphic === 'innings_break' && state.inningsSource === 'scorecard';
  }
  if (action === 'fow') {
    return state.graphic === 'fow';
  }
  return (
    (action === 'batsman' ||
      action === 'bowler' ||
      action === 'batsman_career' ||
      action === 'bowler_career') &&
    state.graphic === action
  );
}

export function isCommonGraphicOnAir(
  state: OverlayOnAirState,
  graphic: 'toss' | 'chase' | 'playing_xi' | 'toss_result' | 'innings_break' | 'wagon_wheel',
): boolean {
  if (graphic === 'toss') {
    return state.stripMode === 'toss';
  }
  if (graphic === 'chase') {
    return state.stripMode === 'chase';
  }
  if (graphic === 'playing_xi') {
    return state.graphic === 'playing_xi' && state.playingXiVariant === 'both';
  }
  if (graphic === 'innings_break') {
    return isInningsBreakOnAir(state);
  }
  return state.graphic === graphic;
}

export function anythingOverlayOnAir(state: OverlayOnAirState): boolean {
  return state.graphic != null || state.stripMode !== 'default';
}

export function overlayOnAirLabel(
  state: OverlayOnAirState,
  match: MatchDetail,
): string {
  if (state.stripMode === 'toss') {
    return 'ON AIR: Toss (strip)';
  }
  if (state.stripMode === 'chase') {
    return 'ON AIR: Runs to win (strip)';
  }
  if (!state.graphic) {
    return 'Nothing on air';
  }
  if (state.graphic === 'playing_xi' && state.playingXiVariant === 'both') {
    return 'ON AIR: Both teams — Playing XI';
  }
  if (isInningsBreakOnAir(state)) {
    return 'ON AIR: Innings break';
  }
  if (state.graphic === 'wagon_wheel') {
    return 'ON AIR: Wagon wheel';
  }
  if (state.teamSide && state.teamAction) {
    const team = resolveOverlayTeam(match, state.teamSide);
    const row = OVERLAY_TEAM_ACTIONS.find((r) => r.action === state.teamAction);
    return `ON AIR: ${team.name} · ${row?.label ?? state.teamAction}`;
  }
  if (state.graphic === 'toss_result') {
    return 'ON AIR: Toss result';
  }
  return `ON AIR: ${state.graphic}`;
}
