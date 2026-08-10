import './graphics.css';
import {
  fetchBroadcastPlayerStats,
  fetchMatchBallType,
  fetchScorecard,
} from './broadcast-fetch';
import {
  battingTeamLabel,
  formatDismissalShort,
  formatStat,
  hasBowlerCareerStats,
  initialsFromName,
  isUuid,
  latestFallOfWicket,
  partnershipBatterRuns,
  playerName,
  resolveActiveInnings,
  shortName,
  wicketOrdinal,
} from './graphics-format';
import {
  connectLiveSocket,
  queryApiAndMatch,
  type GraphicsCommandMessage,
  type GraphicsKind,
} from './live-client';
import type {
  BallType,
  BroadcastPlayerStatsView,
  ScorecardResponse,
} from './types';

const ANIM_MS = 280;

const GRAPHIC_IDS: Record<Exclude<GraphicsKind, 'toss' | 'chase'>, string> = {
  partnership: 'g-partnership',
  fow: 'g-fow',
  batsman: 'g-batsman',
  bowler: 'g-bowler',
  bowler_career: 'g-bowler-career',
  innings_break: 'g-innings',
  hello: 'g-hello',
};

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) {
    throw new Error(`Missing #${id}`);
  }
  return node as T;
}

function setText(id: string, text: string): void {
  const node = el(id);
  if (node.textContent !== text) {
    node.textContent = text;
  }
}

function setAvatar(
  initialsId: string,
  imgId: string,
  name: string,
  photoUrl: string | null,
): void {
  const initials = el<HTMLSpanElement>(initialsId);
  const img = el<HTMLImageElement>(imgId);
  initials.textContent = initialsFromName(name);
  if (photoUrl) {
    img.onload = () => {
      img.hidden = false;
      initials.hidden = true;
    };
    img.onerror = () => {
      img.hidden = true;
      initials.hidden = false;
      img.removeAttribute('src');
    };
    if (img.getAttribute('src') !== photoUrl) {
      img.hidden = true;
      initials.hidden = false;
      img.src = photoUrl;
    }
  } else {
    img.hidden = true;
    initials.hidden = false;
    img.removeAttribute('src');
  }
}

let scorecard: ScorecardResponse | null = null;
let ballType: BallType = 'TENNIS';
let activeKind: Exclude<GraphicsKind, 'toss' | 'chase'> | null = null;
let activePlayerId: string | null = null;
let careerToken = 0;
const careerCache = new Map<string, BroadcastPlayerStatsView | null>();

function graphicNode(kind: Exclude<GraphicsKind, 'toss' | 'chase'>): HTMLElement {
  return el(GRAPHIC_IDS[kind]);
}

function hideNode(node: HTMLElement): void {
  node.classList.remove('is-visible');
  window.setTimeout(() => {
    if (!node.classList.contains('is-visible')) {
      node.hidden = true;
    }
  }, ANIM_MS);
}

function showNode(node: HTMLElement): void {
  node.hidden = false;
  requestAnimationFrame(() => node.classList.add('is-visible'));
}

function hideAllGraphics(): void {
  activeKind = null;
  activePlayerId = null;
  for (const kind of Object.keys(GRAPHIC_IDS) as Array<
    Exclude<GraphicsKind, 'toss' | 'chase'>
  >) {
    hideNode(graphicNode(kind));
  }
}

function hideGraphic(kind: GraphicsKind): void {
  if (kind === 'toss' || kind === 'chase') {
    return;
  }
  if (activeKind === kind) {
    activeKind = null;
    activePlayerId = null;
  }
  hideNode(graphicNode(kind));
}

function nameOf(id: string | null): string {
  if (!scorecard) {
    return '—';
  }
  return shortName(playerName(scorecard.display, id));
}

function fillPartnership(): boolean {
  if (!scorecard) {
    return false;
  }
  const innings = resolveActiveInnings(scorecard);
  const ps = innings?.partnership ?? null;
  if (!ps || ps.batterIds.length < 2) {
    return false;
  }
  const [aId, bId] = ps.batterIds;
  setText('ps-total', `${ps.runs} (${ps.balls})`);
  setText('ps-a-name', nameOf(aId ?? null));
  setText('ps-b-name', nameOf(bId ?? null));
  setText('ps-a-runs', String(partnershipBatterRuns(ps, aId ?? '')));
  setText('ps-b-runs', String(partnershipBatterRuns(ps, bId ?? '')));
  return true;
}

