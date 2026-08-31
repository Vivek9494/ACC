import './control.css';
import {
  fetchBroadcastPlayerStats,
  fetchMatchBallType,
  fetchMatchContext,
  fetchScorecard,
  fetchTeamRoster,
  type TeamRosterPlayer,
} from './broadcast-fetch';
import {
  battingTeamLabel,
  formatHighestScoreMeta,
  formatStat,
  hasBatsmanCareerStats,
  hasBowlerCareerStats,
  playerName,
  resolveActiveInnings,
  shortName,
} from './graphics-format';
import {
  buildTeamShowCommand,
  findBattingInningsForTeam,
  previewTeamLastWicket,
  resolveTeamSection,
  teamActionToInningsView,
  teamHasPlayingXi,
  teamMatchesInningsBatting,
  teamMatchesInningsBowling,
  type TeamControlAction,
  type TeamSide,
} from './control-team';
import {
  connectLiveSocket,
  emitGraphicsCommand,
  queryApiAndMatch,
  type GraphicsCommandMessage,
  type GraphicsKind,
} from './live-client';
import type {
  BallType,
  BroadcastPlayerStatsView,
  InningsBreakView,
  MatchContext,
  ScorecardResponse,
} from './types';
import { parseInningsBreakView, parseScorecardViewSource } from './types';
import type { ScorecardViewSource } from './types';
import { formatRunsToWinLine, formatTossLine } from './view-model';
import { formatPlayingXiPreview } from './playing-xi-card';
import { formatTossResultLine } from './toss-result-card';
import type { Socket } from 'socket.io-client';

const TEAM_SIDES: TeamSide[] = ['a', 'b'];

const COMMON_LABELS: Record<
  Exclude<
    GraphicsKind,
    | 'hello'
    | 'toss'
    | 'chase'
    | 'boundaries'
    | 'partnership'
    | 'points_table'
    | 'tournament_top_batsmen'
    | 'tournament_top_bowlers'
    | 'tournament_fours'
    | 'tournament_sixes'
  >,
  string
> = {
  fow: 'Last Wicket',
  batsman: 'Batsman',
  batsman_career: 'Batsman Career Stats',
  bowler: 'Bowler',
  bowler_career: 'Bowler Career Stats',
  innings_break: 'Innings break',
  toss_result: 'Toss Result',
  playing_xi: 'Playing XI',
  wagon_wheel: 'Wagon Wheel',
};

const TEAM_ACTION_LABELS: Record<TeamControlAction, string> = {
  playing_xi: 'Playing XI',
  batting_lineup: 'Batting line-up',
  bowling: 'Bowling',
  partnerships: 'Partnership',
  fow: 'Last wicket',
  batsman: 'Batsman',
  bowler: 'Bowler',
  batsman_career: 'Batsman career',
  bowler_career: 'Bowler career',
};

const SCORECARD_VIEW_LABELS: Record<InningsBreakView, string> = {
  batting: 'Batting',
  bowling: 'Bowling',
  fow: 'Fall of wickets',
  partnerships: 'Partnerships',
  overs: 'Overs summary',
};

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) {
    throw new Error(`Missing #${id}`);
  }
  return node as T;
}

function setEnabled(button: HTMLButtonElement, enabled: boolean): void {
  button.disabled = !enabled;
}

function appendOption(
  select: HTMLSelectElement,
  value: string,
  label: string,
): void {
  const opt = document.createElement('option');
  opt.value = value;
  opt.textContent = label;
  select.appendChild(opt);
}

function parseTeamSide(value: string | null | undefined): TeamSide | null {
  return value === 'a' || value === 'b' ? value : null;
}

function parseTeamAction(value: string | null | undefined): TeamControlAction | null {
  const actions: TeamControlAction[] = [
    'playing_xi',
    'batting_lineup',
    'bowling',
    'partnerships',
    'fow',
    'batsman',
    'bowler',
    'batsman_career',
    'bowler_career',
  ];
  return actions.includes(value as TeamControlAction)
    ? (value as TeamControlAction)
    : null;
}

