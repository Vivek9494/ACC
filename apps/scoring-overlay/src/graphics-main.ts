import './graphics.css';
import { mountBatsmanCareerCard } from './batsman-career-card';
import {
  fetchBroadcastPlayerStats,
  fetchMatchBallType,
  fetchScorecard,
} from './broadcast-fetch';
import {
  battingTeamLabel,
  deriveBatterDotBalls,
  formatBatterInningsScore,
  formatDismissalShort,
  formatStat,
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

/** Strip page owns toss / chase / bowler_career — not rendered here. */
type StripOwnedKind = 'toss' | 'chase' | 'bowler_career';
type OverlayKind = Exclude<GraphicsKind, StripOwnedKind>;

const GRAPHIC_IDS: Record<OverlayKind, string> = {
  partnership: 'g-partnership',
  fow: 'g-fow',
  batsman: 'g-batsman',
  batsman_career: 'g-batsman-career',
  bowler: 'g-bowler',
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
let activeKind: OverlayKind | null = null;
let activePlayerId: string | null = null;
let careerToken = 0;
const careerCache = new Map<string, BroadcastPlayerStatsView | null>();
const batsmanCareer = mountBatsmanCareerCard(el('g-batsman-career'));

function graphicNode(kind: OverlayKind): HTMLElement {
  return el(GRAPHIC_IDS[kind]);
}

function isStripOwned(kind: GraphicsKind): kind is StripOwnedKind {
  return kind === 'toss' || kind === 'chase' || kind === 'bowler_career';
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
  batsmanCareer.hide();
  for (const kind of Object.keys(GRAPHIC_IDS) as OverlayKind[]) {
    if (kind === 'batsman_career') {
      continue;
    }
    hideNode(graphicNode(kind));
  }
}

function hideGraphic(kind: GraphicsKind): void {
  if (isStripOwned(kind)) {
    return;
  }
  if (activeKind === kind) {
    activeKind = null;
    activePlayerId = null;
  }
  if (kind === 'batsman_career') {
    batsmanCareer.hide();
    return;
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
  try {
    if (!scorecard) {
      return;
    }
    const innings = resolveActiveInnings(scorecard);
    const batter = innings?.batters.find((b) => b.playerId === playerId);
    const full = playerName(scorecard.display, playerId);
    setText('bat-name', full === '—' ? '—' : full);
    setText('bat-match', formatBatterInningsScore(batter));
    setText('bat-dots', String(deriveBatterDotBalls(batter)));
    setText('bat-twos', String(batter?.twos ?? 0));
    setText('bat-fours', String(batter?.fours ?? 0));
    setText('bat-sixes', String(batter?.sixes ?? 0));
    const sr =
      batter && Number.isFinite(batter.strikeRate)
        ? batter.strikeRate
        : batter && batter.balls > 0
          ? (batter.runs / batter.balls) * 100
          : 0;
    setText('bat-sr', formatStat(sr, 2));
  } catch (err) {
    console.warn('[graphics] fill batsman failed', err);
  }
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

function showBatsman(playerId: string): void {
  fillBatsmanMatch(playerId);
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

async function showBatsmanCareer(playerId: string): Promise<void> {
  try {
    const { apiBase } = queryApiAndMatch();
    const placeholderName = scorecard
      ? playerName(scorecard.display, playerId)
      : undefined;
    const ok = await batsmanCareer.show(playerId, {
      apiBase,
      ballType,
      placeholderName,
    });
    if (!ok && activeKind === 'batsman_career' && activePlayerId === playerId) {
      activeKind = null;
      activePlayerId = null;
    }
  } catch (err) {
    console.warn('[graphics] batsman career failed', err);
    batsmanCareer.hide();
    if (activeKind === 'batsman_career') {
      activeKind = null;
      activePlayerId = null;
    }
  }
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
    case 'batsman_career':
      break;
    default:
      break;
  }
}

async function showGraphic(
  kind: GraphicsKind,
  payload?: GraphicsCommandMessage['payload'],
): Promise<void> {
  // Strip-page only — score strip page owns these.
  if (isStripOwned(kind)) {
    return;
  }

  if (kind === 'hello') {
    for (const k of Object.keys(GRAPHIC_IDS) as OverlayKind[]) {
      if (k !== 'hello') {
        if (k === 'batsman_career') {
          batsmanCareer.hide();
        } else {
          hideNode(graphicNode(k));
        }
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
  } else if (kind === 'batsman_career') {
    playerId = resolveBatsmanId(payload?.playerId);
    ok = playerId != null;
  }

  if (!ok) {
    // Nothing useful to put on air — stay silent (never show errors).
    return;
  }

  for (const k of Object.keys(GRAPHIC_IDS) as OverlayKind[]) {
    if (k === kind) {
      continue;
    }
    if (k === 'batsman_career') {
      batsmanCareer.hide();
    } else {
      hideNode(graphicNode(k));
    }
  }

  activeKind = kind;
  activePlayerId = playerId;

  if (kind === 'batsman' && playerId) {
    showBatsman(playerId);
    showNode(graphicNode(kind));
  } else if (kind === 'bowler' && playerId) {
    void showBowler(playerId);
    showNode(graphicNode(kind));
  } else if (kind === 'batsman_career' && playerId) {
    void showBatsmanCareer(playerId);
  } else {
    showNode(graphicNode(kind));
  }
}

function applyCommand(cmd: GraphicsCommandMessage): void {
  try {
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
      void showGraphic(cmd.graphic, cmd.payload).catch((err: unknown) => {
        console.warn('[graphics] show failed', err);
        try {
          if (cmd.graphic === 'batsman_career') {
            batsmanCareer.hide();
          }
        } catch {
          /* ignore */
        }
      });
    }
  } catch (err) {
    console.warn('[graphics] command handler failed', err);
    try {
      batsmanCareer.hide();
    } catch {
      /* ignore */
    }
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
