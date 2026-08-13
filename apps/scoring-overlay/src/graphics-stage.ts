/**
 * Shared full-screen graphics stage for graphics.html and the root strip page.
 * All queries are scoped to the stage root so strip IDs (e.g. bowl-initials) never clash.
 */

import './graphics.css';
import { ensureMatchContext } from './broadcast-fetch';
import { mountBatsmanCareerCard } from './batsman-career-card';
import { mountInningsScorecard } from './innings-scorecard';
import {
  deriveBatterDotBalls,
  formatBatterInningsScore,
  formatDismissalShort,
  formatStat,
  latestFallOfWicket,
  partnershipBatterRuns,
  playerName,
  resolveActiveInnings,
  resolveBattingSide,
  resolveInningsBreakInnings,
  shortName,
} from './graphics-format';
import type { GraphicsCommandMessage, GraphicsKind } from './live-client';
import {
  formatTossResultLine,
  mountTossResultCard,
} from './toss-result-card';
import type {
  BallType,
  InningsBreakView,
  MatchContext,
  ScorecardResponse,
} from './types';
import { parseInningsBreakView } from './types';

const ANIM_MS = 280;

/** Strip page owns these — stage ignores them. */
export type StripOwnedKind = 'toss' | 'chase' | 'bowler_career';
export type OverlayKind = Exclude<GraphicsKind, StripOwnedKind>;

const GRAPHIC_IDS: Record<OverlayKind, string> = {
  partnership: 'g-partnership',
  fow: 'g-fow',
  batsman: 'g-batsman',
  batsman_career: 'g-batsman-career',
  bowler: 'g-bowler',
  innings_break: 'g-innings',
  toss_result: 'g-toss-result',
  hello: 'g-hello',
};

export function isStripOwnedKind(kind: GraphicsKind): kind is StripOwnedKind {
  return kind === 'toss' || kind === 'chase' || kind === 'bowler_career';
}

