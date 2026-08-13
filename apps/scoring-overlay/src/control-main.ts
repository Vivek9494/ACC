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
  battingSideOptions,
  battingTeamLabel,
  findInningsByKey,
  formatBatterInningsScore,
  formatDismissalShort,
  formatHighestScoreMeta,
  formatStat,
  hasBatsmanCareerStats,
  hasBowlerCareerStats,
  latestFallOfWicket,
  partnershipBatterRuns,
  playerName,
  resolveActiveInnings,
  shortName,
} from './graphics-format';
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
import { formatTossResultLine } from './toss-result-card';
import type { Socket } from 'socket.io-client';

/** Full-screen OBS graphics (not strip-only toss/chase). */
const LABELS: Record<Exclude<GraphicsKind, 'hello' | 'toss' | 'chase'>, string> = {
  partnership: 'Partnership',
  fow: 'Last Wicket',
  batsman: 'Batsman',
  batsman_career: 'Batsman Career Stats',
  bowler: 'Bowler',
  bowler_career: 'Bowler Career Stats',
  innings_break: 'Innings break',
  toss_result: 'Toss Result',
};

const OPERATOR_KINDS = Object.keys(LABELS) as Array<keyof typeof LABELS>;

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

function start(): void {
  const { matchId, apiBase } = queryApiAndMatch();
  const matchLabel = el<HTMLParagraphElement>('match-label');
  const connLabel = el<HTMLParagraphElement>('conn-label');
  const onAirDock = el<HTMLElement>('on-air-dock');
  const onAir = el<HTMLParagraphElement>('on-air');
  const onAirDetail = el<HTMLParagraphElement>('on-air-detail');
  const btnClearAir = el<HTMLButtonElement>('btn-clear-air');
  const pickBatsman = el<HTMLSelectElement>('pick-batsman');
  const pickBowler = el<HTMLSelectElement>('pick-bowler');
  const pickBowlerCareer = el<HTMLSelectElement>('pick-bowler-career');
  const pickBatsmanCareer = el<HTMLSelectElement>('pick-batsman-career');

  const btnShowPartnership = el<HTMLButtonElement>('btn-show-partnership');
  const btnShowFow = el<HTMLButtonElement>('btn-show-fow');
  const btnShowBatsman = el<HTMLButtonElement>('btn-show-batsman');
  const btnShowBowler = el<HTMLButtonElement>('btn-show-bowler');
  const btnShowBowlerCareer = el<HTMLButtonElement>('btn-show-bowler-career');
  const btnShowBatsmanCareer = el<HTMLButtonElement>('btn-show-batsman-career');
  const btnShowInnings = el<HTMLButtonElement>('btn-show-innings');
  const btnShowToss = el<HTMLButtonElement>('btn-show-toss');
  const btnShowTossResult = el<HTMLButtonElement>('btn-show-toss-result');
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
  let onAirGraphic: keyof typeof LABELS | null = null;
  let inningsView: InningsBreakView = 'batting';
  let inningsSource: ScorecardViewSource = 'break';
  let scorecardOnAirView: InningsBreakView | null = null;
  let scorecardOnAirInningsId: string | null = null;
  let stripMode: 'default' | 'toss' | 'chase' = 'default';
  let onAirDetailText = '';
  let batsmanCareerDetail = '';
  let bowlerCareerDetail = '';
  let scorecard: ScorecardResponse | null = null;
  let matchCtx: MatchContext | null = null;
  let ballType: BallType = 'TENNIS';
  const careerCache = new Map<string, BroadcastPlayerStatsView | null>();
  let bowlerCareerPreviewToken = 0;
  let batsmanCareerPreviewToken = 0;
  /** tournament teamId → full roster (bowling-side career picker). */
  const rosterByTeamId = new Map<string, TeamRosterPlayer[]>();
  const rosterLoading = new Set<string>();
  let rosterFetchToken = 0;

  function send(cmd: Omit<GraphicsCommandMessage, 'matchId'>): void {
    if (!socket) {
      return;
    }
    emitGraphicsCommand(socket, { matchId: resolvedMatchId, ...cmd });
  }

  function nameOf(id: string | null | undefined): string {
    if (!scorecard || !id) {
      return '—';
    }
    return shortName(playerName(scorecard.display, id));
  }

  function resolveBatsmanId(): string | null {
    const picked = pickBatsman.value.trim();
    if (picked) {
      return picked;
    }
    if (!scorecard) {
      return null;
    }
    return resolveActiveInnings(scorecard)?.currentStrikerId ?? null;
  }

  function resolveBowlerId(): string | null {
    const picked = pickBowler.value.trim();
    if (picked) {
      return picked;
    }
    if (!scorecard) {
      return null;
    }
    return resolveActiveInnings(scorecard)?.currentBowlerId ?? null;
  }

  function resolveBowlerCareerId(): string | null {
    const picked = pickBowlerCareer.value.trim();
    if (picked) {
      return picked;
    }
    if (!scorecard) {
      return null;
    }
    return resolveActiveInnings(scorecard)?.currentBowlerId ?? null;
  }

  function resolveBatsmanCareerId(): string | null {
    const picked = pickBatsmanCareer.value.trim();
    if (picked) {
      return picked;
    }
    if (!scorecard) {
      return null;
    }
    return resolveActiveInnings(scorecard)?.currentStrikerId ?? null;
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

  function previewPartnership(): string | null {
    if (!scorecard) {
      return null;
    }
    const innings = resolveActiveInnings(scorecard);
    const ps = innings?.partnership;
    if (!ps || ps.batterIds.length < 2) {
      return null;
    }
    const [a, b] = ps.batterIds;
    return `${ps.runs} (${ps.balls}) · ${nameOf(a)} ${partnershipBatterRuns(ps, a ?? '')} & ${nameOf(b)} ${partnershipBatterRuns(ps, b ?? '')}`;
  }

  function previewFow(): string | null {
    if (!scorecard) {
      return null;
    }
    const innings = resolveActiveInnings(scorecard);
    const fow = latestFallOfWicket(innings);
    if (!fow || !innings) {
      return null;
    }
    const batter = innings.batters.find((row) => row.playerId === fow.playerId);
    const dismissalRaw = batter
      ? formatDismissalShort(batter, (id) => nameOf(id)).trim()
      : '';
    const dismissal = dismissalRaw || 'out';
    const figs = batter
      ? formatBatterInningsScore(batter)
      : '0 (0)';
    return `${nameOf(fow.playerId)} · ${figs} · ${dismissal}`;
  }

  function populateScorecardTeamPicks(): void {
    const options = battingSideOptions(scorecard, matchCtx);
    const picks = document.querySelectorAll<HTMLSelectElement>('.scorecard-team-pick');
    const hasEnabled = options.some((o) => o.enabled);
    for (const pick of picks) {
      const prev = pick.value;
      pick.replaceChildren();
      if (options.length === 0) {
        appendOption(pick, '', 'No innings yet');
        pick.disabled = true;
        continue;
      }
      pick.disabled = false;
      for (const opt of options) {
        const node = document.createElement('option');
        node.value = opt.inningsId ?? '';
        node.textContent = opt.label;
        node.disabled = !opt.enabled;
        pick.appendChild(node);
      }
      const keep = [...pick.options].some(
        (o) => o.value === prev && !o.disabled && prev.length > 0,
      );
      const firstEnabled = [...pick.options].find((o) => !o.disabled && o.value);
      pick.value = keep ? prev : (firstEnabled?.value ?? '');
    }
    for (const btn of document.querySelectorAll<HTMLButtonElement>('.btn-show-scorecard')) {
      const view = btn.dataset.scorecardView;
      const pick = document.querySelector<HTMLSelectElement>(
        `.scorecard-team-pick[data-scorecard-view="${view}"]`,
      );
      setEnabled(btn, Boolean(pick?.value));
    }
    el<HTMLParagraphElement>('preview-scorecard-views').textContent = hasEnabled
      ? 'Show any innings view for the selected batting side'
      : 'Waiting for a team to bat…';
  }

  function previewInnings(): string | null {
    if (!scorecard || scorecard.innings.length === 0) {
      return null;
    }
    const parts = scorecard.innings.map((inn) => {
      const team = battingTeamLabel(scorecard!, inn);
      return `${team} ${inn.runs}/${inn.wickets} (${inn.oversText})`;
    });
    const target =
      scorecard.effectiveTarget != null && scorecard.effectiveTarget > 0
        ? ` · Target ${scorecard.effectiveTarget}`
        : '';
    return `${parts.join(' · ')}${target}`;
  }

  function previewBatsman(): string | null {
    const playerId = resolveBatsmanId();
    if (!playerId || !scorecard) {
      return null;
    }
    const innings = resolveActiveInnings(scorecard);
    const batter = innings?.batters.find((b) => b.playerId === playerId);
    const figs = batter
      ? `${innings?.currentStrikerId === playerId && !batter.isOut ? `${batter.runs}*` : batter.runs} (${batter.balls})`
      : '0 (0)';
    return `${nameOf(playerId)} · ${figs}`;
  }

  function previewBowler(): string | null {
    const playerId = resolveBowlerId();
    if (!playerId || !scorecard) {
      return null;
    }
    const innings = resolveActiveInnings(scorecard);
    const bowler = innings?.bowlers.find((b) => b.playerId === playerId);
    const overs = bowler?.oversText?.trim() || '0.0';
    const maidens = bowler?.maidens ?? 0;
    const dots = bowler?.dotBalls ?? 0;
    const wickets = bowler?.wickets ?? 0;
    const runs = bowler?.runsConceded ?? 0;
    const economy =
      bowler && Number.isFinite(bowler.economy)
        ? bowler.economy
        : 0;
    return `${nameOf(playerId)} · ${overs} ov · ${maidens} M · ${dots} D · ${wickets} W · ${runs} R · Eco ${formatStat(economy, 2)}`;
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

  function previewToss(): string | null {
    return formatTossLine(matchCtx);
  }

  function previewTossResult(): string | null {
    return formatTossResultLine(matchCtx);
  }

  function previewChase(): string | null {
    return formatRunsToWinLine(scorecard);
  }

  function detailForKind(kind: keyof typeof LABELS): string {
    switch (kind) {
      case 'partnership':
        return previewPartnership() ?? '';
      case 'fow':
        return previewFow() ?? '';
      case 'batsman':
        return previewBatsman() ?? '';
      case 'bowler':
        return previewBowler() ?? '';
      case 'bowler_career':
        return bowlerCareerDetail;
      case 'batsman_career':
        return batsmanCareerDetail;
      case 'innings_break':
        if (inningsSource === 'scorecard' && scorecardOnAirInningsId && scorecard) {
          const inn = findInningsByKey(scorecard, scorecardOnAirInningsId);
          const viewLabel = SCORECARD_VIEW_LABELS[scorecardOnAirView ?? inningsView];
          if (inn) {
            return `${viewLabel} · ${battingTeamLabel(scorecard, inn)} ${inn.runs}/${inn.wickets}`;
          }
          return viewLabel;
        }
        return previewInnings() ?? '';
      case 'toss_result':
        return previewTossResult() ?? '';
      default:
        return '';
    }
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

  function syncScorecardViewRows(): void {
    const live =
      onAirGraphic === 'innings_break' && inningsSource === 'scorecard';
    for (const row of document.querySelectorAll<HTMLElement>('.scorecard-view-row')) {
      const view = parseInningsBreakView(row.dataset.scorecardView);
      row.classList.toggle(
        'is-on-air',
        live && view === scorecardOnAirView,
      );
    }
  }

  function anythingLive(): boolean {
    return onAirGraphic != null || stripMode !== 'default';
  }

  function paintOnAirDock(): void {
    const live = anythingLive();
    onAirDock.classList.toggle('is-live', live);
    setEnabled(btnClearAir, live);
    const inningsStandalone =
      onAirGraphic === 'innings_break' && inningsSource === 'scorecard';
    if (inningsStandalone) {
      onAir.textContent = `ON AIR: Scorecard · ${SCORECARD_VIEW_LABELS[scorecardOnAirView ?? inningsView]}`;
      onAirDetail.textContent = onAirDetailText;
      return;
    }
    if (onAirGraphic) {
      onAir.textContent = `ON AIR: ${LABELS[onAirGraphic]}`;
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

  function setOnAir(kind: keyof typeof LABELS | null): void {
    onAirGraphic = kind;
    if (kind !== 'innings_break') {
      inningsSource = 'break';
      scorecardOnAirView = null;
      scorecardOnAirInningsId = null;
    }
    onAirDetailText = kind ? detailForKind(kind) : '';
    const inningsStandalone =
      kind === 'innings_break' && inningsSource === 'scorecard';
    paintOnAirDock();
    syncInningsTabs();
    syncScorecardViewRows();

    for (const k of OPERATOR_KINDS) {
      const section = document.querySelector<HTMLElement>(
        `.control-card[data-graphic="${k}"]`,
      );
      if (!section) {
        continue;
      }
      const live =
        k === 'innings_break'
          ? kind === k && inningsSource === 'break'
          : kind === k;
      section.classList.toggle('is-on-air', live);
      const badge = section.querySelector<HTMLElement>('.on-air-badge');
      if (badge) {
        badge.hidden = !live;
      }
    }

    const scorecardSec = el<HTMLElement>('sec-scorecard-views');
    scorecardSec.classList.toggle('is-on-air', inningsStandalone);
    const scorecardBadge = scorecardSec.querySelector<HTMLElement>('.on-air-badge');
    if (scorecardBadge) {
      scorecardBadge.hidden = !inningsStandalone;
    }
  }

  function refreshPreviews(): void {
    const toss = previewToss();
    el<HTMLParagraphElement>('preview-toss').textContent =
      toss ?? 'Toss not recorded yet';
    setEnabled(btnShowToss, toss != null);

    const tossResult = previewTossResult();
    el<HTMLParagraphElement>('preview-toss-result').textContent =
      tossResult ?? 'Toss not recorded yet';
    setEnabled(btnShowTossResult, tossResult != null);

    const chase = previewChase();
    el<HTMLParagraphElement>('preview-chase').textContent =
      chase ?? 'No chase yet (2nd innings / target required)';
    setEnabled(btnShowChase, chase != null);

    const ps = previewPartnership();
    el<HTMLParagraphElement>('preview-partnership').textContent =
      ps ?? 'No current partnership';
    setEnabled(btnShowPartnership, ps != null);

    const fow = previewFow();
    el<HTMLParagraphElement>('preview-fow').textContent = fow ?? 'No wicket yet';
    setEnabled(btnShowFow, fow != null);

    setEnabled(btnShowBatsman, previewBatsman() != null);
    setEnabled(btnShowBowler, previewBowler() != null);

    void refreshBowlerCareerPreview();
    void refreshBatsmanCareerPreview();

    const inn = previewInnings();
    el<HTMLParagraphElement>('preview-innings').textContent =
      inn ?? 'Waiting for innings…';
    setEnabled(btnShowInnings, inn != null);
    populateScorecardTeamPicks();

    if (
      onAirGraphic &&
      onAirGraphic !== 'bowler_career' &&
      onAirGraphic !== 'batsman_career'
    ) {
      onAirDetailText = detailForKind(onAirGraphic);
      onAirDetail.textContent = onAirDetailText;
    }
  }

  async function refreshBowlerCareerPreview(): Promise<void> {
    const playerId = resolveBowlerCareerId();
    const token = ++bowlerCareerPreviewToken;
    if (!playerId) {
      bowlerCareerDetail = '';
      setEnabled(btnShowBowlerCareer, false);
      return;
    }
    bowlerCareerDetail = '';
    setEnabled(btnShowBowlerCareer, false);
    const stats = await loadCareerStats(playerId);
    if (token !== bowlerCareerPreviewToken) {
      return;
    }
    if (!stats || !hasBowlerCareerStats(stats)) {
      bowlerCareerDetail = '';
      setEnabled(btnShowBowlerCareer, false);
      return;
    }
    bowlerCareerDetail = `${nameOf(playerId)} · ${formatCareerPreview(stats)}`;
    setEnabled(btnShowBowlerCareer, true);
    if (onAirGraphic === 'bowler_career') {
      onAirDetailText = bowlerCareerDetail;
      onAirDetail.textContent = onAirDetailText;
    }
  }

  async function refreshBatsmanCareerPreview(): Promise<void> {
    const playerId = resolveBatsmanCareerId();
    const token = ++batsmanCareerPreviewToken;
    if (!playerId) {
      batsmanCareerDetail = '';
      setEnabled(btnShowBatsmanCareer, false);
      return;
    }
    batsmanCareerDetail = '';
    setEnabled(btnShowBatsmanCareer, false);
    const stats = await loadCareerStats(playerId);
    if (token !== batsmanCareerPreviewToken) {
      return;
    }
    if (!stats || !hasBatsmanCareerStats(stats)) {
      batsmanCareerDetail = '';
      setEnabled(btnShowBatsmanCareer, false);
      return;
    }
    batsmanCareerDetail = `${nameOf(playerId)} · ${formatBatsmanCareerPreview(stats)}`;
    setEnabled(btnShowBatsmanCareer, true);
    if (onAirGraphic === 'batsman_career') {
      onAirDetailText = batsmanCareerDetail;
      onAirDetail.textContent = onAirDetailText;
    }
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
      rebuildPickers(scorecard);
      void refreshBowlerCareerPreview();
      void refreshBatsmanCareerPreview();
    });
  }

  /**
   * Shared team-roster career picker (bowling side or batting side).
   * `preferredPlayerId` is listed first and tagged when present on the roster.
   */
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
      return;
    }
    const roster = rosterByTeamId.get(teamId);
    if (!roster) {
      appendOption(select, '', labels.loading);
      requestTeamRoster(teamId);
      return;
    }
    if (roster.length === 0) {
      appendOption(select, '', labels.empty);
      return;
    }

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

  function rebuildPickers(card: ScorecardResponse | null): void {
    const batPrev = pickBatsman.value;
    const batCareerPrev = pickBatsmanCareer.value;
    const bowlPrev = pickBowler.value;
    const careerPrev = pickBowlerCareer.value;
    const innings = card ? resolveActiveInnings(card) : null;

    const creaseIds = [
      innings?.currentStrikerId,
      innings?.currentNonStrikerId,
    ].filter((id): id is string => Boolean(id));
    const bowlingIds = (innings?.bowlers ?? []).map((b) => b.playerId);

    /** In-play batsman card: crease pair only (striker + non-striker). */
    const fillCreaseBatsmanSelect = (
      select: HTMLSelectElement,
      prev: string,
    ): void => {
      select.innerHTML = '';
      const seen = new Set<string>();
      for (const id of creaseIds) {
        if (seen.has(id)) {
          continue;
        }
        seen.add(id);
        const row = innings?.batters.find((b) => b.playerId === id);
        const figs = row ? `${row.runs} (${row.balls})` : '';
        const role =
          id === innings?.currentStrikerId
            ? 'Striker'
            : id === innings?.currentNonStrikerId
              ? 'Non-striker'
              : null;
        const label = [
          nameOf(id),
          figs,
          role,
        ]
          .filter(Boolean)
          .join(' · ');
        appendOption(select, id, label || nameOf(id));
      }
      if (select.options.length === 0) {
        appendOption(select, '', 'Waiting for batsmen…');
      }
      if ([...select.options].some((o) => o.value === prev && prev !== '')) {
        select.value = prev;
      } else if (innings?.currentStrikerId) {
        select.value = innings.currentStrikerId;
      } else if (select.options[0]) {
        select.selectedIndex = 0;
      }
    };

    fillCreaseBatsmanSelect(pickBatsman, batPrev);
    fillTeamCareerSelect(
      pickBatsmanCareer,
      batCareerPrev,
      innings?.battingTeamId ?? null,
      innings?.currentStrikerId ?? null,
      {
        waiting: 'Waiting for batting team…',
        loading: 'Loading batting team…',
        empty: 'No players on batting team…',
        preferredRole: 'Striker',
      },
    );

    /** In-play bowler card: anyone who has bowled this innings (bowlers[]). */
    const fillInPlayBowlerSelect = (
      select: HTMLSelectElement,
      prev: string,
    ): void => {
      select.innerHTML = '';
      const seen = new Set<string>();
      const orderedIds: string[] = [];
      if (innings?.currentBowlerId) {
        orderedIds.push(innings.currentBowlerId);
      }
      for (const id of bowlingIds) {
        if (!orderedIds.includes(id)) {
          orderedIds.push(id);
        }
      }
      for (const id of orderedIds) {
        if (seen.has(id)) {
          continue;
        }
        seen.add(id);
        const row = innings?.bowlers.find((b) => b.playerId === id);
        const figs = row
          ? `${row.oversText}-${row.runsConceded}-${row.wickets}`
          : '';
        const role =
          id === innings?.currentBowlerId ? 'Current' : null;
        const label = [nameOf(id), figs, role].filter(Boolean).join(' · ');
        appendOption(select, id, label || nameOf(id));
      }
      if (select.options.length === 0) {
        appendOption(select, '', 'No bowlers yet…');
      }
      if ([...select.options].some((o) => o.value === prev && prev !== '')) {
        select.value = prev;
      } else if (innings?.currentBowlerId) {
        select.value = innings.currentBowlerId;
      } else if (select.options[0]) {
        select.selectedIndex = 0;
      }
    };

    fillInPlayBowlerSelect(pickBowler, bowlPrev);
    fillTeamCareerSelect(
      pickBowlerCareer,
      careerPrev,
      innings?.bowlingTeamId ?? null,
      innings?.currentBowlerId ?? null,
      {
        waiting: 'Waiting for bowling team…',
        loading: 'Loading bowling team…',
        empty: 'No players on bowling team…',
        preferredRole: 'Current',
      },
    );
  }

  function applyScorecard(card: ScorecardResponse | null): void {
    scorecard = card;
    rebuildPickers(card);
    refreshPreviews();
  }

  void Promise.all([
    fetchScorecard(apiBase, resolvedMatchId),
    fetchMatchContext(apiBase, resolvedMatchId),
    fetchMatchBallType(apiBase, resolvedMatchId),
  ]).then(([seed, ctx, bt]) => {
    ballType = bt;
    if (ctx) {
      matchCtx = ctx;
    }
    if (seed) {
      applyScorecard(seed);
    } else {
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
            scorecardOnAirInningsId = cmd.payload?.inningsId?.trim() || null;
          } else {
            scorecardOnAirView = null;
            scorecardOnAirInningsId = null;
          }
        }
        setOnAir(cmd.graphic);
      } else if (cmd.action === 'hide' && onAirGraphic === cmd.graphic) {
        setOnAir(null);
      }
    },
  });

  const bindShow = (
    showId: string,
    kind: keyof typeof LABELS,
    payloadFn?: () => GraphicsCommandMessage['payload'] | undefined,
  ): void => {
    el<HTMLButtonElement>(showId).addEventListener('click', () => {
      send({ action: 'show', graphic: kind, payload: payloadFn?.() });
    });
  };

  bindShow('btn-show-partnership', 'partnership');
  bindShow('btn-show-fow', 'fow');
  el<HTMLButtonElement>('btn-show-innings').addEventListener('click', () => {
    inningsSource = 'break';
    send({
      action: 'show',
      graphic: 'innings_break',
      payload: { view: inningsView, source: 'break' },
    });
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
  });

  el<HTMLElement>('sec-scorecard-views').addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const showBtn = target.closest<HTMLButtonElement>('.btn-show-scorecard');
    if (!showBtn) {
      return;
    }
    const view = parseInningsBreakView(showBtn.dataset.scorecardView);
    const pick = document.querySelector<HTMLSelectElement>(
      `.scorecard-team-pick[data-scorecard-view="${view}"]`,
    );
    const inningsId = pick?.value.trim() ?? '';
    if (!inningsId || showBtn.disabled) {
      return;
    }
    inningsSource = 'scorecard';
    scorecardOnAirView = view;
    scorecardOnAirInningsId = inningsId;
    send({
      action: 'show',
      graphic: 'innings_break',
      payload: { view, inningsId, source: 'scorecard' },
    });
  });
  bindShow('btn-show-toss-result', 'toss_result');
  bindShow('btn-show-batsman', 'batsman', () => {
    const playerId = pickBatsman.value.trim();
    return playerId ? { playerId } : undefined;
  });
  bindShow('btn-show-bowler', 'bowler', () => {
    const playerId = pickBowler.value.trim();
    return playerId ? { playerId } : undefined;
  });

  el<HTMLButtonElement>('btn-show-bowler-career').addEventListener('click', () => {
    const playerId = resolveBowlerCareerId();
    if (!playerId || btnShowBowlerCareer.disabled) {
      return;
    }
    send({
      action: 'show',
      graphic: 'bowler_career',
      payload: { playerId },
    });
  });

  el<HTMLButtonElement>('btn-show-batsman-career').addEventListener('click', () => {
    const playerId = resolveBatsmanCareerId();
    if (!playerId || btnShowBatsmanCareer.disabled) {
      return;
    }
    send({
      action: 'show',
      graphic: 'batsman_career',
      payload: { playerId },
    });
  });

  el<HTMLButtonElement>('btn-show-toss').addEventListener('click', () => {
    send({ action: 'show', graphic: 'toss' });
  });

  el<HTMLButtonElement>('btn-show-chase').addEventListener('click', () => {
    send({ action: 'show', graphic: 'chase' });
  });

  pickBatsman.addEventListener('change', () => refreshPreviews());
  pickBowler.addEventListener('change', () => refreshPreviews());
  pickBowlerCareer.addEventListener('change', () => {
    void refreshBowlerCareerPreview();
  });
  pickBatsmanCareer.addEventListener('change', () => {
    void refreshBatsmanCareerPreview();
  });

  btnClearAir.addEventListener('click', () => {
    if (!anythingLive()) {
      return;
    }
    send({ action: 'hide_all' });
  });
}

start();