function fillFow(): boolean {
  if (!scorecard) {
    return false;
  }
  const innings = resolveActiveInnings(scorecard);
  const fow = latestFallOfWicket(innings);
  if (!fow || !innings) {
    return false;
  }
  const batter = innings.batters.find((b) => b.playerId === fow.playerId);
  const fullName = playerName(scorecard.display, fow.playerId);
  setText(
    'fow-headline',
    `${wicketOrdinal(fow.wicketNumber)} WICKET · ${fow.wicketNumber}-${fow.teamRuns}`,
  );
  setText('fow-name', shortName(fullName));
  setText(
    'fow-dismissal',
    batter
      ? formatDismissalShort(batter, (id) => nameOf(id))
      : '—',
  );
  const figures = batter ? `${batter.runs} (${batter.balls})` : '';
  setText(
    'fow-detail',
    [figures, `${fow.oversText} ov`].filter(Boolean).join(' · '),
  );
  return true;
}

function fillInningsBreak(): boolean {
  if (!scorecard || scorecard.innings.length === 0) {
    return false;
  }
  const inn1 = scorecard.innings[0];
  const inn2 = scorecard.innings[1];
  if (!inn1) {
    return false;
  }

  setText('inn1-team', battingTeamLabel(scorecard, inn1));
  setText('inn1-score', `${inn1.runs}/${inn1.wickets} (${inn1.oversText})`);

  const inn2Team = el<HTMLParagraphElement>('inn2-team');
  const inn2Score = el<HTMLParagraphElement>('inn2-score');
  if (inn2) {
    inn2Team.hidden = false;
    inn2Score.hidden = false;
    setText('inn2-team', battingTeamLabel(scorecard, inn2));
    setText('inn2-score', `${inn2.runs}/${inn2.wickets} (${inn2.oversText})`);
  } else {
    inn2Team.hidden = true;
    inn2Score.hidden = true;
  }

  const targetEl = el<HTMLParagraphElement>('inn-target');
  const target = scorecard.effectiveTarget;
  if (target != null && target > 0) {
    targetEl.hidden = false;
    targetEl.textContent = `Target ${target}`;
  } else {
    targetEl.hidden = true;
    targetEl.textContent = '';
  }
  return true;
}

async function loadCareer(
  playerId: string,
): Promise<BroadcastPlayerStatsView | null> {
  if (!isUuid(playerId)) {
    return null;
  }
  const key = `${playerId}:${ballType}`;
  if (careerCache.has(key)) {
    return careerCache.get(key) ?? null;
  }
  const { apiBase } = queryApiAndMatch();
  const stats = await fetchBroadcastPlayerStats(apiBase, playerId, ballType);
  careerCache.set(key, stats);
  return stats;
}

function resolveBatsmanId(preferred: string | null | undefined): string | null {
  if (preferred) {
    return preferred;
  }
  if (!scorecard) {
    return null;
  }
  const innings = resolveActiveInnings(scorecard);
  return innings?.currentStrikerId ?? null;
}

function resolveBowlerId(preferred: string | null | undefined): string | null {
  if (preferred) {
    return preferred;
  }
  if (!scorecard) {
    return null;
  }
  const innings = resolveActiveInnings(scorecard);
  return innings?.currentBowlerId ?? null;
}

function fillBatsmanMatch(playerId: string): void {
  if (!scorecard) {
    return;
  }
  const innings = resolveActiveInnings(scorecard);
  const batter = innings?.batters.find((b) => b.playerId === playerId);
  const full = playerName(scorecard.display, playerId);
  setText('bat-name', shortName(full));
  if (batter) {
    const onStrike = innings?.currentStrikerId === playerId && !batter.isOut;
    setText(
      'bat-match',
      `${onStrike ? `${batter.runs}*` : batter.runs} (${batter.balls})`,
    );
  } else {
    setText('bat-match', '0 (0)');
  }
  setAvatar('bat-initials', 'bat-img', full, null);
}

