/**
 * Premium tournament total Fours / Sixes — compact navy card, bottom-right above strip.
 * Data: GET /tournaments/:id/stats aggregates (unchanged).
 */

import './tournament-stat-card.css';
import { concealGraphic, revealGraphic } from '../graphic-visibility';

export type TournamentStatKind = 'fours' | 'sixes';

export interface TournamentStatCardController {
  readonly host: HTMLElement;
  isOnAir(): boolean;
  hide(): void;
  show(kind: TournamentStatKind, total: number): boolean;
}

const SECTION_STAGGER_MS = 48;
const EXIT_MS = 300;

const DELAY = {
  id: 0,
  title: 48,
  value: 96,
  footer: 144,
} as const;

function warnGraphics(err: unknown): void {
  console.warn('[tournament-stat]', err);
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function titleFor(kind: TournamentStatKind): string {
  return kind === 'fours' ? 'Tournament Fours' : 'Tournament Sixes';
}

function buildMarkup(): string {
  return `
    <div class="panel panel-tournament-stat">
      <section
        class="ts-section ts-id-strip"
        data-ts-section="id"
        data-ts-delay="${DELAY.id}"
      >
        <p class="ts-id-left">ASC</p>
        <p class="ts-id-center">ASC LIVE</p>
        <p class="ts-id-right">TOURNAMENT</p>
      </section>
      <section
        class="ts-section ts-title-bar"
        data-ts-section="title"
        data-ts-delay="${DELAY.title}"
      >
        <p data-ts-title class="ts-title">Tournament Fours</p>
        <div class="ts-title-sweep" aria-hidden="true"></div>
      </section>
      <section
        class="ts-section ts-value-block"
        data-ts-section="value"
        data-ts-delay="${DELAY.value}"
      >
        <p data-ts-value class="ts-value">0</p>
      </section>
      <section
        class="ts-section ts-footer"
        data-ts-section="footer"
        data-ts-delay="${DELAY.footer}"
      >
        <p class="ts-footer-mark">ASC</p>
        <p class="ts-footer-brand">Cricket <span class="ts-footer-slash">/</span> ASC</p>
      </section>
    </div>
  `.trim();
}

export function mountTournamentStatCard(host: HTMLElement): TournamentStatCardController {
  let onAir = false;
  let animTimers: number[] = [];
  let exitTimer: number | null = null;

  const clearAnimTimers = (): void => {
    for (const id of animTimers) {
      window.clearTimeout(id);
    }
    animTimers = [];
    if (exitTimer != null) {
      window.clearTimeout(exitTimer);
      exitTimer = null;
    }
  };

  const panel = (): HTMLElement | null =>
    host.querySelector('.panel-tournament-stat');

  const ensureMarkup = (): HTMLElement | null => {
    // Rebuild legacy bright-blue t1-stat markup (or missing premium shell).
    const needsRebuild =
      host.querySelector('.t1-stat-panel') != null ||
      host.querySelector('.t1-stat-kind') != null ||
      host.querySelector('.panel-tournament-stat .ts-title') == null;
    if (needsRebuild) {
      host.innerHTML = buildMarkup();
    }
    // Same BR placement as Fours — always force (covers pre-fix centered hosts).
    host.classList.add('tournament-stat-graphic', 't1-tournament-graphic');
    host.classList.remove('graphic-centered');
    return panel();
  };

  const runEntrance = (p: HTMLElement): void => {
    clearAnimTimers();
    const sections = [...p.querySelectorAll<HTMLElement>('.ts-section')];
    if (prefersReducedMotion() || sections.length === 0) {
      p.classList.add('ts-entering');
      for (const section of sections) {
        section.classList.add('ts-section-visible');
      }
      return;
    }
    p.classList.remove('ts-exiting');
    p.classList.add('ts-entering');
    for (const section of sections) {
      section.classList.remove('ts-section-visible');
    }
    for (const section of sections) {
      const raw = section.getAttribute('data-ts-delay');
      const delay = raw != null ? Number(raw) : SECTION_STAGGER_MS;
      const id = window.setTimeout(() => {
        section.classList.add('ts-section-visible');
      }, Number.isFinite(delay) ? delay : SECTION_STAGGER_MS);
      animTimers.push(id);
    }
  };

  const hideNode = (): void => {
    clearAnimTimers();
    onAir = false;
    const p = panel();
    if (p && !prefersReducedMotion()) {
      p.classList.add('ts-exiting');
      p.classList.remove('ts-entering');
      for (const section of p.querySelectorAll('.ts-section')) {
        section.classList.remove('ts-section-visible');
      }
      exitTimer = window.setTimeout(() => {
        exitTimer = null;
        concealGraphic(host);
        p.classList.remove('ts-exiting');
      }, EXIT_MS);
      return;
    }
    concealGraphic(host);
  };

  const paint = (kind: TournamentStatKind, total: number): boolean => {
    const p = ensureMarkup();
    const titleEl = host.querySelector('[data-ts-title]');
    const valueEl = host.querySelector('[data-ts-value]');
    if (!(p instanceof HTMLElement) || !(titleEl instanceof HTMLElement) || !(valueEl instanceof HTMLElement)) {
      return false;
    }
    titleEl.textContent = titleFor(kind);
    valueEl.textContent = String(Math.max(0, Math.floor(total)));
    return true;
  };

  // Lock BR host classes at mount so Sixes matches Fours before first Show.
  ensureMarkup();

  return {
    host,
    isOnAir: () => onAir,
    hide: hideNode,
    show(kind, total) {
      try {
        clearAnimTimers();
        if (!paint(kind, total)) {
          hideNode();
          return false;
        }
        const p = panel();
        if (!p) {
          hideNode();
          return false;
        }
        onAir = true;
        revealGraphic(host);
        runEntrance(p);
        return true;
      } catch (err) {
        warnGraphics(err);
        hideNode();
        return false;
      }
    },
  };
}
