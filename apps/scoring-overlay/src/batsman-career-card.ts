/**
 * Premium BATTER CAREER PROFILE — career aggregates from broadcast-stats.
 *
 * Isolation: fetch/render paths are try/catch'd so a graphics error never
 * breaks the strip.
 */

import './batsman-career-card.css';
import { fetchBroadcastPlayerStats } from './broadcast-fetch';
import { concealGraphic, revealGraphic } from './graphic-visibility';
import {
  formatHighestScoreMeta,
  formatStat,
  hasBatsmanCareerStats,
  isUuid,
} from './graphics-format';
import type { BallType, BroadcastPlayerStatsView } from './types';

const SECTION_STAGGER_MS = 45;
const EXIT_MS = 320;

export interface BatsmanCareerShowOptions {
  apiBase: string;
  ballType: BallType;
  /** Optional display name while / if stats load (e.g. from scorecard). */
  placeholderName?: string;
  /** Current-match team label for header chrome (not career-scoped). */
  teamName?: string | null;
}

export interface BatsmanCareerCardController {
  readonly host: HTMLElement;
  isOnAir(): boolean;
  hide(): void;
  /**
   * Fetch career stats and show the card. Returns false when there is nothing
   * useful to put on air (caller should clear on-air state).
   */
  show(playerId: string, opts: BatsmanCareerShowOptions): Promise<boolean>;
}

