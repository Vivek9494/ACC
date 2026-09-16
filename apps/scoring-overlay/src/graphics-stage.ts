/**
 * Shared full-screen graphics stage for graphics.html and the root strip page.
 * All queries are scoped to the stage root so strip IDs (e.g. bowl-initials) never clash.
 */

import './graphics.css';
import { ensureMatchContext, fetchMatchContext } from './broadcast-fetch';
import { mountBatsmanCareerCard } from './batsman-career-card';
import { mountBattingCard } from './batting-card';
import { mountBowlingCard } from './bowling-card';
import { concealGraphic, revealGraphic } from './graphic-visibility';
import { mountInningsScorecard } from './innings-scorecard';
import { mountLastWicketCard } from './last-wicket-card';
import { mountPartnershipCard } from './partnership-card';
import { mountTeamPartnershipsCard } from './team-partnerships-card';
import {
  deriveBatterDotBalls,
  findInningsByKey,
  formatBatterInningsScore,
  formatStat,
  latestFallOfWicket,
  playerName,
  resolveActiveInnings,
  resolveBattingSide,
  resolveScorecardInnings,
  teamPartnershipStandRows,
} from './graphics-format';
import type { GraphicsCommandMessage, GraphicsKind } from './live-client';
import {
  formatPlayingXiPreview,
  mountPlayingXiCard,
  type PlayingXiShowOptions,
} from './playing-xi-card';
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
import { parseInningsBreakView, parseScorecardViewSource } from './types';
import type { ScorecardViewSource } from './types';

/** Strip page owns these — stage ignores them. */
export type StripOwnedKind = 'toss' | 'chase' | 'boundaries' | 'bowler_career';
/** Known command kinds with no stage panel yet (control may still emit). */
export type PendingOverlayKind = 'wagon_wheel';
/** Tournament aggregates — handled by Theme 1 tournament graphics module. */
export type TournamentOverlayKind =
  | 'points_table'
  | 'tournament_top_batsmen'
  | 'tournament_top_bowlers'
  | 'tournament_fours'
  | 'tournament_sixes'
  | 'most_sixes'
  | 'most_fours';
export type OverlayKind = Exclude<
  GraphicsKind,
  StripOwnedKind | PendingOverlayKind | TournamentOverlayKind
>;

const GRAPHIC_IDS: Record<OverlayKind, string> = {
  partnership: 'g-partnership',
  fow: 'g-fow',
  batsman: 'g-batsman',
  batsman_career: 'g-batsman-career',
  bowler: 'g-bowler',
  innings_break: 'g-innings',
  toss_result: 'g-toss-result',
  playing_xi: 'g-playing-xi',
  batting_card: 'g-batting-card',
  bowling_card: 'g-bowling-card',
  team_partnerships: 'g-team-partnerships',
  hello: 'g-hello',
};

export function isStripOwnedKind(kind: GraphicsKind): kind is StripOwnedKind {
  return (
    kind === 'toss' ||
    kind === 'chase' ||
    kind === 'boundaries' ||
    kind === 'bowler_career'
  );
}

export function isPendingOverlayKind(kind: GraphicsKind): kind is PendingOverlayKind {
  return kind === 'wagon_wheel';
}

