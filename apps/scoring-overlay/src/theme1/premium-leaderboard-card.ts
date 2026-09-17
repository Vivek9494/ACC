/**
 * Premium tournament leaderboard — reusable navy/blue/gold package.
 * Parameterized title / columns / rows (Most Runs, Most Wickets, …).
 */

import './premium-leaderboard-card.css';
import { concealGraphic, revealGraphic } from '../graphic-visibility';

const SECTION_STAGGER_MS = 45;
const EXIT_MS = 320;

export interface PremiumLeaderboardRow {
  rank: number;
  name: string;
  teamName: string;
  stat: number;
}

export interface PremiumLeaderboardShowOptions {
  title: string;
  /** Column header for the stat (e.g. RUNS, WICKETS). */
  statLabel: string;
  rows: PremiumLeaderboardRow[];
  /** Max rows to show (default 5). */
  topN?: number;
  /** Optional subtitle under the title (e.g. selected ACC team). */
  context?: string | null;
  /** When false, paint without replaying entrance. */
  animate?: boolean;
}

export interface PremiumLeaderboardCardController {
  readonly host: HTMLElement;
  isOnAir(): boolean;
  hide(): void;
  show(options: PremiumLeaderboardShowOptions): boolean;
}

function warnGraphics(err: unknown): void {
  console.warn('[premium-leaderboard]', err);
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function buildMarkup(): string {
  return `
    <div class="panel panel-premium-lb">
      <section class="plb-section plb-id-strip" data-plb-section="id">
        <p class="plb-id-line">TOURNAMENT LEADERBOARD</p>
      </section>
      <section class="plb-section plb-title-bar" data-plb-section="title">
        <p data-plb-title class="plb-title">Most Runs</p>
        <p data-plb-context class="plb-context" hidden></p>
        <div class="plb-title-sweep" aria-hidden="true"></div>
      </section>
      <section class="plb-section plb-col-heads" data-plb-section="cols" aria-hidden="true">
        <span>Rank</span>
        <span>Player</span>
        <span data-plb-col-team>Team</span>
        <span data-plb-col-stat>Runs</span>
      </section>
      <section class="plb-section plb-list-wrap" data-plb-section="list">
        <ol class="plb-list" data-plb-list aria-label="Tournament leaderboard"></ol>
        <p class="plb-empty" data-plb-empty hidden>No records yet</p>
      </section>
      <section class="plb-section plb-footer" data-plb-section="footer">
        <p class="plb-footer-mark">ASC</p>
        <p data-plb-footer-note class="plb-footer-note"></p>
      </section>
    </div>
  `.trim();
}

export function mountPremiumLeaderboardCard(
  host: HTMLElement,
): PremiumLeaderboardCardController {
  let onAir = false;
  let motionGen = 0;
  let exitTimer: number | null = null;
  const entranceTimers: number[] = [];

  const qs = <T extends HTMLElement>(selector: string): T | null =>
    host.querySelector(selector) as T | null;

  const panel = (): HTMLElement | null =>
    host.querySelector('.panel-premium-lb');

  const ensureMarkup = (): void => {
    if (!host.querySelector('.panel-premium-lb')) {
      host.innerHTML = buildMarkup();
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
      p.classList.remove('plb-exiting', 'plb-entering');
      for (const section of p.querySelectorAll('.plb-section')) {
        section.classList.remove('plb-section-visible');
      }
      for (const row of p.querySelectorAll('.plb-row')) {
        row.classList.remove('plb-row-visible');
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
    const sections = [...p.querySelectorAll<HTMLElement>('.plb-section')];
    const rows = [...p.querySelectorAll<HTMLElement>('.plb-row')];
    const reduced = prefersReducedMotion();

    if (reduced) {
      p.classList.add('plb-entering');
      for (const section of sections) {
        section.classList.add('plb-section-visible');
      }
      for (const row of rows) {
        row.classList.add('plb-row-visible');
      }
      return;
    }

    p.classList.remove('plb-exiting');
    p.classList.add('plb-entering');
    for (const section of sections) {
      section.classList.remove('plb-section-visible');
    }
    for (const row of rows) {
      row.classList.remove('plb-row-visible');
    }

    sections.forEach((section, index) => {
      const timer = window.setTimeout(() => {
        if (gen !== motionGen) {
          return;
        }
        section.classList.add('plb-section-visible');
      }, index * SECTION_STAGGER_MS);
      entranceTimers.push(timer);
    });

    const rowBase = sections.length * SECTION_STAGGER_MS;
    rows.forEach((row, index) => {
      const timer = window.setTimeout(() => {
        if (gen !== motionGen) {
          return;
        }
        row.classList.add('plb-row-visible');
      }, rowBase + index * SECTION_STAGGER_MS);
      entranceTimers.push(timer);
    });

    const sweep = p.querySelector<HTMLElement>('.plb-title-sweep');
    if (sweep) {
      sweep.style.animation = 'none';
      void sweep.offsetWidth;
      sweep.style.animation = '';
    }
  };

  const paint = (options: PremiumLeaderboardShowOptions): boolean => {
    ensureMarkup();
    const title = qs<HTMLElement>('[data-plb-title]');
    const context = qs<HTMLElement>('[data-plb-context]');
    const list = qs<HTMLElement>('[data-plb-list]');
    const empty = qs<HTMLElement>('[data-plb-empty]');
    const colStat = qs<HTMLElement>('[data-plb-col-stat]');
    const colTeam = qs<HTMLElement>('[data-plb-col-team]');
    const colHeads = qs<HTMLElement>('.plb-col-heads');
    const footerNote = qs<HTMLElement>('[data-plb-footer-note]');
    const p = panel();
    if (!title || !list || !colStat || !colTeam || !colHeads || !p) {
      return false;
    }

    const topN = options.topN ?? 5;
    const top = options.rows.slice(0, topN);
    const showTeam = top.some((row) => row.teamName.trim().length > 0);

    title.textContent = options.title;
    colStat.textContent = options.statLabel;
    list.setAttribute('aria-label', options.statLabel);
    p.classList.toggle('plb-hide-team', !showTeam);
    colTeam.hidden = !showTeam;

    if (context) {
      const ctx = options.context?.trim() || '';
      context.textContent = ctx;
      context.hidden = !ctx;
    }
    if (footerNote) {
      footerNote.textContent = '';
    }

    if (top.length === 0) {
      list.replaceChildren();
      if (empty) {
        empty.hidden = false;
      }
      return false;
    }

    if (empty) {
      empty.hidden = true;
    }

    list.replaceChildren();
    for (const row of top) {
      const li = document.createElement('li');
      li.className = 'plb-row';
      if (!showTeam) {
        li.classList.add('plb-row--no-team');
      }

      const rank = document.createElement('span');
      rank.className = 'plb-rank';
      rank.textContent = String(row.rank);

      const name = document.createElement('span');
      name.className = 'plb-name';
      name.textContent = row.name;

      const stat = document.createElement('span');
      stat.className = 'plb-stat';
      stat.textContent = String(row.stat);

      if (showTeam) {
        const team = document.createElement('span');
        team.className = 'plb-team';
        team.textContent = row.teamName;
        li.append(rank, name, team, stat);
      } else {
        li.append(rank, name, stat);
      }
      list.appendChild(li);
    }

    return true;
  };

  const hideNode = (): void => {
    cancelMotion();
    onAir = false;
    const p = panel();
    const reduced = prefersReducedMotion();
    const ms = reduced ? 0 : EXIT_MS;

    if (p && !reduced) {
      p.classList.add('plb-exiting');
      p.classList.remove('plb-entering');
      for (const section of p.querySelectorAll('.plb-section')) {
        section.classList.remove('plb-section-visible');
      }
      for (const row of p.querySelectorAll('.plb-row')) {
        row.classList.remove('plb-row-visible');
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
      p.classList.add('plb-entering');
      for (const section of p.querySelectorAll('.plb-section')) {
        section.classList.add('plb-section-visible');
      }
      for (const row of p.querySelectorAll('.plb-row')) {
        row.classList.add('plb-row-visible');
      }
    }
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
        host.classList.remove('is-visible');
      }
    },
    show(options) {
      try {
        if (!paint(options)) {
          hideNode();
          return false;
        }
        onAir = true;
        reveal(options.animate !== false);
        return true;
      } catch (err) {
        warnGraphics(err);
        hideNode();
        return false;
      }
    },
  };
}