function warnGraphics(err: unknown): void {
  console.warn('[batsman-career]', err);
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function formatLabel(ballType: BallType | string | null | undefined): string {
  if (ballType === 'LEATHER') {
    return 'LEATHER CAREER';
  }
  if (ballType === 'TENNIS') {
    return 'TENNIS CAREER';
  }
  return 'CAREER';
}

function formatBadgeText(ballType: BallType | string | null | undefined): string {
  if (ballType === 'LEATHER') {
    return 'LEATHER';
  }
  if (ballType === 'TENNIS') {
    return 'TENNIS';
  }
  return 'CAREER';
}

function battingStyleLabel(style: string | null | undefined): string | null {
  if (style === 'RHB') {
    return 'Right Hand Batsman';
  }
  if (style === 'LHB') {
    return 'Left Hand Batsman';
  }
  const trimmed = style?.trim();
  return trimmed || null;
}

function playerDisplayName(stats: BroadcastPlayerStatsView): string {
  return `${stats.firstName ?? ''} ${stats.lastName ?? ''}`.trim() || '—';
}

function countText(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? String(value)
    : '—';
}

function avgText(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? formatStat(value, 2)
    : '—';
}

function srText(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? formatStat(value, 1)
    : '—';
}

function hsText(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed || '—';
}

function buildCardMarkup(): string {
  return `
    <div class="panel panel-batsman-career">
      <section class="bc-section bc-id-strip" data-bc-section="id">
        <p data-bc="id-line" class="bc-id-line">BATTER CAREER PROFILE</p>
      </section>
      <section class="bc-section bc-header" data-bc-section="header">
        <div class="bc-header-copy">
          <p class="bc-kicker">Career profile</p>
          <p class="bc-title">Batter Career Profile</p>
          <p data-bc="name" class="bc-player-name">—</p>
          <p data-bc="meta" class="bc-meta-line">—</p>
        </div>
        <div class="bc-header-aside">
          <div class="bc-runs-block">
            <p class="bc-runs-label">Career runs</p>
            <p data-bc="career-runs" class="bc-runs-value">—</p>
          </div>
          <p data-bc="format-badge" class="bc-format-badge">—</p>
        </div>
        <div class="bc-header-sweep" aria-hidden="true"></div>
      </section>
      <div class="bc-stats-row" role="group" aria-label="Career batting summary">
        <section class="bc-section bc-cell is-edge" data-bc-section="matches">
          <p class="bc-cell-label">Matches</p>
          <p data-bc="matches" class="bc-cell-value">—</p>
        </section>
        <section class="bc-section bc-cell is-alt" data-bc-section="innings">
          <p class="bc-cell-label">Innings</p>
          <p data-bc="innings" class="bc-cell-value">—</p>
        </section>
        <section class="bc-section bc-cell is-accent" data-bc-section="hs">
          <p class="bc-cell-label">Highest score</p>
          <p data-bc="hs" class="bc-cell-value">—</p>
        </section>
        <section class="bc-section bc-cell is-alt" data-bc-section="avg">
          <p class="bc-cell-label">Average</p>
          <p data-bc="avg" class="bc-cell-value">—</p>
        </section>
        <section class="bc-section bc-cell is-gold-edge" data-bc-section="sr">
          <p class="bc-cell-label">Strike rate</p>
          <p data-bc="sr" class="bc-cell-value">—</p>
        </section>
      </div>
      <div class="bc-stats-row is-second" role="group" aria-label="Career milestones">
        <section class="bc-section bc-cell is-edge" data-bc-section="hundreds">
          <p class="bc-cell-label">Hundreds</p>
          <p data-bc="hundreds" class="bc-cell-value">—</p>
        </section>
        <section class="bc-section bc-cell is-alt" data-bc-section="fifties">
          <p class="bc-cell-label">Fifties</p>
          <p data-bc="fifties" class="bc-cell-value">—</p>
        </section>
        <section class="bc-section bc-cell" data-bc-section="fours">
          <p class="bc-cell-label">Fours</p>
          <p data-bc="fours" class="bc-cell-value">—</p>
        </section>
        <section class="bc-section bc-cell is-alt" data-bc-section="sixes">
          <p class="bc-cell-label">Sixes</p>
          <p data-bc="sixes" class="bc-cell-value">—</p>
        </section>
        <section class="bc-section bc-cell is-gold-edge" data-bc-section="not-outs">
          <p class="bc-cell-label">Not outs</p>
          <p data-bc="not-outs" class="bc-cell-value">—</p>
        </section>
      </div>
      <section class="bc-section bc-footer" data-bc-section="footer">
        <p class="bc-footer-mark">ASC</p>
        <p data-bc="footer-note" class="bc-footer-note"></p>
      </section>
    </div>
  `.trim();
}

function metaLine(
  teamName: string | null | undefined,
  battingStyle: string | null | undefined,
): string {
  const parts = [
    teamName?.trim() || null,
    battingStyleLabel(battingStyle),
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(' · ') : '—';
}

/**
 * Mount the batsman career card into `host`.
 * Root strip: host should use `.batsman-career-layer`.
 * graphics.html: host should use `.graphic.batsman-career-graphic`.
 */
export function mountBatsmanCareerCard(
  host: HTMLElement,
): BatsmanCareerCardController {
  try {
    host.innerHTML = buildCardMarkup();
    host.setAttribute('aria-live', 'polite');
  } catch (err) {
    warnGraphics(err);
    host.innerHTML = '';
  }

  let onAir = false;
  let token = 0;
  let motionGen = 0;
  let exitTimer: number | null = null;
  const entranceTimers: number[] = [];
  const cache = new Map<string, BroadcastPlayerStatsView | null>();
  let lastTeamName: string | null = null;

  const qs = <T extends HTMLElement>(selector: string): T | null =>
    host.querySelector(selector) as T | null;

  const panel = (): HTMLElement | null =>
    host.querySelector('.panel-batsman-career');

  const ensureMarkup = (): void => {
    if (!host.querySelector('.panel-batsman-career')) {
      host.innerHTML = buildCardMarkup();
    }
  };

  const cancelMotion = (): void => {
    motionGen += 1;
    for (const t of entranceTimers) {
      window.clearTimeout(t);
    }
    entranceTimers.length = 0;
    if (exitTimer != null) {
      window.clearTimeout(exitTimer);
      exitTimer = null;
    }
    const p = panel();
    if (p) {
      p.classList.remove('bc-exiting', 'bc-entering');
      for (const section of p.querySelectorAll('.bc-section')) {
        section.classList.remove('bc-section-visible');
      }
    }
  };

  const runEntrance = (): void => {
    cancelMotion();
    const p = panel();
    if (!p) {
      return;
    }
    const gen = motionGen;
    const sections = [...p.querySelectorAll<HTMLElement>('.bc-section')];
    if (prefersReducedMotion()) {
      p.classList.add('bc-entering');
      for (const section of sections) {
        section.classList.add('bc-section-visible');
      }
      return;
    }
    p.classList.remove('bc-exiting');
    p.classList.add('bc-entering');
    for (const section of sections) {
      section.classList.remove('bc-section-visible');
    }
    sections.forEach((section, index) => {
      const delay = index * SECTION_STAGGER_MS;
      const timer = window.setTimeout(() => {
        if (gen !== motionGen) {
          return;
        }
        section.classList.add('bc-section-visible');
      }, delay);
      entranceTimers.push(timer);
    });
    const sweep = p.querySelector<HTMLElement>('.bc-header-sweep');
    if (sweep) {
      sweep.style.animation = 'none';
      void sweep.offsetWidth;
      sweep.style.animation = '';
    }
  };

  const paint = (
    stats: BroadcastPlayerStatsView,
    teamName: string | null | undefined,
  ): boolean => {
    ensureMarkup();
    const idLine = qs<HTMLElement>('[data-bc="id-line"]');
    const name = qs<HTMLElement>('[data-bc="name"]');
    const meta = qs<HTMLElement>('[data-bc="meta"]');
    const careerRuns = qs<HTMLElement>('[data-bc="career-runs"]');
    const formatBadge = qs<HTMLElement>('[data-bc="format-badge"]');
    const matches = qs<HTMLElement>('[data-bc="matches"]');
    const innings = qs<HTMLElement>('[data-bc="innings"]');
    const hs = qs<HTMLElement>('[data-bc="hs"]');
    const avg = qs<HTMLElement>('[data-bc="avg"]');
    const sr = qs<HTMLElement>('[data-bc="sr"]');
    const hundreds = qs<HTMLElement>('[data-bc="hundreds"]');
    const fifties = qs<HTMLElement>('[data-bc="fifties"]');
    const fours = qs<HTMLElement>('[data-bc="fours"]');
    const sixes = qs<HTMLElement>('[data-bc="sixes"]');
    const notOuts = qs<HTMLElement>('[data-bc="not-outs"]');
    const footerNote = qs<HTMLElement>('[data-bc="footer-note"]');

    if (
      !idLine ||
      !name ||
      !meta ||
      !careerRuns ||
      !formatBadge ||
      !matches ||
      !innings ||
      !hs ||
      !avg ||
      !sr ||
      !hundreds ||
      !fifties ||
      !fours ||
      !sixes ||
      !notOuts ||
      !footerNote
    ) {
      return false;
    }

    const display = playerDisplayName(stats);
    idLine.textContent = `${formatLabel(stats.ballType)} · ${display.toUpperCase()}`;
    name.textContent = display;
    meta.textContent = metaLine(teamName, stats.battingStyle);
    careerRuns.textContent = countText(stats.runs);
    formatBadge.textContent = formatBadgeText(stats.ballType);

    matches.textContent = countText(stats.matches);
    innings.textContent = countText(stats.battingInnings);
    hs.textContent = hsText(stats.highestScore);
    avg.textContent = avgText(stats.average);
    sr.textContent = srText(stats.strikeRate);
    hundreds.textContent = countText(stats.hundreds);
    fifties.textContent = countText(stats.fifties);
    fours.textContent = countText(stats.fours);
    sixes.textContent = countText(stats.sixes);
    notOuts.textContent = countText(stats.notOuts);

    const hsMeta = formatHighestScoreMeta(stats);
    footerNote.textContent = hsMeta
      ? `Highest ${hsText(stats.highestScore)} · ${hsMeta}`
      : formatLabel(stats.ballType);
    return true;
  };

  const hideNode = (): void => {
    cancelMotion();
    onAir = false;
    const p = panel();
    const reduced = prefersReducedMotion();
    const ms = reduced ? 0 : EXIT_MS;

    if (p && !reduced) {
      p.classList.add('bc-exiting');
      p.classList.remove('bc-entering');
      for (const section of p.querySelectorAll('.bc-section')) {
        section.classList.remove('bc-section-visible');
      }
    }

    host.classList.remove('is-visible');
    exitTimer = window.setTimeout(() => {
      exitTimer = null;
      concealGraphic(host);
    }, ms);
  };

  const reveal = (animate: boolean): void => {
    revealGraphic(host);
    if (animate) {
      requestAnimationFrame(() => runEntrance());
      return;
    }
    const p = panel();
    if (p) {
      p.classList.add('bc-entering');
      for (const section of p.querySelectorAll('.bc-section')) {
        section.classList.add('bc-section-visible');
      }
    }
  };

  return {
    host,
    isOnAir: () => onAir,
    hide: () => {
      try {
        token += 1;
        hideNode();
      } catch (err) {
        warnGraphics(err);
        onAir = false;
        host.hidden = true;
        host.classList.remove('is-visible');
      }
    },
    async show(playerId, opts) {
      try {
        if (!isUuid(playerId)) {
          hideNode();
          return false;
        }

        lastTeamName = opts.teamName?.trim() || null;
        const request = ++token;
        const key = `${playerId}:${opts.ballType}`;
        let stats: BroadcastPlayerStatsView | null;
        if (cache.has(key)) {
          stats = cache.get(key) ?? null;
        } else {
          try {
            stats = await fetchBroadcastPlayerStats(
              opts.apiBase,
              playerId,
              opts.ballType,
            );
          } catch (err) {
            warnGraphics(err);
            stats = null;
          }
          cache.set(key, stats);
        }

        if (request !== token) {
          return false;
        }
        if (!stats || !hasBatsmanCareerStats(stats) || !paint(stats, lastTeamName)) {
          hideNode();
          return false;
        }
        onAir = true;
        reveal(true);
        return true;
      } catch (err) {
        warnGraphics(err);
        try {
          hideNode();
        } catch (hideErr) {
          warnGraphics(hideErr);
          onAir = false;
          host.hidden = true;
          host.classList.remove('is-visible');
        }
        return false;
      }
    },
  };
}
