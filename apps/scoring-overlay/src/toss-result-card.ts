/**
 * Premium TOSS RESULT card — navy/blue/gold package, live MatchContext only.
 * Distinct from the strip bowler-slot toss flip.
 */

import './toss-result-card.css';
import { concealGraphic, revealGraphic } from './graphic-visibility';
import type { MatchContext } from './types';
import { formatTossLine, teamInitials } from './view-model';

const SECTION_STAGGER_MS = 45;
const EXIT_MS = 320;

export interface TossResultShowOptions {
  /** When false, repaint without replaying entrance (match-context refresh). */
  animate?: boolean;
}

export interface TossResultCardController {
  readonly host: HTMLElement;
  isOnAir(): boolean;
  hide(): void;
  /** Returns false when toss is not recorded (caller clears on-air state). */
  show(ctx: MatchContext | null, options?: TossResultShowOptions): boolean;
}

function warnGraphics(err: unknown): void {
  console.warn('[toss-result]', err);
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function teamSide(
  ctx: MatchContext,
  side: 'A' | 'B',
): { name: string; initials: string } {
  if (side === 'A') {
    const name = ctx.homeTeamName?.trim() || 'Home';
    return { name, initials: teamInitials(name) };
  }
  const name =
    ctx.awayTeamName?.trim() ||
    ctx.externalOpponentName?.trim() ||
    'Away';
  return { name, initials: teamInitials(name) };
}

function buildCardMarkup(): string {
  return `
    <div class="panel panel-toss-result">
      <section class="tr-section tr-id-strip" data-tr-section="id">
        <p class="tr-id-line">TOSS RESULT</p>
      </section>
      <section class="tr-section tr-title-bar" data-tr-section="title">
        <p class="tr-title">Toss Result</p>
        <div class="tr-title-sweep" aria-hidden="true"></div>
      </section>
      <section class="tr-section tr-teams" data-tr-section="teams" aria-label="Match teams">
        <div class="tr-team" data-tr-side="a">
          <div class="tr-mono-shield" aria-hidden="true">
            <span class="tr-mono-star">★</span>
            <span data-tr-abbr="a" class="tr-mono-abbr">—</span>
            <span class="tr-mono-stripe"></span>
          </div>
          <p data-tr-name="a" class="tr-name">—</p>
        </div>
        <p class="tr-vs" aria-hidden="true">VS</p>
        <div class="tr-team" data-tr-side="b">
          <div class="tr-mono-shield" aria-hidden="true">
            <span class="tr-mono-star">★</span>
            <span data-tr-abbr="b" class="tr-mono-abbr">—</span>
            <span class="tr-mono-stripe"></span>
          </div>
          <p data-tr-name="b" class="tr-name">—</p>
        </div>
      </section>
      <section class="tr-section tr-outcome" data-tr-section="outcome">
        <p data-tr-line class="tr-result"></p>
      </section>
    </div>
  `.trim();
}

/**
 * Broadcast line with BAT/BOWL emphasized (uppercase). Null until toss recorded.
 */
export function formatTossResultLine(ctx: MatchContext | null): string | null {
  const base = formatTossLine(ctx);
  if (!base || !ctx?.tossDecision) {
    return null;
  }
  const choice = ctx.tossDecision === 'BAT' ? 'BAT' : 'BOWL';
  return base.replace(/chose to (bat|bowl)$/i, `chose to ${choice}`);
}

export function mountTossResultCard(
  host: HTMLElement,
): TossResultCardController {
  let onAir = false;
  let motionGen = 0;
  let exitTimer: number | null = null;
  const entranceTimers: number[] = [];

  const qs = <T extends HTMLElement>(selector: string): T | null =>
    host.querySelector(selector) as T | null;

  const panel = (): HTMLElement | null =>
    host.querySelector('.panel-toss-result');

  const ensureMarkup = (): void => {
    if (!host.querySelector('.panel-toss-result')) {
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
      p.classList.remove('tr-exiting', 'tr-entering');
      for (const section of p.querySelectorAll('.tr-section')) {
        section.classList.remove('tr-section-visible');
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
    const sections = [...p.querySelectorAll<HTMLElement>('.tr-section')];
    const reduced = prefersReducedMotion();

    if (reduced) {
      p.classList.add('tr-entering');
      for (const section of sections) {
        section.classList.add('tr-section-visible');
      }
      return;
    }

    p.classList.remove('tr-exiting');
    p.classList.add('tr-entering');
    for (const section of sections) {
      section.classList.remove('tr-section-visible');
    }
    sections.forEach((section, index) => {
      const timer = window.setTimeout(() => {
        if (gen !== motionGen) {
          return;
        }
        section.classList.add('tr-section-visible');
      }, index * SECTION_STAGGER_MS);
      entranceTimers.push(timer);
    });

    const sweep = p.querySelector<HTMLElement>('.tr-title-sweep');
    if (sweep) {
      sweep.style.animation = 'none';
      void sweep.offsetWidth;
      sweep.style.animation = '';
    }
  };

  const paint = (ctx: MatchContext): boolean => {
    ensureMarkup();
    const line = formatTossResultLine(ctx);
    if (!line) {
      return false;
    }

    const a = teamSide(ctx, 'A');
    const b = teamSide(ctx, 'B');
    const nameA = qs<HTMLElement>('[data-tr-name="a"]');
    const nameB = qs<HTMLElement>('[data-tr-name="b"]');
    const abbrA = qs<HTMLElement>('[data-tr-abbr="a"]');
    const abbrB = qs<HTMLElement>('[data-tr-abbr="b"]');
    const lineEl = qs<HTMLElement>('[data-tr-line]');
    if (!nameA || !nameB || !abbrA || !abbrB || !lineEl) {
      return false;
    }

    nameA.textContent = a.name;
    nameB.textContent = b.name;
    abbrA.textContent = a.initials;
    abbrB.textContent = b.initials;

    const winnerName = ctx.tossWinner === 'TEAM_A' ? a.name : b.name;
    const choice = ctx.tossDecision === 'BAT' ? 'BAT' : 'BOWL';
    lineEl.replaceChildren();
    const winSpan = document.createElement('span');
    winSpan.className = 'tr-winner';
    winSpan.textContent = winnerName;
    const mid = document.createTextNode(' won the toss and chose to ');
    const choiceSpan = document.createElement('span');
    choiceSpan.className = 'tr-choice';
    choiceSpan.textContent = choice;
    lineEl.append(winSpan, mid, choiceSpan);

    return true;
  };

  const hideNode = (): void => {
    cancelMotion();
    onAir = false;
    const p = panel();
    const reduced = prefersReducedMotion();
    const ms = reduced ? 0 : EXIT_MS;

    if (p && !reduced) {
      p.classList.add('tr-exiting');
      p.classList.remove('tr-entering');
      for (const section of p.querySelectorAll('.tr-section')) {
        section.classList.remove('tr-section-visible');
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
      p.classList.add('tr-entering');
      for (const section of p.querySelectorAll('.tr-section')) {
        section.classList.add('tr-section-visible');
      }
    }
  };

  return {
    host,
    isOnAir: () => onAir,
    hide(): void {
      try {
        hideNode();
      } catch (err) {
        warnGraphics(err);
        onAir = false;
        host.hidden = true;
        host.classList.remove('is-visible');
      }
    },
    show(ctx, options): boolean {
      try {
        if (!ctx || !paint(ctx)) {
          hideNode();
          return false;
        }
        onAir = true;
        reveal(options?.animate !== false);
        return true;
      } catch (err) {
        warnGraphics(err);
        try {
          hideNode();
        } catch {
          /* ignore */
        }
        return false;
      }
    },
  };
}
