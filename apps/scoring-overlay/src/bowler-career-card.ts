/**
 * Premium BOWLER CAREER PROFILE — career aggregates from broadcast-stats.
 *
 * Isolation: fetch/render paths are try/catch'd so a graphics error never
 * breaks the strip.
 */

import './bowler-career-card.css';
import { fetchBroadcastPlayerStats } from './broadcast-fetch';
import { concealGraphic, revealGraphic } from './graphic-visibility';
import {
  formatStat,
  hasBowlerCareerStats,
  isUuid,
} from './graphics-format';
import type { BallType, BroadcastPlayerStatsView } from './types';

const SECTION_STAGGER_MS = 45;
const EXIT_MS = 320;

export interface BowlerCareerShowOptions {
  apiBase: string;
  ballType: BallType;
  /** Optional display name while / if stats load (e.g. from scorecard). */
  placeholderName?: string;
  /** Current-match team label for header chrome (not career-scoped). */
  teamName?: string | null;
}

export interface BowlerCareerCardController {
  readonly host: HTMLElement;
  isOnAir(): boolean;
  hide(): void;
  /**
   * Fetch career stats and show the card. Returns false when there is nothing
   * useful to put on air (caller should clear on-air state).
   */
  show(playerId: string, opts: BowlerCareerShowOptions): Promise<boolean>;
}