export function isTournamentOverlayKind(kind: GraphicsKind): kind is TournamentOverlayKind {
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

/** Markup for panels inside the stage (IDs are unique within the stage root). */
export function buildGraphicsStageMarkup(): string {
  return `
      <div id="g-partnership" class="graphic graphic-centered partnership-graphic" hidden></div>

      <div id="g-fow" class="graphic graphic-centered last-wicket-graphic" hidden></div>

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

      <div id="g-playing-xi" class="graphic graphic-centered playing-xi-graphic" hidden></div>

      <div id="g-batting-card" class="graphic graphic-centered batting-card-graphic" hidden></div>

      <div id="g-bowling-card" class="graphic graphic-centered bowling-card-graphic" hidden></div>

      <div id="g-team-partnerships" class="graphic graphic-centered team-partnerships-graphic" hidden></div>

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

  const missingMountWarned = new Set<string>();

  const warnMissingMount = (id: string): void => {
    if (missingMountWarned.has(id)) {
      return;
    }
    missingMountWarned.add(id);
    console.warn(`[graphics] Missing #${id} in graphics stage — graphic disabled`);
  };

  const queryEl = <T extends HTMLElement>(id: string): T | null => {
    const node = root.querySelector(`#${CSS.escape(id)}`);
    if (!node) {
      warnMissingMount(id);
      return null;
    }
    return node as T;
  };

  const setText = (id: string, text: string): void => {
    const node = queryEl(id);
    if (!node) {
      return;
    }
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
  let battingCardEnsureToken = 0;
  let bowlingCardEnsureToken = 0;
  let inningsCmd = {
    view: 'batting' as InningsBreakView,
    inningsId: null as string | null,
    source: 'break' as ScorecardViewSource,
  };
  let playingXiCmd: PlayingXiShowOptions = { variant: 'both' };
  let battingCardInningsId: string | null = null;
  let bowlingCardInningsId: string | null = null;
  let teamPartnershipsInningsId: string | null = null;
  let fowInningsId: string | null = null;

  const mountOrNull = <T>(id: string, mount: (host: HTMLElement) => T): T | null => {
    const node = queryEl(id);
    if (!node) {
      return null;
    }
    return mount(node);
  };

  const batsmanCareer = mountOrNull('g-batsman-career', mountBatsmanCareerCard);
  const tossResult = mountOrNull('g-toss-result', mountTossResultCard);
  const playingXi = mountOrNull('g-playing-xi', mountPlayingXiCard);
  const battingCard = mountOrNull('g-batting-card', mountBattingCard);
  const bowlingCard = mountOrNull('g-bowling-card', mountBowlingCard);
  const partnershipCard = mountOrNull('g-partnership', mountPartnershipCard);
  const teamPartnershipsCard = mountOrNull(
    'g-team-partnerships',
    mountTeamPartnershipsCard,
  );
  const lastWicketCard = mountOrNull('g-fow', mountLastWicketCard);
  const inningsCard = mountOrNull('g-innings', mountInningsScorecard);

  const graphicNode = (kind: OverlayKind): HTMLElement | null =>
    queryEl(GRAPHIC_IDS[kind]);

  const isMountManaged = (kind: OverlayKind): boolean =>
    kind === 'batsman_career' ||
    kind === 'toss_result' ||
    kind === 'playing_xi' ||
    kind === 'batting_card' ||
    kind === 'bowling_card' ||
    kind === 'partnership' ||
    kind === 'team_partnerships' ||
    kind === 'fow' ||
    kind === 'innings_break';

  const hideNode = (node: HTMLElement): void => {
    concealGraphic(node);
  };

  const showNode = (node: HTMLElement | null): void => {
    revealGraphic(node);
  };

  const hideAllGraphics = (): void => {
    activeKind = null;
    activePlayerId = null;
    inningsEnsureToken += 1;
    battingCardEnsureToken += 1;
    bowlingCardEnsureToken += 1;
    batsmanCareer?.hide();
    tossResult?.hide();
    playingXi?.hide();
    battingCard?.hide();
    bowlingCard?.hide();
    partnershipCard?.hide();
    teamPartnershipsCard?.hide();
    lastWicketCard?.hide();
    inningsCard?.hide();
    for (const kind of Object.keys(GRAPHIC_IDS) as OverlayKind[]) {
      if (isMountManaged(kind)) {
        continue;
      }
      const node = graphicNode(kind);
      if (node) {
        hideNode(node);
      }
    }
  };

  const hideGraphic = (kind: GraphicsKind): void => {
    if (isStripOwnedKind(kind)) {
      return;
    }
    if (isPendingOverlayKind(kind)) {
      return;
    }
    if (isTournamentOverlayKind(kind)) {
      return;
    }
    if (activeKind === kind) {
      activeKind = null;
      activePlayerId = null;
    }
    if (kind === 'batsman_career') {
      batsmanCareer?.hide();
      return;
    }
    if (kind === 'toss_result') {
      tossResult?.hide();
      return;
    }
    if (kind === 'playing_xi') {
      playingXi?.hide();
      return;
    }
    if (kind === 'batting_card') {
      battingCardEnsureToken += 1;
      battingCard?.hide();
      return;
    }
    if (kind === 'bowling_card') {
      bowlingCardEnsureToken += 1;
      bowlingCard?.hide();
      return;
    }
    if (kind === 'partnership') {
      partnershipCard?.hide();
      return;
    }
    if (kind === 'team_partnerships') {
      teamPartnershipsCard?.hide();
      return;
    }
    if (kind === 'fow') {
      lastWicketCard?.hide();
      return;
    }
    if (kind === 'innings_break') {
      inningsEnsureToken += 1;
      inningsCard?.hide();
      return;
    }
    const node = graphicNode(kind);
    if (node) {
      hideNode(node);
    }
  };

  const showPartnership = (animate: boolean): boolean => {
    if (!partnershipCard) {
      return false;
    }
    try {
      if (animate) {
        return partnershipCard.show(scorecard, { animate: true });
      }
      if (partnershipCard.isOnAir()) {
        return partnershipCard.update(scorecard);
      }
      return partnershipCard.show(scorecard, { animate: false });
    } catch (err) {
      console.warn('[graphics] partnership failed', err);
      partnershipCard.hide();
      return false;
    }
  };

  const showTeamPartnerships = (animate: boolean): boolean => {
    if (!teamPartnershipsCard) {
      return false;
    }
    try {
      const opts = { inningsId: teamPartnershipsInningsId };
      if (animate) {
        return teamPartnershipsCard.show(scorecard, { ...opts, animate: true });
      }
      if (teamPartnershipsCard.isOnAir()) {
        return teamPartnershipsCard.update(scorecard, opts);
      }
      return teamPartnershipsCard.show(scorecard, { ...opts, animate: false });
    } catch (err) {
      console.warn('[graphics] team partnerships failed', err);
      teamPartnershipsCard.hide();
      return false;
    }
  };

  const showLastWicket = (animate: boolean): boolean => {
    if (!lastWicketCard) {
      return false;
    }
    try {
      const opts = { inningsId: fowInningsId };
      if (animate) {
        return lastWicketCard.show(scorecard, { ...opts, animate: true });
      }
      if (lastWicketCard.isOnAir()) {
        return lastWicketCard.update(scorecard, opts);
      }
      return lastWicketCard.show(scorecard, { ...opts, animate: false });
    } catch (err) {
      console.warn('[graphics] last wicket failed', err);
      lastWicketCard.hide();
      return false;
    }
  };

  const showTossResult = (): boolean => {
    if (!tossResult) {
      return false;
    }
    try {
      return tossResult.show(matchCtx);
    } catch (err) {
      console.warn('[graphics] toss result failed', err);
      tossResult.hide();
      return false;
    }
  };

  const showPlayingXi = async (
    xiOptions: PlayingXiShowOptions = playingXiCmd,
  ): Promise<boolean> => {
    if (!playingXi) {
      return false;
    }
    try {
      const matchId = options.matchId?.trim() ?? '';
      if (matchId) {
        const fresh = await fetchMatchContext(options.apiBase, matchId);
        if (fresh) {
          matchCtx = fresh;
        }
      }
      return playingXi.show(matchCtx, xiOptions);
    } catch (err) {
      console.warn('[graphics] playing xi failed', err);
      playingXi.hide();
      return false;
    }
  };

  const showInningsBreak = async (
    view: InningsBreakView = inningsCmd.view,
  ): Promise<boolean> => {
    if (!inningsCard) {
      return false;
    }
    const token = ++inningsEnsureToken;
    try {
      const card = scorecard;
      if (!card) {
        return false;
      }
      const innings = resolveScorecardInnings(card, inningsCmd);
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
          return inningsCard.show(
            card,
            matchCtx,
            view,
            'full',
            innings,
            inningsCmd.source,
          );
        }
        return inningsCard.show(
          card,
          matchCtx,
          view,
          'no_squad',
          innings,
          inningsCmd.source,
        );
      };

      if (hasBattingSide(matchCtx)) {
        return paintResolved();
      }

      if (!matchId) {
        return inningsCard.show(
          card,
          matchCtx,
          view,
          'no_squad',
          innings,
          inningsCmd.source,
        );
      }

      inningsCard.showLoading(view, inningsCmd.source);
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
        return inningsCard.show(
          card,
          matchCtx,
          view,
          'no_squad',
          innings,
          inningsCmd.source,
        );
      }
      inningsCard.showLoading(view, inningsCmd.source);
      return true;
    } catch (err) {
      console.warn('[graphics] innings break failed', err);
      if (token === inningsEnsureToken && activeKind === 'innings_break') {
        inningsCard.showLoading(view, inningsCmd.source);
        return true;
      }
      return false;
    }
  };

  const showBattingCard = async (animate: boolean): Promise<boolean> => {
    if (!battingCard) {
      return false;
    }
    const token = ++battingCardEnsureToken;
    try {
      const card = scorecard;
      if (!card) {
        return false;
      }
      const innings = battingCardInningsId
        ? findInningsByKey(card, battingCardInningsId)
        : (card.innings.at(-1) ?? null);
      if (!innings) {
        return false;
      }

      const hasBattingXi = (ctx: MatchContext | null): boolean => {
        const side = resolveBattingSide(card, innings, ctx);
        return side != null && side.players.length > 0;
      };

      const paintWithCtx = (ctx: MatchContext | null): boolean => {
        if (animate) {
          return battingCard.show(card, battingCardInningsId, ctx, {
            animate: true,
          });
        }
        return battingCard.update(card, battingCardInningsId, ctx);
      };

      if (hasBattingXi(matchCtx)) {
        return paintWithCtx(matchCtx);
      }

      const matchId = options.matchId?.trim() ?? '';
      if (!matchId) {
        return paintWithCtx(matchCtx);
      }

      const ctx = await ensureMatchContext(options.apiBase, matchId, {
        requirementKey: `batting-card|${innings.inningsId ?? innings.sequence}`,
        isSatisfied: hasBattingXi,
      });
      if (token !== battingCardEnsureToken || activeKind !== 'batting_card') {
        return false;
      }
      if (ctx) {
        matchCtx = ctx;
      }
      return paintWithCtx(matchCtx);
    } catch (err) {
      console.warn('[graphics] batting card failed', err);
      return false;
    }
  };

  const showBowlingCard = (animate: boolean): boolean => {
    if (!bowlingCard) {
      return false;
    }
    try {
      const card = scorecard;
      if (!card) {
        return false;
      }
      if (animate) {
        return bowlingCard.show(card, bowlingCardInningsId, { animate: true });
      }
      return bowlingCard.update(card, bowlingCardInningsId);
    } catch (err) {
      console.warn('[graphics] bowling card failed', err);
      return false;
    }
  };

  const parseInningsView = (
    payload?: GraphicsCommandMessage['payload'],
  ): InningsBreakView => parseInningsBreakView(payload?.view);

  const hideManagedGraphic = (kind: OverlayKind): void => {
    if (kind === 'batsman_career') {
      batsmanCareer?.hide();
      return;
    }
    if (kind === 'toss_result') {
      tossResult?.hide();
      return;
    }
    if (kind === 'playing_xi') {
      playingXi?.hide();
      return;
    }
    if (kind === 'batting_card') {
      battingCardEnsureToken += 1;
      battingCard?.hide();
      return;
    }
    if (kind === 'bowling_card') {
      bowlingCardEnsureToken += 1;
      bowlingCard?.hide();
      return;
    }
    if (kind === 'partnership') {
      partnershipCard?.hide();
      return;
    }
    if (kind === 'team_partnerships') {
      teamPartnershipsCard?.hide();
      return;
    }
    if (kind === 'fow') {
      lastWicketCard?.hide();
      return;
    }
    if (kind === 'innings_break') {
      inningsEnsureToken += 1;
      inningsCard?.hide();
      return;
    }
    const node = graphicNode(kind);
    if (node) {
      hideNode(node);
    }
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
    if (!batsmanCareer) {
      if (activeKind === 'batsman_career') {
        activeKind = null;
        activePlayerId = null;
      }
      return;
    }
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
        if (!showPartnership(false) && activeKind === 'partnership') {
          hideGraphic('partnership');
        }
        break;
      case 'team_partnerships':
        if (!showTeamPartnerships(false) && activeKind === 'team_partnerships') {
          hideGraphic('team_partnerships');
        }
        break;
      case 'fow':
        if (!showLastWicket(false) && activeKind === 'fow') {
          hideGraphic('fow');
        }
        break;
      case 'innings_break':
        if (!inningsCard || inningsCard.xiStatus() === 'loading') {
          break;
        }
        {
          const innings = scorecard
            ? resolveScorecardInnings(scorecard, inningsCmd)
            : null;
          if (
            !innings ||
            !inningsCard.show(
              scorecard,
              matchCtx,
              inningsCmd.view,
              inningsCard.xiStatus() === 'full' ? 'full' : 'no_squad',
              innings,
              inningsCmd.source,
            )
          ) {
            hideGraphic('innings_break');
          }
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
      case 'batting_card':
        void showBattingCard(false).then((ok) => {
          if (!ok && activeKind === 'batting_card') {
            hideGraphic('batting_card');
          }
        });
        break;
      case 'bowling_card':
        if (!showBowlingCard(false) && activeKind === 'bowling_card') {
          hideGraphic('bowling_card');
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
    // Follow-up: broadcast wagon-wheel SVG graphic (shotX/shotY) not built yet.
    if (isPendingOverlayKind(kind)) {
      return;
    }
    if (isTournamentOverlayKind(kind)) {
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
      ok =
        scorecard != null &&
        (() => {
          const innings = resolveActiveInnings(scorecard);
          const ps = innings?.partnership ?? null;
          return ps != null && ps.batterIds.length >= 2;
        })();
    } else if (kind === 'fow') {
      fowInningsId = payload?.inningsId?.trim() || null;
      ok =
        scorecard != null &&
        (() => {
          const innings =
            (fowInningsId
              ? findInningsByKey(scorecard, fowInningsId)
              : null) ?? resolveActiveInnings(scorecard);
          return latestFallOfWicket(innings) != null;
        })();
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
    } else if (kind === 'playing_xi') {
      playingXiCmd = {
        teamId: payload?.teamId?.trim() || null,
        variant: payload?.variant ?? (payload?.teamId ? 'single' : 'both'),
      };
      ok =
        formatPlayingXiPreview(matchCtx) != null ||
        Boolean(options.matchId?.trim()) ||
        playingXiCmd.variant !== 'both';
    } else if (kind === 'batting_card') {
      battingCardInningsId = payload?.inningsId?.trim() || null;
      ok =
        scorecard != null &&
        (battingCardInningsId
          ? findInningsByKey(scorecard, battingCardInningsId) != null
          : scorecard.innings.length > 0);
    } else if (kind === 'bowling_card') {
      bowlingCardInningsId = payload?.inningsId?.trim() || null;
      ok =
        scorecard != null &&
        (bowlingCardInningsId
          ? findInningsByKey(scorecard, bowlingCardInningsId) != null
          : scorecard.innings.length > 0);
    } else if (kind === 'team_partnerships') {
      teamPartnershipsInningsId = payload?.inningsId?.trim() || null;
      ok =
        scorecard != null &&
        (() => {
          const innings =
            (teamPartnershipsInningsId
              ? findInningsByKey(scorecard, teamPartnershipsInningsId)
              : null) ?? resolveActiveInnings(scorecard);
          return innings != null && teamPartnershipStandRows(innings).length > 0;
        })();
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
    } else if (kind === 'playing_xi') {
      const painted = await showPlayingXi(playingXiCmd);
      if (!painted && activeKind === 'playing_xi') {
        activeKind = null;
        activePlayerId = null;
      }
    } else if (kind === 'batting_card') {
      const painted = await showBattingCard(true);
      if (!painted && activeKind === 'batting_card') {
        activeKind = null;
        activePlayerId = null;
      }
    } else if (kind === 'bowling_card') {
      if (!showBowlingCard(true) && activeKind === 'bowling_card') {
        activeKind = null;
        activePlayerId = null;
      }
    } else if (kind === 'partnership') {
      if (!showPartnership(true) && activeKind === 'partnership') {
        activeKind = null;
        activePlayerId = null;
      }
    } else if (kind === 'team_partnerships') {
      if (!showTeamPartnerships(true) && activeKind === 'team_partnerships') {
        activeKind = null;
        activePlayerId = null;
      }
    } else if (kind === 'fow') {
      if (!showLastWicket(true) && activeKind === 'fow') {
        activeKind = null;
        activePlayerId = null;
      }
    } else if (kind === 'innings_break') {
      inningsCmd = {
        view: parseInningsView(payload),
        inningsId: payload?.inningsId?.trim() || null,
        source: parseScorecardViewSource(payload?.source),
      };
      const painted = await showInningsBreak(inningsCmd.view);
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
        if (activeKind === 'playing_xi' && !playingXi?.show(matchCtx, {
          ...playingXiCmd,
          animate: false,
        })) {
          activeKind = null;
          activePlayerId = null;
        }
        if (activeKind === 'innings_break') {
          void showInningsBreak(inningsCmd.view).then((ok) => {
            if (!ok && activeKind === 'innings_break') {
              activeKind = null;
              activePlayerId = null;
            }
          });
        }
        if (activeKind === 'batting_card') {
          void showBattingCard(false).then((ok) => {
            if (!ok && activeKind === 'batting_card') {
              activeKind = null;
              activePlayerId = null;
            }
          });
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
      Boolean(batsmanCareer?.isOnAir()) ||
      Boolean(tossResult?.isOnAir()) ||
      Boolean(playingXi?.isOnAir()) ||
      Boolean(battingCard?.isOnAir()) ||
      Boolean(bowlingCard?.isOnAir()) ||
      Boolean(inningsCard?.isOnAir()),
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
        if (isPendingOverlayKind(cmd.graphic)) {
          return;
        }
        if (isTournamentOverlayKind(cmd.graphic)) {
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
