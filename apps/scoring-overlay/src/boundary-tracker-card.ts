/**
 * Premium BOUNDARY TRACKER — auto-shows on live 4/6, innings totals from /live.
 * Independent of OBS boundary-clip capture (same delivery, separate path).
 */

import './boundary-tracker-card.css';
import { resolveActiveInnings } from './graphics-format';
import { concealGraphic, revealGraphic } from './graphic-visibility';
import type { InningsScorecard, ScorecardResponse } from './types';

export const BOUNDARY_TRACKER_AUTO_HIDE_MS = 7_000;
const COUNT_REVEAL_DELAY_MS = 140;
const EXIT_MS = 300;

export type BoundaryKind = 'four' | 'six';

export interface BoundaryTrackerPayload {
  kind: BoundaryKind;
  fours: number;
  sixes: number;
}

export interface BoundaryTrackerController {
  host: HTMLElement;
  isOnAir: () => boolean;
  hide: () => void;
  /** Show or restart on a scored 4/6 with live innings totals. */
  show: (payload: BoundaryTrackerPayload) => boolean;
}

function warnGraphics(err: unknown): void {
  console.warn('[boundary-tracker]', err);
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function pad2(n: number): string {
  const v = Math.max(0, Math.floor(n));
  return v < 10 ? `0${v}` : String(v);
}

/** Sum of batter fours/sixes for one innings (strip uses the same). */
export function inningsBoundaryTotals(innings: InningsScorecard): {
  fours: number;
  sixes: number;
} {
  let fours = 0;
  let sixes = 0;
  for (const b of innings.batters) {
    fours += b.fours ?? 0;
    sixes += b.sixes ?? 0;
  }
  return { fours, sixes };
}

/**
 * Detect a newly scored 4 or 6 by comparing consecutive live scorecards.
 * Uses innings fours/sixes deltas (not timeline.runs — nb+4 totals can differ).
 */
export function detectBoundaryAnnouncement(
  prev: ScorecardResponse | null,
  next: ScorecardResponse | null,
): BoundaryTrackerPayload | null {
  if (!next) {
    return null;
  }
  const nextInn = resolveActiveInnings(next);
  if (!nextInn) {
    return null;
  }
  const nextTotals = inningsBoundaryTotals(nextInn);
  const prevInn = prev ? resolveActiveInnings(prev) : null;

  if (!prevInn || prevInn.inningsId !== nextInn.inningsId) {
    // New innings / first paint — only fire if last ball is a boundary and totals > 0.
    const last = nextInn.timeline?.[nextInn.timeline.length - 1];
    if (!last?.isBoundary) {
      return null;
    }
    if (nextTotals.sixes > 0 && (last.code === '6' || last.code.endsWith('+6'))) {
      return { kind: 'six', ...nextTotals };
    }
    if (nextTotals.fours > 0 && (last.code === '4' || last.code.endsWith('+4'))) {
      return { kind: 'four', ...nextTotals };
    }
    if (nextTotals.sixes > 0 && nextTotals.fours === 0) {
      return { kind: 'six', ...nextTotals };
    }
    if (nextTotals.fours > 0) {
      return { kind: 'four', ...nextTotals };
    }
    return null;
  }

  const prevTotals = inningsBoundaryTotals(prevInn);
  const d4 = nextTotals.fours - prevTotals.fours;
  const d6 = nextTotals.sixes - prevTotals.sixes;
  if (d6 > 0) {
    return { kind: 'six', ...nextTotals };
  }
  if (d4 > 0) {
    return { kind: 'four', ...nextTotals };
  }
  return null;
}

function buildMarkup(): string {
  return `
    <div class="panel panel-boundary-tracker">
      <section class="bt-section bt-id-strip" data-bt-section="id">
        <p class="bt-id-line">BOUNDARY TRACKER</p>
      </section>
      <section class="bt-section bt-announce" data-bt-section="announce">
        <div data-bt-badge class="bt-badge">4</div>
        <div class="bt-announce-copy">
          <p data-bt-title class="bt-announce-title">FOUR</p>
          <p data-bt-caption class="bt-announce-caption">Innings boundaries</p>
        </div>
      </section>
      <section class="bt-section bt-counters" data-bt-section="counters">
        <div data-bt-cell="fours" class="bt-counter">
          <p class="bt-counter-label">Fours</p>
          <p data-bt-fours class="bt-counter-value">00</p>
        </div>
        <div data-bt-cell="sixes" class="bt-counter">
          <p class="bt-counter-label">Sixes</p>
          <p data-bt-sixes class="bt-counter-value">00</p>
        </div>
      </section>
    </div>
  `.trim();
}

export function mountBoundaryTrackerCard(
  host: HTMLElement,
): BoundaryTrackerController {
  let onAir = false;
  let motionGen = 0;
  let exitTimer: number | null = null;
  let hideTimer: number | null = null;
  const entranceTimers: number[] = [];

  const qs = <T extends HTMLElement>(selector: string): T | null =>
    host.querySelector(selector) as T | null;

  const panel = (): HTMLElement | null =>
    host.querySelector('.panel-boundary-tracker');

  const ensureMarkup = (): void => {
    if (!host.querySelector('.panel-boundary-tracker')) {
      host.innerHTML = buildMarkup();
    }
  };

  const clearEntranceTimers = (): void => {
    for (const t of entranceTimers) {
      window.clearTimeout(t);
    }
    entranceTimers.length = 0;
  };

  const clearHideTimer = (): void => {
    if (hideTimer != null) {
      window.clearTimeout(hideTimer);
      hideTimer = null;
    }
  };

  const cancelMotion = (): void => {
    motionGen += 1;
    clearEntranceTimers();
    if (exitTimer != null) {
      window.clearTimeout(exitTimer);
      exitTimer = null;
    }
    const p = panel();
    if (p) {
      p.classList.remove('bt-exiting', 'bt-entering');
      for (const section of p.querySelectorAll('.bt-section')) {
        section.classList.remove('bt-section-visible');
      }
      for (const value of p.querySelectorAll('.bt-counter-value')) {
        value.classList.remove('bt-count-visible');
      }
    }
    host.classList.remove('is-exiting');
  };

  const paint = (payload: BoundaryTrackerPayload): boolean => {
    ensureMarkup();
    const p = panel();
    const badge = qs<HTMLElement>('[data-bt-badge]');
    const title = qs<HTMLElement>('[data-bt-title]');
    const caption = qs<HTMLElement>('[data-bt-caption]');
    const foursEl = qs<HTMLElement>('[data-bt-fours]');
    const sixesEl = qs<HTMLElement>('[data-bt-sixes]');
    const foursCell = qs<HTMLElement>('[data-bt-cell="fours"]');
    const sixesCell = qs<HTMLElement>('[data-bt-cell="sixes"]');
    if (
      !p ||
      !badge ||
      !title ||
      !caption ||
      !foursEl ||
      !sixesEl ||
      !foursCell ||
      !sixesCell
    ) {
      return false;
    }

    const isSix = payload.kind === 'six';
    p.classList.toggle('is-six', isSix);
    p.classList.toggle('is-four', !isSix);
    badge.textContent = isSix ? '6' : '4';
    title.textContent = isSix ? 'SIX' : 'FOUR';
    caption.textContent = isSix ? 'Maximum' : 'Boundary';
    foursEl.textContent = pad2(payload.fours);
    sixesEl.textContent = pad2(payload.sixes);
    foursCell.classList.toggle('is-active', !isSix);
    sixesCell.classList.toggle('is-active', isSix);
    return true;
  };

  const runEntrance = (payload: BoundaryTrackerPayload): void => {
    cancelMotion();
    const p = panel();
    if (!p) {
      return;
    }
    const gen = motionGen;
    const sections = [...p.querySelectorAll<HTMLElement>('.bt-section')];
    const activeValue =
      payload.kind === 'six'
        ? qs<HTMLElement>('[data-bt-sixes]')
        : qs<HTMLElement>('[data-bt-fours]');
    const otherValue =
      payload.kind === 'six'
        ? qs<HTMLElement>('[data-bt-fours]')
        : qs<HTMLElement>('[data-bt-sixes]');

    if (prefersReducedMotion()) {
      p.classList.add('bt-entering');
      for (const section of sections) {
        section.classList.add('bt-section-visible');
      }
      activeValue?.classList.add('bt-count-visible');
      otherValue?.classList.add('bt-count-visible');
      return;
    }

    p.classList.remove('bt-exiting');
    p.classList.add('bt-entering');
    for (const section of sections) {
      section.classList.remove('bt-section-visible');
    }
    for (const value of p.querySelectorAll('.bt-counter-value')) {
      value.classList.remove('bt-count-visible');
    }

    sections.forEach((section, index) => {
      const timer = window.setTimeout(() => {
        if (gen !== motionGen) {
          return;
        }
        section.classList.add('bt-section-visible');
      }, index * 45);
      entranceTimers.push(timer);
    });

    // Both totals visible; active count uses the delayed lift.
    const otherTimer = window.setTimeout(() => {
      if (gen !== motionGen) {
        return;
      }
      otherValue?.classList.add('bt-count-visible');
    }, COUNT_REVEAL_DELAY_MS);
    entranceTimers.push(otherTimer);

    const activeTimer = window.setTimeout(() => {
      if (gen !== motionGen) {
        return;
      }
      activeValue?.classList.add('bt-count-visible');
    }, COUNT_REVEAL_DELAY_MS + 40);
    entranceTimers.push(activeTimer);
  };

  const armAutoHide = (): void => {
    clearHideTimer();
    hideTimer = window.setTimeout(() => {
      hideTimer = null;
      hideNode();
    }, BOUNDARY_TRACKER_AUTO_HIDE_MS);
  };

  const hideNode = (): void => {
    clearHideTimer();
    cancelMotion();
    onAir = false;
    const p = panel();
    const reduced = prefersReducedMotion();
    const ms = reduced ? 0 : EXIT_MS;

    if (p && !reduced) {
      p.classList.add('bt-exiting');
      p.classList.remove('bt-entering');
      for (const section of p.querySelectorAll('.bt-section')) {
        section.classList.remove('bt-section-visible');
      }
    }
    host.classList.add('is-exiting');
    host.classList.remove('is-visible');
    exitTimer = window.setTimeout(() => {
      exitTimer = null;
      host.classList.remove('is-exiting');
      concealGraphic(host);
    }, ms);
  };

  return {
    host,
    isOnAir: () => onAir,
    hide() {
      try {
        hideNode();
      } catch (err) {
        warnGraphics(err);
        onAir = false;
        host.hidden = true;
        host.classList.remove('is-visible', 'is-exiting');
      }
    },
    show(payload) {
      try {
        if (!paint(payload)) {
          hideNode();
          return false;
        }
        onAir = true;
        host.classList.remove('is-exiting');
        revealGraphic(host);
        requestAnimationFrame(() => runEntrance(payload));
        armAutoHide();
        return true;
      } catch (err) {
        warnGraphics(err);
        hideNode();
        return false;
      }
    },
  };
}