function warnGraphics(err: unknown): void {
  console.warn('[bowler-career]', err);
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

function bowlingStyleLabel(style: string | null | undefined): string | null {
  if (style === 'PACE') {
    return 'Pace';
  }
  if (style === 'SPIN') {
    return 'Spin';
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

function bestText(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed || '—';
}

function buildCardMarkup(): string {
  return `
    <div class="panel panel-bowler-career">
      <section class="bwc-section bwc-id-strip" data-bwc-section="id">
        <p data-bwc="id-line" class="bwc-id-line">BOWLER CAREER PROFILE</p>
      </section>
      <section class="bwc-section bwc-header" data-bwc-section="header">
        <div class="bwc-header-copy">
          <p class="bwc-kicker">Career profile</p>
          <p class="bwc-title">Bowler Career Profile</p>
          <p data-bwc="name" class="bwc-player-name">—</p>
          <p data-bwc="meta" class="bwc-meta-line">—</p>
        </div>
        <div class="bwc-header-aside">
          <div class="bwc-runs-block">
            <p class="bwc-runs-label">Career wickets</p>
            <p data-bwc="career-wickets" class="bwc-runs-value">—</p>
          </div>
          <p data-bwc="format-badge" class="bwc-format-badge">—</p>
        </div>
        <div class="bwc-header-sweep" aria-hidden="true"></div>
      </section>
      <div class="bwc-stats-row" role="group" aria-label="Career bowling summary">
        <section class="bwc-section bwc-cell is-edge" data-bwc-section="matches">
          <p class="bwc-cell-label">Matches</p>
          <p data-bwc="matches" class="bwc-cell-value">—</p>
        </section>
        <section class="bwc-section bwc-cell is-alt" data-bwc-section="innings">
          <p class="bwc-cell-label">Innings</p>
          <p data-bwc="innings" class="bwc-cell-value">—</p>
        </section>
        <section class="bwc-section bwc-cell is-accent" data-bwc-section="wickets">
          <p class="bwc-cell-label">Wickets</p>
          <p data-bwc="wickets" class="bwc-cell-value">—</p>
        </section>
        <section class="bwc-section bwc-cell is-alt" data-bwc-section="best">
          <p class="bwc-cell-label">Best</p>
          <p data-bwc="best" class="bwc-cell-value">—</p>
        </section>
        <section class="bwc-section bwc-cell is-gold-edge" data-bwc-section="avg">
          <p class="bwc-cell-label">Average</p>
          <p data-bwc="avg" class="bwc-cell-value">—</p>
        </section>
      </div>
      <div class="bwc-stats-row is-second" role="group" aria-label="Career bowling rates">
        <section class="bwc-section bwc-cell is-edge" data-bwc-section="econ">
          <p class="bwc-cell-label">Economy</p>
          <p data-bwc="econ" class="bwc-cell-value">—</p>
        </section>
        <section class="bwc-section bwc-cell is-alt" data-bwc-section="sr">
          <p class="bwc-cell-label">Strike rate</p>
          <p data-bwc="sr" class="bwc-cell-value">—</p>
        </section>
        <section class="bwc-section bwc-cell" data-bwc-section="three-wkt">
          <p class="bwc-cell-label">3-Wkt</p>
          <p data-bwc="three-wkt" class="bwc-cell-value">—</p>
        </section>
        <section class="bwc-section bwc-cell is-alt" data-bwc-section="five-wkt">
          <p class="bwc-cell-label">5-Wkt</p>
          <p data-bwc="five-wkt" class="bwc-cell-value">—</p>
        </section>
        <section class="bwc-section bwc-cell is-gold-edge" data-bwc-section="runs">
          <p class="bwc-cell-label">Runs</p>
          <p data-bwc="runs" class="bwc-cell-value">—</p>
        </section>
      </div>
      <section class="bwc-section bwc-footer" data-bwc-section="footer">
        <p class="bwc-footer-mark">ASC</p>
        <p data-bwc="footer-note" class="bwc-footer-note"></p>
      </section>
    </div>
  `.trim();
}

function metaLine(
  teamName: string | null | undefined,
  bowlingStyle: string | null | undefined,
): string {
  const parts = [
    teamName?.trim() || null,
    bowlingStyleLabel(bowlingStyle),
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(' · ') : '—';
}

/**
 * Mount the bowler career card into `host`.
 * graphics.html / stage: host should use `.graphic.bowler-career-graphic`.
 */
export function mountBowlerCareerCard(
  host: HTMLElement,
): BowlerCareerCardController {
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
    host.querySelector('.panel-bowler-career');

  const ensureMarkup = (): void => {
    if (!host.querySelector('.panel-bowler-career')) {
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
      p.classList.remove('bwc-exiting', 'bwc-entering');
      for (const section of p.querySelectorAll('.bwc-section')) {
        section.classList.remove('bwc-section-visible');
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
    const sections = [...p.querySelectorAll<HTMLElement>('.bwc-section')];
    if (prefersReducedMotion()) {
      p.classList.add('bwc-entering');
      for (const section of sections) {
        section.classList.add('bwc-section-visible');
      }
      return;
    }
    p.classList.remove('bwc-exiting');
    p.classList.add('bwc-entering');
    for (const section of sections) {
      section.classList.remove('bwc-section-visible');
    }
    sections.forEach((section, index) => {
      const delay = index * SECTION_STAGGER_MS;
      const timer = window.setTimeout(() => {
        if (gen !== motionGen) {
          return;
        }
        section.classList.add('bwc-section-visible');
      }, delay);
      entranceTimers.push(timer);
    });
    const sweep = p.querySelector<HTMLElement>('.bwc-header-sweep');
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
    const idLine = qs<HTMLElement>('[data-bwc="id-line"]');
    const name = qs<HTMLElement>('[data-bwc="name"]');
    const meta = qs<HTMLElement>('[data-bwc="meta"]');
    const careerWickets = qs<HTMLElement>('[data-bwc="career-wickets"]');
    const formatBadge = qs<HTMLElement>('[data-bwc="format-badge"]');
    const matches = qs<HTMLElement>('[data-bwc="matches"]');
    const innings = qs<HTMLElement>('[data-bwc="innings"]');
    const wickets = qs<HTMLElement>('[data-bwc="wickets"]');
    const best = qs<HTMLElement>('[data-bwc="best"]');
    const avg = qs<HTMLElement>('[data-bwc="avg"]');
    const econ = qs<HTMLElement>('[data-bwc="econ"]');
    const sr = qs<HTMLElement>('[data-bwc="sr"]');
    const threeWkt = qs<HTMLElement>('[data-bwc="three-wkt"]');
    const fiveWkt = qs<HTMLElement>('[data-bwc="five-wkt"]');
    const runs = qs<HTMLElement>('[data-bwc="runs"]');
    const footerNote = qs<HTMLElement>('[data-bwc="footer-note"]');

    if (
      !idLine ||
      !name ||
      !meta ||
      !careerWickets ||
      !formatBadge ||
      !matches ||
      !innings ||
      !wickets ||
      !best ||
      !avg ||
      !econ ||
      !sr ||
      !threeWkt ||
      !fiveWkt ||
      !runs ||
      !footerNote
    ) {
      return false;
    }

    const display = playerDisplayName(stats);
    idLine.textContent = `${formatLabel(stats.ballType)} · ${display.toUpperCase()}`;
    name.textContent = display;
    meta.textContent = metaLine(teamName, stats.bowlingStyle);
    careerWickets.textContent = countText(stats.wickets);
    formatBadge.textContent = formatBadgeText(stats.ballType);

    matches.textContent = countText(stats.matches);
    innings.textContent = countText(stats.bowlingInnings);
    wickets.textContent = countText(stats.wickets);
    best.textContent = bestText(stats.bestBowling);
    avg.textContent = avgText(stats.bowlingAverage);
    econ.textContent = avgText(stats.economy);
    sr.textContent = avgText(stats.bowlingStrikeRate);
    threeWkt.textContent = countText(stats.threeWicketHauls);
    fiveWkt.textContent = countText(stats.fiveWicketHauls);
    runs.textContent = countText(stats.bowlingRunsConceded);

    const bestLine = bestText(stats.bestBowling);
    footerNote.textContent =
      bestLine !== '—'
        ? `Best ${bestLine} · ${formatLabel(stats.ballType)}`
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
      p.classList.add('bwc-exiting');
      p.classList.remove('bwc-entering');
      for (const section of p.querySelectorAll('.bwc-section')) {
        section.classList.remove('bwc-section-visible');
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
      p.classList.add('bwc-entering');
      for (const section of p.querySelectorAll('.bwc-section')) {
        section.classList.add('bwc-section-visible');
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
        if (
          !stats ||
          !hasBowlerCareerStats(stats) ||
          !paint(stats, lastTeamName)
        ) {
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