function fillBowlerMatch(playerId: string): void {
  if (!scorecard) {
    return;
  }
  const innings = resolveActiveInnings(scorecard);
  const bowler = innings?.bowlers.find((b) => b.playerId === playerId);
  const full = playerName(scorecard.display, playerId);
  setText('bowl-name', shortName(full));
  if (bowler) {
    setText(
      'bowl-match',
      `${bowler.oversText}-${bowler.runsConceded}-${bowler.wickets}`,
    );
  } else {
    setText('bowl-match', '0-0-0');
  }
  setAvatar('bowl-initials', 'bowl-img', full, null);
}

function applyCareerToBatsman(stats: BroadcastPlayerStatsView | null): void {
  if (stats) {
    setText('bat-avg', formatStat(stats.average));
    setText('bat-sr', formatStat(stats.strikeRate));
    setText('bat-hs', stats.highestScore?.trim() || '—');
    setText('bat-mat', String(stats.matches));
    const full = `${stats.firstName} ${stats.lastName}`.trim();
    setAvatar('bat-initials', 'bat-img', full || '—', stats.profilePhotoUrl);
  } else {
    setText('bat-avg', '—');
    setText('bat-sr', '—');
    setText('bat-hs', '—');
    setText('bat-mat', '—');
  }
}

function applyCareerToBowler(stats: BroadcastPlayerStatsView | null): void {
  if (stats) {
    setText('bowl-wkts', String(stats.wickets));
    setText('bowl-best', stats.bestBowling?.trim() || '—');
    setText('bowl-mat', String(stats.matches));
    setText('bowl-runs', String(stats.runs));
    const full = `${stats.firstName} ${stats.lastName}`.trim();
    setAvatar('bowl-initials', 'bowl-img', full || '—', stats.profilePhotoUrl);
  } else {
    setText('bowl-wkts', '—');
    setText('bowl-best', '—');
    setText('bowl-mat', '—');
    setText('bowl-runs', '—');
  }
}

async function showBatsman(playerId: string): Promise<void> {
  fillBatsmanMatch(playerId);
  applyCareerToBatsman(null);
  const token = ++careerToken;
  const stats = await loadCareer(playerId);
  if (token !== careerToken || activeKind !== 'batsman' || activePlayerId !== playerId) {
    return;
  }
  applyCareerToBatsman(stats);
}

async function showBowler(playerId: string): Promise<void> {
  fillBowlerMatch(playerId);
  applyCareerToBowler(null);
  const token = ++careerToken;
  const stats = await loadCareer(playerId);
  if (token !== careerToken || activeKind !== 'bowler' || activePlayerId !== playerId) {
    return;
  }
  applyCareerToBowler(stats);
}

function fillBowlerCareer(
  playerId: string,
  stats: BroadcastPlayerStatsView | null,
): void {
  const full = scorecard
    ? playerName(scorecard.display, playerId)
    : stats
      ? `${stats.firstName} ${stats.lastName}`.trim()
      : '—';
  setText('bc-name', shortName(full));
  if (!stats || !hasBowlerCareerStats(stats)) {
    setText('bc-matches', '—');
    setText('bc-wickets', '—');
    setText('bc-avg', '—');
    setText('bc-econ', '—');
    setText('bc-best', '—');
    return;
  }
  setText('bc-matches', String(stats.matches));
  setText('bc-wickets', String(stats.wickets));
  setText('bc-avg', formatStat(stats.bowlingAverage, 2));
  setText('bc-econ', formatStat(stats.economy, 2));
  setText('bc-best', stats.bestBowling?.trim() || '—');
}

async function showBowlerCareer(playerId: string): Promise<boolean> {
  const stats = await loadCareer(playerId);
  if (!hasBowlerCareerStats(stats)) {
    return false;
  }
  fillBowlerCareer(playerId, stats);
  return true;
}

