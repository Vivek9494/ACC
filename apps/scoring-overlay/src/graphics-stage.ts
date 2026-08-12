/**
 * Shared full-screen graphics stage for graphics.html and the root strip page.
 * All queries are scoped to the stage root so strip IDs (e.g. bowl-initials) never clash.
 */

import './graphics.css';
import { mountBatsmanCareerCard } from './batsman-career-card';
import {
  battingTeamLabel,
  deriveBatterDotBalls,
  formatBatterInningsScore,
  formatDismissalShort,
  formatStat,
  latestFallOfWicket,
  partnershipBatterRuns,
  playerName,
  resolveActiveInnings,
  shortName,
  wicketOrdinal,
} from './graphics-format';
import type { GraphicsCommandMessage, GraphicsKind } from './live-client';
import {
  formatTossResultLine,
  mountTossResultCard,
} from './toss-result-card';
import type {
  BallType,
  MatchContext,
  ScorecardResponse,
} from './types';

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

      <div id="g-fow" class="graphic panel panel-wide" hidden>
        <div class="panel-accent"></div>
        <div class="panel-body">
          <p id="fow-headline" class="eyebrow">Wicket</p>
          <p id="fow-name" class="hero-name">—</p>
          <p id="fow-dismissal" class="sub dismissal">—</p>
          <p id="fow-detail" class="meta">—</p>
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

      <div id="g-innings" class="graphic panel panel-wide" hidden>
        <div class="panel-accent"></div>
        <div class="panel-body">
          <p class="eyebrow">Innings break</p>
          <div class="innings-rows">
            <div class="innings-row">
              <p id="inn1-team" class="name">—</p>
              <p id="inn1-score" class="hero-stat compact">—</p>
            </div>
            <div class="innings-row">
              <p id="inn2-team" class="name">—</p>
              <p id="inn2-score" class="hero-stat compact">—</p>
            </div>
          </div>
          <p id="inn-target" class="meta target-line" hidden></p>
        </div>
      </div>

      <div id="g-hello" class="graphic hello" hidden>
        <div class="hello-inner">HELLO</div>
      </div>
  `.trim();
}

export interface GraphicsStageOptions {
  apiBase: string;
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
  const batsmanCareer = mountBatsmanCareerCard(el('g-batsman-career'));
  const tossResult = mountTossResultCard(el('g-toss-result'));

  const graphicNode = (kind: OverlayKind): HTMLElement => el(GRAPHIC_IDS[kind]);

  const isMountManaged = (kind: OverlayKind): boolean =>
    kind === 'batsman_career' || kind === 'toss_result';

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
    batsmanCareer.hide();
    tossResult.hide();
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
      batter ? formatDismissalShort(batter, (id) => nameOf(id)) : '—',
    );
    const figures = batter ? `${batter.runs} (${batter.balls})` : '';
    setText(
      'fow-detail',
      [figures, `${fow.oversText} ov`].filter(Boolean).join(' · '),
    );
    return true;
  };

  const fillInningsBreak = (): boolean => {
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
          if (k === 'batsman_career') {
            batsmanCareer.hide();
          } else if (k === 'toss_result') {
            tossResult.hide();
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
      if (k === 'batsman_career') {
        batsmanCareer.hide();
      } else if (k === 'toss_result') {
        tossResult.hide();
      } else {
        hideNode(graphicNode(k));
      }
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
      } catch (err) {
        console.warn('[graphics] toss context refresh failed', err);
      }
    },
    setBallType(next) {
      ballType = next;
    },
    hideAll: hideAllGraphics,
    isOnAir: () =>
      activeKind != null || batsmanCareer.isOnAir() || tossResult.isOnAir(),
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
