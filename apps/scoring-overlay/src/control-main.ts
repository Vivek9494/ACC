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
  MatchContext,
  ScorecardResponse,
} from './types';
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
  let inningsView: 'batting' | 'bowling' = 'batting';
  let onAirDetailText = '';
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
      case 'bowler_career': {
        const line = el<HTMLParagraphElement>('preview-bowler-career').textContent?.trim();
        if (
          !line ||
          line.includes('Loading') ||
          line.includes('No career') ||
          line === '—'
        ) {
          return '';
        }
        return line;
      }
      case 'batsman_career': {
        const line = el<HTMLParagraphElement>('preview-batsman-career').textContent?.trim();
        if (
          !line ||
          line.includes('Loading') ||
          line.includes('No career') ||
          line === '—'
        ) {
          return '';
        }
        return line;
      }
      case 'innings_break':
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
    setStripSection('toss', mode === 'toss');
    setStripSection('chase', mode === 'chase');
  }

  function syncInningsTabs(): void {
    const tabs = el<HTMLElement>('innings-tabs');
    const onAir = onAirGraphic === 'innings_break';
    tabs.hidden = !onAir;
    el<HTMLButtonElement>('btn-innings-batting').classList.toggle(
      'is-active-tab',
      inningsView === 'batting',
    );
    el<HTMLButtonElement>('btn-innings-bowling').classList.toggle(
      'is-active-tab',
      inningsView === 'bowling',
    );
  }

  function setOnAir(kind: keyof typeof LABELS | null): void {
    onAirGraphic = kind;
    onAirDetailText = kind ? detailForKind(kind) : '';
    onAir.textContent = kind ? LABELS[kind] : 'None';
    onAirDetail.textContent = onAirDetailText;
    onAirDock.classList.toggle('is-live', kind != null);
    setEnabled(btnClearAir, kind != null);
    syncInningsTabs();

    for (const k of OPERATOR_KINDS) {
      const section = document.querySelector<HTMLElement>(
        `.control-section[data-graphic="${k}"]`,
      );
      if (!section) {
        continue;
      }
      const live = kind === k;
      section.classList.toggle('is-on-air', live);
      const badge = section.querySelector<HTMLElement>('.on-air-badge');
      if (badge) {
        badge.hidden = !live;
      }
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

    const bat = previewBatsman();
    el<HTMLParagraphElement>('preview-batsman').textContent =
      bat ?? 'Select a batsman (or wait for striker)';
    setEnabled(btnShowBatsman, bat != null);

    const bowl = previewBowler();
    el<HTMLParagraphElement>('preview-bowler').textContent =
      bowl ?? 'Select a bowler (or wait for current bowler)';
    setEnabled(btnShowBowler, bowl != null);

    void refreshBowlerCareerPreview();
    void refreshBatsmanCareerPreview();

    const inn = previewInnings();
    el<HTMLParagraphElement>('preview-innings').textContent =
      inn ?? 'Waiting for innings…';
    setEnabled(btnShowInnings, inn != null);

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
    const preview = el<HTMLParagraphElement>('preview-bowler-career');
    const token = ++bowlerCareerPreviewToken;
    if (!playerId) {
      preview.textContent = 'Select a bowler (or wait for current bowler)';
      setEnabled(btnShowBowlerCareer, false);
      return;
    }
    preview.textContent = `${nameOf(playerId)} · Loading career…`;
    setEnabled(btnShowBowlerCareer, false);
    const stats = await loadCareerStats(playerId);
    if (token !== bowlerCareerPreviewToken) {
      return;
    }
    if (!stats || !hasBowlerCareerStats(stats)) {
      preview.textContent = `${nameOf(playerId)} · No career bowling stats for ${ballType}`;
      setEnabled(btnShowBowlerCareer, false);
      return;
    }
    preview.textContent = `${nameOf(playerId)} · ${formatCareerPreview(stats)}`;
    setEnabled(btnShowBowlerCareer, true);
    if (onAirGraphic === 'bowler_career') {
      onAirDetailText = preview.textContent;
      onAirDetail.textContent = onAirDetailText;
    }
  }

  async function refreshBatsmanCareerPreview(): Promise<void> {
    const playerId = resolveBatsmanCareerId();
    const preview = el<HTMLParagraphElement>('preview-batsman-career');
    const token = ++batsmanCareerPreviewToken;
    if (!playerId) {
      preview.textContent = 'Select a batsman (or wait for striker)';
      setEnabled(btnShowBatsmanCareer, false);
      return;
    }
    preview.textContent = `${nameOf(playerId)} · Loading career…`;
    setEnabled(btnShowBatsmanCareer, false);
    const stats = await loadCareerStats(playerId);
    if (token !== batsmanCareerPreviewToken) {
      return;
    }
    if (!stats || !hasBatsmanCareerStats(stats)) {
      preview.textContent = `${nameOf(playerId)} · No career batting stats for ${ballType}`;
      setEnabled(btnShowBatsmanCareer, false);
      return;
    }
    preview.textContent = `${nameOf(playerId)} · ${formatBatsmanCareerPreview(stats)}`;
    setEnabled(btnShowBatsmanCareer, true);
    if (onAirGraphic === 'batsman_career') {
      onAirDetailText = preview.textContent;
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
        } else if (cmd.action === 'hide') {
          setStripSection('toss', false);
        }
        return;
      }
      if (cmd.graphic === 'chase') {
        if (cmd.action === 'show') {
          setStripMode('chase');
        } else if (cmd.action === 'hide') {
          setStripSection('chase', false);
        }
        return;
      }
      if (cmd.action === 'show') {
        if (cmd.graphic === 'innings_break') {
          inningsView = cmd.payload?.view === 'bowling' ? 'bowling' : 'batting';
        }
        setOnAir(cmd.graphic);
      } else if (cmd.action === 'hide' && onAirGraphic === cmd.graphic) {
        setOnAir(null);
      }
    },
  });

  const bind = (
    showId: string,
    hideId: string,
    kind: keyof typeof LABELS,
    payloadFn?: () => GraphicsCommandMessage['payload'] | undefined,
  ): void => {
    el<HTMLButtonElement>(showId).addEventListener('click', () => {
      send({ action: 'show', graphic: kind, payload: payloadFn?.() });
    });
    el<HTMLButtonElement>(hideId).addEventListener('click', () => {
      send({ action: 'hide', graphic: kind });
    });
  };

  bind('btn-show-partnership', 'btn-hide-partnership', 'partnership');
  bind('btn-show-fow', 'btn-hide-fow', 'fow');
  bind('btn-show-innings', 'btn-hide-innings', 'innings_break', () => ({
    view: inningsView,
  }));

  el<HTMLButtonElement>('btn-innings-batting').addEventListener('click', () => {
    inningsView = 'batting';
    syncInningsTabs();
    send({
      action: 'show',
      graphic: 'innings_break',
      payload: { view: 'batting' },
    });
  });
  el<HTMLButtonElement>('btn-innings-bowling').addEventListener('click', () => {
    inningsView = 'bowling';
    syncInningsTabs();
    send({
      action: 'show',
      graphic: 'innings_break',
      payload: { view: 'bowling' },
    });
  });
  bind('btn-show-toss-result', 'btn-hide-toss-result', 'toss_result');
  bind('btn-show-batsman', 'btn-hide-batsman', 'batsman', () => {
    const playerId = pickBatsman.value.trim();
    return playerId ? { playerId } : undefined;
  });
  bind('btn-show-bowler', 'btn-hide-bowler', 'bowler', () => {
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
  el<HTMLButtonElement>('btn-hide-bowler-career').addEventListener('click', () => {
    send({ action: 'hide', graphic: 'bowler_career' });
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
  el<HTMLButtonElement>('btn-hide-batsman-career').addEventListener('click', () => {
    send({ action: 'hide', graphic: 'batsman_career' });
  });

  el<HTMLButtonElement>('btn-show-toss').addEventListener('click', () => {
    send({ action: 'show', graphic: 'toss' });
  });
  el<HTMLButtonElement>('btn-hide-toss').addEventListener('click', () => {
    send({ action: 'hide', graphic: 'toss' });
  });

  el<HTMLButtonElement>('btn-show-chase').addEventListener('click', () => {
    send({ action: 'show', graphic: 'chase' });
  });
  el<HTMLButtonElement>('btn-hide-chase').addEventListener('click', () => {
    send({ action: 'hide', graphic: 'chase' });
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
    if (onAirGraphic) {
      send({ action: 'hide', graphic: onAirGraphic });
    } else {
      send({ action: 'hide_all' });
    }
  });

  el<HTMLButtonElement>('btn-hide-all').addEventListener('click', () => {
    send({ action: 'hide_all' });
  });
}

start();