function refreshActiveContent(): void {
  if (!activeKind) {
    return;
  }
  switch (activeKind) {
    case 'partnership':
      if (!fillPartnership()) {
        hideGraphic('partnership');
      }
      break;
    case 'fow':
      if (!fillFow()) {
        hideGraphic('fow');
      }
      break;
    case 'innings_break':
      if (!fillInningsBreak()) {
        hideGraphic('innings_break');
      }
      break;
    case 'batsman':
      if (activePlayerId) {
        fillBatsmanMatch(activePlayerId);
      }
      break;
    case 'bowler':
      if (activePlayerId) {
        fillBowlerMatch(activePlayerId);
      }
      break;
    case 'bowler_career':
      // Career figures are not live-scorecard derived; keep last painted frame.
      break;
    default:
      break;
  }
}

async function showGraphic(
  kind: GraphicsKind,
  payload?: GraphicsCommandMessage['payload'],
): Promise<void> {
  // Strip-only — score strip listens; do not touch full-screen cards.
  if (kind === 'toss' || kind === 'chase') {
    return;
  }

  if (kind === 'hello') {
    for (const k of Object.keys(GRAPHIC_IDS) as Array<
      Exclude<GraphicsKind, 'toss' | 'chase'>
    >) {
      if (k !== 'hello') {
        hideNode(graphicNode(k));
      }
    }
    activeKind = 'hello';
    activePlayerId = null;
    showNode(graphicNode('hello'));
    return;
  }

  let ok = false;
  let playerId: string | null = null;

  if (kind === 'partnership') {
    ok = fillPartnership();
  } else if (kind === 'fow') {
    ok = fillFow();
  } else if (kind === 'innings_break') {
    ok = fillInningsBreak();
  } else if (kind === 'batsman') {
    playerId = resolveBatsmanId(payload?.playerId);
    ok = playerId != null;
  } else if (kind === 'bowler') {
    playerId = resolveBowlerId(payload?.playerId);
    ok = playerId != null;
  } else if (kind === 'bowler_career') {
    playerId = resolveBowlerId(payload?.playerId);
    if (playerId) {
      ok = await showBowlerCareer(playerId);
    }
  }

  if (!ok) {
    // Nothing useful to put on air — stay silent (never show errors).
    return;
  }

  for (const k of Object.keys(GRAPHIC_IDS) as Array<
    Exclude<GraphicsKind, 'toss' | 'chase'>
  >) {
    if (k !== kind) {
      hideNode(graphicNode(k));
    }
  }

  activeKind = kind;
  activePlayerId = playerId;

  if (kind === 'batsman' && playerId) {
    void showBatsman(playerId);
  } else if (kind === 'bowler' && playerId) {
    void showBowler(playerId);
  }

  showNode(graphicNode(kind));
}

function applyCommand(cmd: GraphicsCommandMessage): void {
  if (cmd.action === 'hide_all') {
    hideAllGraphics();
    return;
  }
  if (!cmd.graphic) {
    return;
  }
  if (cmd.action === 'hide') {
    hideGraphic(cmd.graphic);
    return;
  }
  if (cmd.action === 'show') {
    void showGraphic(cmd.graphic, cmd.payload);
  }
}

function start(): void {
  const { matchId, apiBase } = queryApiAndMatch();
  const status = el<HTMLDivElement>('status');

  if (!matchId) {
    status.hidden = false;
    status.textContent = 'Add ?matchId=…';
    return;
  }

  status.hidden = false;
  status.textContent = `Connecting to ${apiBase}…`;

  void (async () => {
    const [seed, bt] = await Promise.all([
      fetchScorecard(apiBase, matchId),
      fetchMatchBallType(apiBase, matchId),
    ]);
    if (seed) {
      scorecard = seed;
    }
    ballType = bt;
  })();

  connectLiveSocket(apiBase, matchId, {
    onStatus: (s) => {
      if (s === 'live') {
        status.hidden = true;
        return;
      }
      status.hidden = false;
      status.textContent =
        s === 'connecting' ? `Connecting to ${apiBase}…` : `Reconnecting (${apiBase})…`;
    },
    onLiveState: (state) => {
      scorecard = state;
      refreshActiveContent();
    },
    onGraphicsCommand: applyCommand,
  });
}

start();