/** Markup for panels inside the stage (IDs are unique within the stage root). */
export function buildGraphicsStageMarkup(): string {
  return `
      <div id="g-partnership" class="graphic panel panel-wide" hidden>
        <div class="panel-accent"></div>
        <div class="panel-body">
          <p class="eyebrow">Partnership</p>
          <p id="ps-total" class="hero-stat">0 (0)</p>
          <div class="pair-row">
            <div class="pair-batter">
              <p id="ps-a-name" class="pair-name">—</p>
              <p id="ps-a-runs" class="pair-runs">0</p>
            </div>
            <div class="pair-sep" aria-hidden="true">&</div>
            <div class="pair-batter">
              <p id="ps-b-name" class="pair-name">—</p>
              <p id="ps-b-runs" class="pair-runs">0</p>
            </div>
          </div>
        </div>
      </div>

      <div id="g-fow" class="graphic panel panel-batsman-live" hidden>
        <div class="panel-accent"></div>
        <div class="bat-live-body">
          <div class="bat-live-stripe">
            <p id="fow-name" class="bat-live-name">—</p>
            <p id="fow-score" class="bat-live-score">0 (0)</p>
          </div>
          <p id="fow-dismissal" class="fow-how-out">out</p>
          <div class="bat-live-stats" role="group" aria-label="This innings batting">
            <div class="bat-live-stat">
              <span class="bat-live-stat-label">Dots</span>
              <span id="fow-dots" class="bat-live-stat-value">0</span>
            </div>
            <div class="bat-live-stat">
              <span class="bat-live-stat-label">4s</span>
              <span id="fow-fours" class="bat-live-stat-value">0</span>
            </div>
            <div class="bat-live-stat">
              <span class="bat-live-stat-label">6s</span>
              <span id="fow-sixes" class="bat-live-stat-value">0</span>
            </div>
            <div class="bat-live-stat">
              <span class="bat-live-stat-label">SR</span>
              <span id="fow-sr" class="bat-live-stat-value">0.00</span>
            </div>
          </div>
        </div>
      </div>

      <div id="g-batsman" class="graphic panel panel-batsman-live" hidden>
        <div class="panel-accent"></div>
        <div class="bat-live-body">
          <div class="bat-live-stripe">
            <p id="bat-name" class="bat-live-name">—</p>
            <p id="bat-match" class="bat-live-score">0 (0)</p>
          </div>
          <div class="bat-live-stats" role="group" aria-label="This innings batting">
            <div class="bat-live-stat">
              <span class="bat-live-stat-label">Dot Balls</span>
              <span id="bat-dots" class="bat-live-stat-value">0</span>
            </div>
            <div class="bat-live-stat">
              <span class="bat-live-stat-label">2s</span>
              <span id="bat-twos" class="bat-live-stat-value">0</span>
            </div>
            <div class="bat-live-stat">
              <span class="bat-live-stat-label">4s</span>
              <span id="bat-fours" class="bat-live-stat-value">0</span>
            </div>
            <div class="bat-live-stat">
              <span class="bat-live-stat-label">6s</span>
              <span id="bat-sixes" class="bat-live-stat-value">0</span>
            </div>
            <div class="bat-live-stat">
              <span class="bat-live-stat-label">SR</span>
              <span id="bat-sr" class="bat-live-stat-value">0.00</span>
            </div>
          </div>
        </div>
      </div>

      <div id="g-batsman-career" class="graphic graphic-centered batsman-career-graphic" hidden></div>

      <div id="g-toss-result" class="graphic graphic-centered toss-result-graphic" hidden></div>

      <div id="g-bowler" class="graphic panel panel-batsman-live" hidden>
        <div class="panel-accent"></div>
        <div class="bat-live-body">
          <div class="bat-live-stripe">
            <p id="bowl-name" class="bat-live-name">—</p>
          </div>
          <div class="bat-live-stats" role="group" aria-label="This innings bowling">
            <div class="bat-live-stat">
              <span class="bat-live-stat-label">Overs</span>
              <span id="bowl-overs" class="bat-live-stat-value">0.0</span>
            </div>
            <div class="bat-live-stat">
              <span class="bat-live-stat-label">Maidens</span>
              <span id="bowl-maidens" class="bat-live-stat-value">0</span>
            </div>
            <div class="bat-live-stat">
              <span class="bat-live-stat-label">Dots</span>
              <span id="bowl-dots" class="bat-live-stat-value">0</span>
            </div>
            <div class="bat-live-stat">
              <span class="bat-live-stat-label">Wickets</span>
              <span id="bowl-wickets" class="bat-live-stat-value">0</span>
            </div>
            <div class="bat-live-stat">
              <span class="bat-live-stat-label">Runs</span>
              <span id="bowl-runs" class="bat-live-stat-value">0</span>
            </div>
            <div class="bat-live-stat">
              <span class="bat-live-stat-label">Economy</span>
              <span id="bowl-economy" class="bat-live-stat-value">0.00</span>
            </div>
          </div>
        </div>
      </div>

      <div id="g-innings" class="graphic graphic-centered innings-scorecard-graphic" hidden></div>

      <div id="g-hello" class="graphic hello" hidden>
        <div class="hello-inner">HELLO</div>
      </div>
  `.trim();
}

export interface GraphicsStageOptions {
  apiBase: string;
  matchId?: string | null;
  /** When true, inject panel markup into an empty host (root page). */
  injectMarkup?: boolean;
}

export interface GraphicsStageController {
  setScorecard(card: ScorecardResponse | null): void;
  setMatchContext(ctx: MatchContext | null): void;
  setBallType(ballType: BallType): void;
  applyCommand(cmd: GraphicsCommandMessage): void;
  hideAll(): void;
  /** True when any full-screen overlay graphic is on air. */
  isOnAir(): boolean;
  /** Active stage graphic kind, or null. */
  activeKind(): OverlayKind | null;
}