function start(): void {
  const { matchId, apiBase } = queryApiAndMatch();
  const matchLabel = el<HTMLParagraphElement>('match-label');
  const connLabel = el<HTMLParagraphElement>('conn-label');
  const onAirDock = el<HTMLElement>('on-air-dock');
  const onAir = el<HTMLParagraphElement>('on-air');
  const onAirDetail = el<HTMLParagraphElement>('on-air-detail');
  const btnClearAir = el<HTMLButtonElement>('btn-clear-air');
  const btnShowInnings = el<HTMLButtonElement>('btn-show-innings');
  const btnShowToss = el<HTMLButtonElement>('btn-show-toss');
  const btnShowTossResult = el<HTMLButtonElement>('btn-show-toss-result');
  const btnShowPlayingXi = el<HTMLButtonElement>('btn-show-playing-xi');
  const btnShowChase = el<HTMLButtonElement>('btn-show-chase');

  if (!matchId) {
    matchLabel.textContent = 'Missing matchId — add ?matchId=… to the URL';
    connLabel.textContent = 'Offline';
    return;
  }

  const resolvedMatchId = matchId;
  matchLabel.textContent = `Match ${resolvedMatchId}`;
  connLabel.textContent = `Connecting to ${apiBase}…`;

  let socket: Socket | null = null;
  let onAirGraphic: keyof typeof COMMON_LABELS | null = null;
  let onAirTeamSide: TeamSide | null = null;
  let onAirTeamAction: TeamControlAction | null = null;
  let playingXiVariant: 'both' | 'single' | 'lineup' = 'both';
  let inningsView: InningsBreakView = 'batting';
  let inningsSource: ScorecardViewSource = 'break';
  let scorecardOnAirView: InningsBreakView | null = null;
  let stripMode: 'default' | 'toss' | 'chase' = 'default';
  let onAirDetailText = '';
  const careerDetailByKey = new Map<string, string>();
  let scorecard: ScorecardResponse | null = null;
  let matchCtx: MatchContext | null = null;
  let ballType: BallType = 'TENNIS';
  const careerCache = new Map<string, BroadcastPlayerStatsView | null>();
  const careerPreviewTokenByKey = new Map<string, number>();
  const rosterByTeamId = new Map<string, TeamRosterPlayer[]>();
  const rosterLoading = new Set<string>();
  let rosterFetchToken = 0;

  function send(cmd: Omit<GraphicsCommandMessage, 'matchId'>): void {
    if (!socket) {
      return;
    }
    emitGraphicsCommand(socket, { matchId: resolvedMatchId, ...cmd });
  }

  function teamBinding(side: TeamSide) {
    return resolveTeamSection(matchCtx, side);
  }

  function nameOf(id: string | null | undefined): string {
    if (!scorecard || !id) {
      return '—';
    }
    return shortName(playerName(scorecard.display, id));
  }

  function teamPick(side: TeamSide, pick: string): HTMLSelectElement | null {
    return document.querySelector<HTMLSelectElement>(
      `.team-pick[data-team-side="${side}"][data-pick="${pick}"]`,
    );
  }

  function teamShowButton(
    side: TeamSide,
    action: TeamControlAction,
  ): HTMLButtonElement | null {
    return document.querySelector<HTMLButtonElement>(
      `.btn-team-show[data-team-side="${side}"][data-team-action="${action}"]`,
    );
  }

  async function loadCareerStats(
    playerId: string,
  ): Promise<BroadcastPlayerStatsView | null> {
    const key = `${playerId}:${ballType}`;
    if (careerCache.has(key)) {
      return careerCache.get(key) ?? null;
    }
    const stats = await fetchBroadcastPlayerStats(apiBase, playerId, ballType);
    careerCache.set(key, stats);
    return stats;
  }

  function formatCareerPreview(stats: BroadcastPlayerStatsView): string {
    return `${stats.matches} Mat · ${stats.wickets} Wkt · Avg ${formatStat(stats.bowlingAverage, 2)} · Eco ${formatStat(stats.economy, 2)} · Best ${stats.bestBowling?.trim() || '—'}`;
  }

  function formatBatsmanCareerPreview(stats: BroadcastPlayerStatsView): string {
    const hs = stats.highestScore?.trim() || '—';
    const meta = formatHighestScoreMeta(stats);
    const hsPart = meta ? `HS ${hs} (${meta})` : `HS ${hs}`;
    return `${stats.battingInnings} Inn · ${stats.runs} Runs · Avg ${formatStat(stats.average, 2)} · SR ${formatStat(stats.strikeRate, 1)} · 30s ${stats.thirties} · 50s ${stats.fifties} · ${hsPart}`;
  }

  function rosterDisplayName(p: TeamRosterPlayer): string {
    const fromScore = scorecard
      ? playerName(scorecard.display, p.userId)
      : '—';
    if (fromScore !== '—') {
      return shortName(fromScore);
    }
    const full = `${p.firstName} ${p.lastName}`.trim();
    return full ? shortName(full) : '—';
  }

  function requestTeamRoster(teamId: string): void {
    const tournamentId = matchCtx?.tournamentId?.trim() ?? '';
    if (!tournamentId || rosterByTeamId.has(teamId) || rosterLoading.has(teamId)) {
      return;
    }
    rosterLoading.add(teamId);
    const token = ++rosterFetchToken;
    void fetchTeamRoster(apiBase, tournamentId, teamId).then((players) => {
      rosterLoading.delete(teamId);
      if (token !== rosterFetchToken) {
        return;
      }
      rosterByTeamId.set(teamId, players);
      rebuildTeamPickers();
      void refreshTeamCareerPreviews();
    });
  }

  function fillTeamCareerSelect(
    select: HTMLSelectElement,
    prev: string,
    teamId: string | null,
    preferredPlayerId: string | null,
    labels: {
      waiting: string;
      loading: string;
      empty: string;
      preferredRole: string;
    },
  ): void {
    select.innerHTML = '';
    if (!teamId) {
      appendOption(select, '', labels.waiting);
      select.disabled = true;
      return;
    }
    const roster = rosterByTeamId.get(teamId);
    if (!roster) {
      appendOption(select, '', labels.loading);
      select.disabled = true;
      requestTeamRoster(teamId);
      return;
    }
    if (roster.length === 0) {
      appendOption(select, '', labels.empty);
      select.disabled = true;
      return;
    }
    select.disabled = false;
    const sorted = [...roster].sort((a, b) =>
      rosterDisplayName(a).localeCompare(rosterDisplayName(b)),
    );
    const ordered: TeamRosterPlayer[] = [];
    if (preferredPlayerId) {
      const cur = sorted.find((p) => p.userId === preferredPlayerId);
      if (cur) {
        ordered.push(cur);
      }
    }
    for (const p of sorted) {
      if (!ordered.some((o) => o.userId === p.userId)) {
        ordered.push(p);
      }
    }
    for (const p of ordered) {
      const role =
        p.userId === preferredPlayerId ? labels.preferredRole : null;
      const label = [rosterDisplayName(p), role].filter(Boolean).join(' · ');
      appendOption(select, p.userId, label);
    }
    if ([...select.options].some((o) => o.value === prev && prev !== '')) {
      select.value = prev;
    } else if (
      preferredPlayerId &&
      [...select.options].some((o) => o.value === preferredPlayerId)
    ) {
      select.value = preferredPlayerId;
    } else if (select.options[0]) {
      select.selectedIndex = 0;
    }
  }

  function rebuildTeamPickers(): void {
    const innings = scorecard ? resolveActiveInnings(scorecard) : null;
    for (const side of TEAM_SIDES) {
      const team = teamBinding(side);
      const batPick = teamPick(side, 'batsman');
      const bowlPick = teamPick(side, 'bowler');
      const batCareerPick = teamPick(side, 'batsman_career');
      const bowlCareerPick = teamPick(side, 'bowler_career');
      if (!batPick || !bowlPick || !batCareerPick || !bowlCareerPick) {
        continue;
      }

      const batPrev = batPick.value;
      const bowlPrev = bowlPick.value;
      const batCareerPrev = batCareerPick.value;
      const bowlCareerPrev = bowlCareerPick.value;

      batPick.innerHTML = '';
      bowlPick.innerHTML = '';

      const battingNow = teamMatchesInningsBatting(team, innings);
      const bowlingNow = teamMatchesInningsBowling(team, innings);

      if (battingNow && innings) {
        batPick.disabled = false;
        const creaseIds = [
          innings.currentStrikerId,
          innings.currentNonStrikerId,
        ].filter((id): id is string => Boolean(id));
        const seen = new Set<string>();
        for (const id of creaseIds) {
          if (seen.has(id)) {
            continue;
          }
          seen.add(id);
          const row = innings.batters.find((b) => b.playerId === id);
          const figs = row ? `${row.runs} (${row.balls})` : '';
          const role =
            id === innings.currentStrikerId
              ? 'Striker'
              : id === innings.currentNonStrikerId
                ? 'Non-striker'
                : null;
          appendOption(
            batPick,
            id,
            [nameOf(id), figs, role].filter(Boolean).join(' · '),
          );
        }
        if (batPick.options.length === 0) {
          appendOption(batPick, '', 'Waiting for batsmen…');
          batPick.disabled = true;
        } else if ([...batPick.options].some((o) => o.value === batPrev)) {
          batPick.value = batPrev;
        } else if (innings.currentStrikerId) {
          batPick.value = innings.currentStrikerId;
        }
      } else {
        appendOption(batPick, '', 'Team not batting…');
        batPick.disabled = true;
      }

      if (bowlingNow && innings) {
        bowlPick.disabled = false;
        const orderedIds: string[] = [];
        if (innings.currentBowlerId) {
          orderedIds.push(innings.currentBowlerId);
        }
        for (const b of innings.bowlers) {
          if (!orderedIds.includes(b.playerId)) {
            orderedIds.push(b.playerId);
          }
        }
        for (const id of orderedIds) {
          const row = innings.bowlers.find((b) => b.playerId === id);
          const figs = row
            ? `${row.oversText}-${row.runsConceded}-${row.wickets}`
            : '';
          const role = id === innings.currentBowlerId ? 'Current' : null;
          appendOption(
            bowlPick,
            id,
            [nameOf(id), figs, role].filter(Boolean).join(' · '),
          );
        }
        if (bowlPick.options.length === 0) {
          appendOption(bowlPick, '', 'No bowlers yet…');
          bowlPick.disabled = true;
        } else if ([...bowlPick.options].some((o) => o.value === bowlPrev)) {
          bowlPick.value = bowlPrev;
        } else if (innings.currentBowlerId) {
          bowlPick.value = innings.currentBowlerId;
        }
      } else {
        appendOption(bowlPick, '', 'Team not bowling…');
        bowlPick.disabled = true;
      }

      const preferredBatter =
        battingNow && innings?.currentStrikerId ? innings.currentStrikerId : null;
      const preferredBowler =
        bowlingNow && innings?.currentBowlerId ? innings.currentBowlerId : null;

      fillTeamCareerSelect(
        batCareerPick,
        batCareerPrev,
        team.isExternal ? null : team.teamId,
        preferredBatter,
        {
          waiting: team.isExternal ? 'External team' : 'Loading team…',
          loading: 'Loading roster…',
          empty: 'No players…',
          preferredRole: 'Striker',
        },
      );
      fillTeamCareerSelect(
        bowlCareerPick,
        bowlCareerPrev,
        team.isExternal ? null : team.teamId,
        preferredBowler,
        {
          waiting: team.isExternal ? 'External team' : 'Loading team…',
          loading: 'Loading roster…',
          empty: 'No players…',
          preferredRole: 'Current',
        },
      );
    }
  }

  async function refreshTeamCareerPreview(
    side: TeamSide,
    pick: 'batsman_career' | 'bowler_career',
  ): Promise<void> {
    const select = teamPick(side, pick);
    const btn = teamShowButton(
      side,
      pick === 'batsman_career' ? 'batsman_career' : 'bowler_career',
    );
    if (!select || !btn) {
      return;
    }
    const key = `${side}:${pick}`;
    const token = (careerPreviewTokenByKey.get(key) ?? 0) + 1;
    careerPreviewTokenByKey.set(key, token);
    const playerId = select.value.trim();
    if (!playerId || select.disabled) {
      careerDetailByKey.delete(key);
      setEnabled(btn, false);
      return;
    }
    careerDetailByKey.delete(key);
    setEnabled(btn, false);
    const stats = await loadCareerStats(playerId);
    if (token !== careerPreviewTokenByKey.get(key)) {
      return;
    }
    const ok =
      pick === 'batsman_career'
        ? stats != null && hasBatsmanCareerStats(stats)
        : stats != null && hasBowlerCareerStats(stats);
    if (!ok) {
      careerDetailByKey.delete(key);
      setEnabled(btn, false);
      return;
    }
    const detail =
      pick === 'batsman_career'
        ? `${nameOf(playerId)} · ${formatBatsmanCareerPreview(stats!)}`
        : `${nameOf(playerId)} · ${formatCareerPreview(stats!)}`;
    careerDetailByKey.set(key, detail);
    setEnabled(btn, true);
    paintOnAirDock();
  }

  async function refreshTeamCareerPreviews(): Promise<void> {
    for (const side of TEAM_SIDES) {
      await refreshTeamCareerPreview(side, 'batsman_career');
      await refreshTeamCareerPreview(side, 'bowler_career');
    }
  }

  function refreshTeamTitles(): void {
    for (const side of TEAM_SIDES) {
      const title = document.querySelector<HTMLElement>(
        `[data-team-title="${side}"]`,
      );
      if (title) {
        title.textContent = teamBinding(side).name;
      }
    }
  }

  function refreshTeamControls(): void {
    refreshTeamTitles();
    for (const side of TEAM_SIDES) {
      const team = teamBinding(side);
      const innings = scorecard ? resolveActiveInnings(scorecard) : null;
      const battingInnings = findBattingInningsForTeam(scorecard, team);
      const hasXi = teamHasPlayingXi(matchCtx, team);

      for (const action of Object.keys(TEAM_ACTION_LABELS) as TeamControlAction[]) {
        const btn = teamShowButton(side, action);
        if (!btn) {
          continue;
        }
        let enabled = false;
        switch (action) {
          case 'playing_xi':
          case 'batting_lineup':
            enabled = hasXi;
            break;
          case 'bowling':
          case 'partnerships':
            enabled = battingInnings != null;
            break;
          case 'fow':
            enabled = previewTeamLastWicket(scorecard, team) != null;
            break;
          case 'batsman':
            enabled =
              teamMatchesInningsBatting(team, innings) &&
              Boolean(teamPick(side, 'batsman')?.value.trim());
            break;
          case 'bowler':
            enabled =
              teamMatchesInningsBowling(team, innings) &&
              Boolean(teamPick(side, 'bowler')?.value.trim());
            break;
          case 'batsman_career':
          case 'bowler_career': {
            const pick = teamPick(side, action);
            enabled = Boolean(pick && !pick.disabled && pick.value.trim());
            break;
          }
          default:
            break;
        }
        setEnabled(btn, enabled);
      }
    }
  }

  function previewInnings(): string | null {
    if (!scorecard || scorecard.innings.length === 0) {
      return null;
    }
    const card = scorecard;
    const parts = card.innings.map((inn) => {
      const label = battingTeamLabel(card, inn);
      return `${label} ${inn.runs}/${inn.wickets} (${inn.oversText})`;
    });
    const target =
      scorecard.effectiveTarget != null && scorecard.effectiveTarget > 0
        ? ` · Target ${scorecard.effectiveTarget}`
        : '';
    return `${parts.join(' · ')}${target}`;
  }

  function anythingLive(): boolean {
    return onAirGraphic != null || stripMode !== 'default';
  }

  function syncInningsTabs(): void {
    const tabs = el<HTMLElement>('innings-tabs');
    const onAir =
      onAirGraphic === 'innings_break' && inningsSource === 'break';
    tabs.hidden = !onAir;
    for (const btn of tabs.querySelectorAll<HTMLButtonElement>('[data-innings-view]')) {
      btn.classList.toggle(
        'is-active-tab',
        btn.dataset.inningsView === inningsView,
      );
    }
  }

  function syncTeamOnAir(): void {
    for (const side of TEAM_SIDES) {
      for (const action of Object.keys(TEAM_ACTION_LABELS) as TeamControlAction[]) {
        const row = document.querySelector<HTMLElement>(
          `.team-column[data-team-side="${side}"] .team-control[data-team-action="${action}"]`,
        );
        if (!row) {
          continue;
        }
        let live = false;
        if (onAirTeamSide === side && onAirTeamAction === action) {
          if (action === 'playing_xi' && onAirGraphic === 'playing_xi') {
            live = playingXiVariant === 'single';
          } else if (action === 'batting_lineup' && onAirGraphic === 'playing_xi') {
            live = playingXiVariant === 'lineup';
          } else if (
            (action === 'bowling' || action === 'partnerships') &&
            onAirGraphic === 'innings_break'
          ) {
            live = inningsSource === 'scorecard';
          } else if (action === 'fow' && onAirGraphic === 'fow') {
            live = true;
          } else if (
            (action === 'batsman' ||
              action === 'bowler' ||
              action === 'batsman_career' ||
              action === 'bowler_career') &&
            onAirGraphic === action
          ) {
            live = true;
          }
        }
        row.classList.toggle('is-on-air', live);
        const badge = row.querySelector<HTMLElement>('.on-air-badge');
        if (badge) {
          badge.hidden = !live;
        }
      }
    }
  }

  function syncCommonOnAir(): void {
    const inningsStandalone =
      onAirGraphic === 'innings_break' && inningsSource === 'break';
    for (const card of document.querySelectorAll<HTMLElement>('.control-card[data-graphic]')) {
      const graphic = card.dataset.graphic;
      if (!graphic || graphic === 'toss' || graphic === 'chase') {
        continue;
      }
      let live = false;
      if (graphic === 'innings_break') {
        live = inningsStandalone;
      } else if (graphic === 'playing_xi') {
        live = onAirGraphic === 'playing_xi' && playingXiVariant === 'both';
      } else {
        live = onAirGraphic === graphic;
      }
      card.classList.toggle('is-on-air', live);
      const badge = card.querySelector<HTMLElement>('.on-air-badge');
      if (badge) {
        badge.hidden = !live;
      }
    }
  }

  function paintOnAirDock(): void {
    const live = anythingLive();
    onAirDock.classList.toggle('is-live', live);
    setEnabled(btnClearAir, live);

    if (
      onAirGraphic === 'innings_break' &&
      inningsSource === 'scorecard' &&
      onAirTeamSide
    ) {
      onAir.textContent = `ON AIR: ${teamBinding(onAirTeamSide).name} · ${SCORECARD_VIEW_LABELS[scorecardOnAirView ?? inningsView]}`;
      onAirDetail.textContent = onAirDetailText;
      return;
    }
    if (
      onAirGraphic === 'innings_break' &&
      inningsSource === 'break'
    ) {
      onAir.textContent = 'ON AIR: Innings break';
      onAirDetail.textContent = onAirDetailText;
      return;
    }
    if (onAirGraphic === 'playing_xi' && onAirTeamSide && playingXiVariant !== 'both') {
      onAir.textContent = `ON AIR: ${teamBinding(onAirTeamSide).name} · ${playingXiVariant === 'lineup' ? 'Batting line-up' : 'Playing XI'}`;
      onAirDetail.textContent = onAirDetailText;
      return;
    }
    if (onAirGraphic && onAirTeamSide && onAirTeamAction) {
      onAir.textContent = `ON AIR: ${teamBinding(onAirTeamSide).name} · ${TEAM_ACTION_LABELS[onAirTeamAction]}`;
      onAirDetail.textContent = onAirDetailText;
      return;
    }
    if (onAirGraphic) {
      onAir.textContent = `ON AIR: ${COMMON_LABELS[onAirGraphic]}`;
      onAirDetail.textContent = onAirDetailText;
      return;
    }
    if (stripMode === 'toss') {
      onAir.textContent = 'ON AIR: Toss (strip)';
      onAirDetail.textContent =
        el<HTMLParagraphElement>('preview-toss').textContent ?? '';
      return;
    }
    if (stripMode === 'chase') {
      onAir.textContent = 'ON AIR: Runs to win (strip)';
      onAirDetail.textContent =
        el<HTMLParagraphElement>('preview-chase').textContent ?? '';
      return;
    }
    onAir.textContent = 'Nothing on air';
    onAirDetail.textContent = '';
  }

  function setStripSection(graphic: 'toss' | 'chase', live: boolean): void {
    const section = el<HTMLElement>(graphic === 'toss' ? 'sec-toss' : 'sec-chase');
    section.classList.toggle('is-on-air', live);
    const badge = section.querySelector<HTMLElement>('.on-air-badge');
    if (badge) {
      badge.hidden = !live;
    }
  }

  function setStripMode(mode: 'default' | 'toss' | 'chase'): void {
    stripMode = mode;
    setStripSection('toss', mode === 'toss');
    setStripSection('chase', mode === 'chase');
    paintOnAirDock();
  }

  function setOnAir(
    kind: keyof typeof COMMON_LABELS | null,
    teamSide: TeamSide | null = null,
    teamAction: TeamControlAction | null = null,
    xiVariant: 'both' | 'single' | 'lineup' = 'both',
  ): void {
    onAirGraphic = kind;
    onAirTeamSide = teamSide;
    onAirTeamAction = teamAction;
    playingXiVariant = xiVariant;
    if (kind !== 'innings_break') {
      if (teamAction !== 'bowling' && teamAction !== 'partnerships') {
        inningsSource = 'break';
        scorecardOnAirView = null;
      }
    }
    if (kind === 'playing_xi' && xiVariant === 'both') {
      onAirTeamSide = null;
      onAirTeamAction = null;
    }
    if (teamAction === 'batsman_career' || teamAction === 'bowler_career') {
      const key = `${teamSide}:${teamAction}`;
      onAirDetailText = careerDetailByKey.get(key) ?? '';
    } else if (kind === 'playing_xi' && xiVariant === 'both') {
      onAirDetailText = formatPlayingXiPreview(matchCtx) ?? '';
    } else if (kind === 'toss_result') {
      onAirDetailText = formatTossResultLine(matchCtx) ?? '';
    } else if (kind === 'innings_break' && inningsSource === 'break') {
      onAirDetailText = previewInnings() ?? '';
    } else {
      onAirDetailText = '';
    }
    paintOnAirDock();
    syncInningsTabs();
    syncTeamOnAir();
    syncCommonOnAir();
  }

  function refreshCommonPreviews(): void {
    const toss = formatTossLine(matchCtx);
    el<HTMLParagraphElement>('preview-toss').textContent =
      toss ?? 'Toss not recorded yet';
    setEnabled(btnShowToss, toss != null);

    const tossResult = formatTossResultLine(matchCtx);
    el<HTMLParagraphElement>('preview-toss-result').textContent =
      tossResult ?? 'Toss not recorded yet';
    setEnabled(btnShowTossResult, tossResult != null);

    const playingXi = formatPlayingXiPreview(matchCtx);
    el<HTMLParagraphElement>('preview-playing-xi').textContent =
      playingXi ?? 'Waiting for squads…';
    setEnabled(btnShowPlayingXi, playingXi != null);

    const chase = formatRunsToWinLine(scorecard);
    el<HTMLParagraphElement>('preview-chase').textContent =
      chase ?? 'No chase yet (2nd innings / target required)';
    setEnabled(btnShowChase, chase != null);

    const inn = previewInnings();
    el<HTMLParagraphElement>('preview-innings').textContent =
      inn ?? 'Waiting for innings…';
    setEnabled(btnShowInnings, inn != null);
  }

  function refreshPreviews(): void {
    refreshCommonPreviews();
    refreshTeamControls();
    if (onAirGraphic === 'innings_break' && inningsSource === 'break') {
      onAirDetailText = previewInnings() ?? '';
      onAirDetail.textContent = onAirDetailText;
    }
    paintOnAirDock();
  }

  function applyScorecard(card: ScorecardResponse | null): void {
    scorecard = card;
    rebuildTeamPickers();
    void refreshTeamCareerPreviews().then(() => {
      refreshPreviews();
    });
  }

  function resolvePlayerForTeamAction(
    side: TeamSide,
    action: TeamControlAction,
  ): string | null {
    if (action === 'batsman') {
      return teamPick(side, 'batsman')?.value.trim() || null;
    }
    if (action === 'bowler') {
      return teamPick(side, 'bowler')?.value.trim() || null;
    }
    if (action === 'batsman_career') {
      return teamPick(side, 'batsman_career')?.value.trim() || null;
    }
    if (action === 'bowler_career') {
      return teamPick(side, 'bowler_career')?.value.trim() || null;
    }
    return null;
  }

  function showTeamGraphic(side: TeamSide, action: TeamControlAction): void {
    const team = teamBinding(side);
    const playerId = resolvePlayerForTeamAction(side, action);
    const cmd = buildTeamShowCommand(
      action,
      team,
      scorecard,
      matchCtx,
      playerId,
    );
    if (!cmd) {
      return;
    }
    send(cmd);

    const view = teamActionToInningsView(action);
    if (view) {
      inningsSource = 'scorecard';
      scorecardOnAirView = view;
      setOnAir('innings_break', side, action, 'both');
      return;
    }
    if (action === 'playing_xi') {
      setOnAir('playing_xi', side, action, 'single');
      return;
    }
    if (action === 'batting_lineup') {
      setOnAir('playing_xi', side, action, 'lineup');
      return;
    }
    if (
      action === 'fow' ||
      action === 'batsman' ||
      action === 'bowler' ||
      action === 'batsman_career' ||
      action === 'bowler_career'
    ) {
      setOnAir(action, side, action, 'both');
    }
  }

  function primeTeamRosters(): void {
    for (const side of TEAM_SIDES) {
      const teamId = teamBinding(side).teamId;
      if (teamId) {
        requestTeamRoster(teamId);
      }
    }
  }

  void Promise.all([
    fetchScorecard(apiBase, resolvedMatchId),
    fetchMatchContext(apiBase, resolvedMatchId),
    fetchMatchBallType(apiBase, resolvedMatchId),
  ]).then(([seed, ctx, bt]) => {
    ballType = bt;
    if (ctx) {
      matchCtx = ctx;
      primeTeamRosters();
    }
    if (seed) {
      applyScorecard(seed);
    } else {
      rebuildTeamPickers();
      refreshPreviews();
    }
  });

  socket = connectLiveSocket(apiBase, resolvedMatchId, {
    onStatus: (s) => {
      if (s === 'live') {
        connLabel.textContent = 'Live';
        connLabel.title = apiBase;
        connLabel.className = 'conn-label status-live';
        return;
      }
      connLabel.textContent = s === 'connecting' ? 'Connecting…' : 'Offline';
      connLabel.title = apiBase;
      connLabel.className = `conn-label status-${s}`;
    },
    onLiveState: (state) => {
      applyScorecard(state);
    },
    onGraphicsCommand: (cmd) => {
      if (cmd.action === 'hide_all') {
        setOnAir(null);
        setStripMode('default');
        return;
      }
      if (!cmd.graphic || cmd.graphic === 'hello') {
        return;
      }
      if (cmd.graphic === 'toss') {
        if (cmd.action === 'show') {
          setStripMode('toss');
        } else if (cmd.action === 'hide' && stripMode === 'toss') {
          setStripMode('default');
        }
        return;
      }
      if (cmd.graphic === 'chase') {
        if (cmd.action === 'show') {
          setStripMode('chase');
        } else if (cmd.action === 'hide' && stripMode === 'chase') {
          setStripMode('default');
        }
        return;
      }
      if (cmd.action === 'show') {
        if (cmd.graphic === 'innings_break') {
          inningsView = parseInningsBreakView(cmd.payload?.view);
          inningsSource = parseScorecardViewSource(cmd.payload?.source);
          if (inningsSource === 'scorecard') {
            scorecardOnAirView = inningsView;
          } else {
            scorecardOnAirView = null;
          }
          setOnAir('innings_break');
        } else if (cmd.graphic === 'playing_xi') {
          const variant = cmd.payload?.variant ?? 'both';
          setOnAir('playing_xi', null, null, variant);
        } else if (
          cmd.graphic === 'fow' ||
          cmd.graphic === 'batsman' ||
          cmd.graphic === 'bowler' ||
          cmd.graphic === 'batsman_career' ||
          cmd.graphic === 'bowler_career' ||
          cmd.graphic === 'toss_result'
        ) {
          setOnAir(cmd.graphic);
        }
      } else if (cmd.action === 'hide' && onAirGraphic === cmd.graphic) {
        setOnAir(null);
      }
    },
  });

  document.querySelector<HTMLElement>('.team-columns')?.addEventListener(
    'click',
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const btn = target.closest<HTMLButtonElement>('.btn-team-show');
      if (!btn || btn.disabled) {
        return;
      }
      const side = parseTeamSide(btn.dataset.teamSide);
      const action = parseTeamAction(btn.dataset.teamAction);
      if (!side || !action) {
        return;
      }
      showTeamGraphic(side, action);
    },
  );

  for (const side of TEAM_SIDES) {
    for (const pick of ['batsman', 'bowler'] as const) {
      teamPick(side, pick)?.addEventListener('change', () => {
        refreshTeamControls();
      });
    }
    for (const pick of ['batsman_career', 'bowler_career'] as const) {
      teamPick(side, pick)?.addEventListener('change', () => {
        void refreshTeamCareerPreview(side, pick);
        refreshTeamControls();
      });
    }
  }

  el<HTMLButtonElement>('btn-show-innings').addEventListener('click', () => {
    inningsSource = 'break';
    send({
      action: 'show',
      graphic: 'innings_break',
      payload: { view: inningsView, source: 'break' },
    });
    setOnAir('innings_break');
  });

  el<HTMLElement>('innings-tabs').addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const btn = target.closest<HTMLButtonElement>('[data-innings-view]');
    if (!btn) {
      return;
    }
    const next = parseInningsBreakView(btn.dataset.inningsView);
    inningsView = next;
    syncInningsTabs();
    inningsSource = 'break';
    send({
      action: 'show',
      graphic: 'innings_break',
      payload: { view: next, source: 'break' },
    });
    setOnAir('innings_break');
  });

  el<HTMLButtonElement>('btn-show-toss-result').addEventListener('click', () => {
    send({ action: 'show', graphic: 'toss_result' });
    setOnAir('toss_result');
  });

  el<HTMLButtonElement>('btn-show-playing-xi').addEventListener('click', () => {
    send({
      action: 'show',
      graphic: 'playing_xi',
      payload: { variant: 'both' },
    });
    setOnAir('playing_xi', null, null, 'both');
  });

  el<HTMLButtonElement>('btn-show-toss').addEventListener('click', () => {
    send({ action: 'show', graphic: 'toss' });
  });

  el<HTMLButtonElement>('btn-show-chase').addEventListener('click', () => {
    send({ action: 'show', graphic: 'chase' });
  });

  btnClearAir.addEventListener('click', () => {
    if (!anythingLive()) {
      return;
    }
    send({ action: 'hide_all' });
  });
}

start();