export function createGraphicsStage(
  root: HTMLElement,
  options: GraphicsStageOptions,
): GraphicsStageController {
  if (options.injectMarkup) {
    root.innerHTML = buildGraphicsStageMarkup();
  }

  const el = <T extends HTMLElement>(id: string): T => {
    const node = root.querySelector(`#${CSS.escape(id)}`);
    if (!node) {
      throw new Error(`Missing #${id} in graphics stage`);
    }
    return node as T;
  };

  const setText = (id: string, text: string): void => {
    const node = el(id);
    if (node.textContent !== text) {
      node.textContent = text;
    }
  };

  let scorecard: ScorecardResponse | null = null;
  let matchCtx: MatchContext | null = null;
  let ballType: BallType = 'TENNIS';
  let activeKind: OverlayKind | null = null;
  let activePlayerId: string | null = null;
  let inningsEnsureToken = 0;
  const batsmanCareer = mountBatsmanCareerCard(el('g-batsman-career'));
  const tossResult = mountTossResultCard(el('g-toss-result'));
  const inningsCard = mountInningsScorecard(el('g-innings'));

  const graphicNode = (kind: OverlayKind): HTMLElement => el(GRAPHIC_IDS[kind]);

  const isMountManaged = (kind: OverlayKind): boolean =>
    kind === 'batsman_career' ||
    kind === 'toss_result' ||
    kind === 'innings_break';

  const hideNode = (node: HTMLElement): void => {
    node.classList.remove('is-visible');
    window.setTimeout(() => {
      if (!node.classList.contains('is-visible')) {
        node.hidden = true;
      }
    }, ANIM_MS);
  };

  const showNode = (node: HTMLElement): void => {
    node.hidden = false;
    requestAnimationFrame(() => node.classList.add('is-visible'));
  };

  const hideAllGraphics = (): void => {
    activeKind = null;
    activePlayerId = null;
    inningsEnsureToken += 1;
    batsmanCareer.hide();
    tossResult.hide();
    inningsCard.hide();
    for (const kind of Object.keys(GRAPHIC_IDS) as OverlayKind[]) {
      if (isMountManaged(kind)) {
        continue;
      }
      hideNode(graphicNode(kind));
    }
  };

  const hideGraphic = (kind: GraphicsKind): void => {
    if (isStripOwnedKind(kind)) {
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
    if (kind === 'toss_result') {
      tossResult.hide();
      return;
    }
    if (kind === 'innings_break') {
      inningsEnsureToken += 1;
      inningsCard.hide();
      return;
    }
    hideNode(graphicNode(kind));
  };

  const showTossResult = (): boolean => {
    try {
      return tossResult.show(matchCtx);
    } catch (err) {
      console.warn('[graphics] toss result failed', err);
      tossResult.hide();
      return false;
    }
  };

  const showInningsBreak = async (
    view: InningsBreakView,
  ): Promise<boolean> => {
    const token = ++inningsEnsureToken;
    try {
      const card = scorecard;
      if (!card) {
        return false;
      }
      const innings = resolveInningsBreakInnings(card);
      if (!innings) {
        return false;
      }
      const matchId = options.matchId?.trim() ?? '';
      const hasBattingSide = (ctx: MatchContext | null): boolean => {
        const side = resolveBattingSide(card, innings, ctx);
        return side != null && side.players.length > 0;
      };

      const paintResolved = (): boolean => {
        const side = resolveBattingSide(card, innings, matchCtx);
        if (side && side.players.length > 0) {
          console.warn('[isc-xi] resolver', {
            source: side.source,
            teamId: side.teamId,
            isExternal: side.isExternal,
            xiLen: side.players.length,
          });
          return inningsCard.show(card, matchCtx, view, 'full');
        }
        return inningsCard.show(card, matchCtx, view, 'no_squad');
      };

      if (hasBattingSide(matchCtx)) {
        return paintResolved();
      }

      if (!matchId) {
        return inningsCard.show(card, matchCtx, view, 'no_squad');
      }

      inningsCard.showLoading(view);
      const ctx = await ensureMatchContext(options.apiBase, matchId, {
        requirementKey: `batting-side|${innings.inningsId ?? innings.sequence}`,
        isSatisfied: hasBattingSide,
      });
      if (token !== inningsEnsureToken || activeKind !== 'innings_break') {
        return false;
      }
      if (ctx) {
        matchCtx = ctx;
      }
      if (hasBattingSide(matchCtx)) {
        return paintResolved();
      }
      if (ctx) {
        return inningsCard.show(card, matchCtx, view, 'no_squad');
      }
      inningsCard.showLoading(view);
      return true;
    } catch (err) {
      console.warn('[graphics] innings break failed', err);
      if (token === inningsEnsureToken && activeKind === 'innings_break') {
        inningsCard.showLoading(view);
        return true;
      }
      return false;
    }
  };

  const nameOf = (id: string | null): string => {
    if (!scorecard) {
      return '—';
    }
    return shortName(playerName(scorecard.display, id));
  };

  const fillPartnership = (): boolean => {
    try {
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
    } catch (err) {
      console.warn('[graphics] fill partnership failed', err);
      return false;
    }
  };

  const fillFow = (): boolean => {
    try {
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
      setText('fow-name', fullName === '—' ? '—' : fullName);
      setText('fow-score', formatBatterInningsScore(batter));
      const dismissal = batter
        ? formatDismissalShort(batter, (id) => nameOf(id)).trim()
        : '';
      setText('fow-dismissal', dismissal || 'out');
      setText('fow-dots', String(deriveBatterDotBalls(batter)));
      setText('fow-fours', String(batter?.fours ?? 0));
      setText('fow-sixes', String(batter?.sixes ?? 0));
      const sr =
        batter && Number.isFinite(batter.strikeRate)
          ? batter.strikeRate
          : batter && batter.balls > 0
            ? (batter.runs / batter.balls) * 100
            : 0;
      setText('fow-sr', formatStat(sr, 2));
      return true;
    } catch (err) {
      console.warn('[graphics] fill fow failed', err);
      return false;
    }
  };

  const parseInningsView = (
    payload?: GraphicsCommandMessage['payload'],
  ): InningsBreakView => parseInningsBreakView(payload?.view);

  const hideManagedGraphic = (kind: OverlayKind): void => {
    if (kind === 'batsman_career') {
      batsmanCareer.hide();
      return;
    }
    if (kind === 'toss_result') {
      tossResult.hide();
      return;
    }
    if (kind === 'innings_break') {
      inningsEnsureToken += 1;
      inningsCard.hide();
      return;
    }
    hideNode(graphicNode(kind));
  };

  const resolveBatsmanId = (
    preferred: string | null | undefined,
  ): string | null => {
    if (preferred) {
      return preferred;
    }
    if (!scorecard) {
      return null;
    }
    return resolveActiveInnings(scorecard)?.currentStrikerId ?? null;
  };

  const resolveBowlerId = (
    preferred: string | null | undefined,
  ): string | null => {
    if (preferred) {
      return preferred;
    }
    if (!scorecard) {
      return null;
    }
    return resolveActiveInnings(scorecard)?.currentBowlerId ?? null;
  };

  const fillBatsmanMatch = (playerId: string): void => {
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
  };

  const fillBowlerMatch = (playerId: string): void => {
    try {
      if (!scorecard) {
        return;
      }
      const innings = resolveActiveInnings(scorecard);
      const bowler = innings?.bowlers.find((b) => b.playerId === playerId);
      const full = playerName(scorecard.display, playerId);
      setText('bowl-name', full === '—' ? '—' : full);
      setText('bowl-overs', bowler?.oversText?.trim() || '0.0');
      setText('bowl-maidens', String(bowler?.maidens ?? 0));
      setText('bowl-dots', String(bowler?.dotBalls ?? 0));
      setText('bowl-wickets', String(bowler?.wickets ?? 0));
      setText('bowl-runs', String(bowler?.runsConceded ?? 0));
      const economy =
        bowler && Number.isFinite(bowler.economy)
          ? bowler.economy
          : bowler && bowler.legalBalls > 0
            ? (bowler.runsConceded / (bowler.legalBalls / 6))
            : 0;
      setText('bowl-economy', formatStat(economy, 2));
    } catch (err) {
      console.warn('[graphics] fill bowler failed', err);
    }
  };

  const showBatsmanCareer = async (playerId: string): Promise<void> => {
    try {
      const placeholderName = scorecard
        ? playerName(scorecard.display, playerId)
        : undefined;
      const ok = await batsmanCareer.show(playerId, {
        apiBase: options.apiBase,
        ballType,
        placeholderName,
      });
      if (
        !ok &&
        activeKind === 'batsman_career' &&
        activePlayerId === playerId
      ) {
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
  };

  const refreshActiveContent = (): void => {
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
        if (inningsCard.xiStatus() === 'loading') {
          break;
        }
        if (
          !inningsCard.show(
            scorecard,
            matchCtx,
            inningsCard.currentView(),
            inningsCard.xiStatus() === 'full' ? 'full' : 'no_squad',
          )
        ) {
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
      default:
        break;
    }
  };

  const showGraphic = async (
    kind: GraphicsKind,
    payload?: GraphicsCommandMessage['payload'],
  ): Promise<void> => {
    if (isStripOwnedKind(kind)) {
      return;
    }

    if (kind === 'hello') {
      for (const k of Object.keys(GRAPHIC_IDS) as OverlayKind[]) {
        if (k !== 'hello') {
          hideManagedGraphic(k);
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
      ok = scorecard != null && scorecard.innings.length > 0;
    } else if (kind === 'batsman') {
      playerId = resolveBatsmanId(payload?.playerId);
      ok = playerId != null;
    } else if (kind === 'bowler') {
      playerId = resolveBowlerId(payload?.playerId);
      ok = playerId != null;
    } else if (kind === 'batsman_career') {
      playerId = resolveBatsmanId(payload?.playerId);
      ok = playerId != null;
    } else if (kind === 'toss_result') {
      ok = formatTossResultLine(matchCtx) != null;
    }

    if (!ok) {
      return;
    }

    for (const k of Object.keys(GRAPHIC_IDS) as OverlayKind[]) {
      if (k === kind) {
        continue;
      }
      hideManagedGraphic(k);
    }

    activeKind = kind;
    activePlayerId = playerId;

    if (kind === 'batsman' && playerId) {
      fillBatsmanMatch(playerId);
      showNode(graphicNode(kind));
    } else if (kind === 'bowler' && playerId) {
      fillBowlerMatch(playerId);
      showNode(graphicNode(kind));
    } else if (kind === 'batsman_career' && playerId) {
      void showBatsmanCareer(playerId);
    } else if (kind === 'toss_result') {
      if (!showTossResult()) {
        activeKind = null;
        activePlayerId = null;
      }
    } else if (kind === 'innings_break') {
      const painted = await showInningsBreak(parseInningsView(payload));
      if (!painted && activeKind === 'innings_break') {
        activeKind = null;
        activePlayerId = null;
      }
    } else {
      showNode(graphicNode(kind));
    }
  };

  return {
    setScorecard(card) {
      scorecard = card;
      try {
        refreshActiveContent();
      } catch (err) {
        console.warn('[graphics] refresh failed', err);
      }
    },
    setMatchContext(ctx) {
      matchCtx = ctx;
      try {
        if (activeKind === 'toss_result' && !showTossResult()) {
          activeKind = null;
          activePlayerId = null;
        }
        if (activeKind === 'innings_break') {
          if (inningsCard.xiStatus() === 'loading') {
            void showInningsBreak(inningsCard.currentView());
          } else if (
            !inningsCard.show(
              scorecard,
              matchCtx,
              inningsCard.currentView(),
              inningsCard.xiStatus() === 'full' ? 'full' : 'no_squad',
            )
          ) {
            activeKind = null;
            activePlayerId = null;
          }
        }
      } catch (err) {
        console.warn('[graphics] match context refresh failed', err);
      }
    },
    setBallType(next) {
      ballType = next;
    },
    hideAll: hideAllGraphics,
    isOnAir: () =>
      activeKind != null ||
      batsmanCareer.isOnAir() ||
      tossResult.isOnAir() ||
      inningsCard.isOnAir(),
    activeKind: () => activeKind,
    applyCommand(cmd) {
      try {
        if (cmd.action === 'hide_all') {
          hideAllGraphics();
          return;
        }
        if (!cmd.graphic) {
          return;
        }
        if (isStripOwnedKind(cmd.graphic)) {
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
              hideAllGraphics();
            } catch {
              /* ignore */
            }
          });
        }
      } catch (err) {
        console.warn('[graphics] command handler failed', err);
        try {
          hideAllGraphics();
        } catch {
          /* ignore */
        }
      }
    },
  };
}
