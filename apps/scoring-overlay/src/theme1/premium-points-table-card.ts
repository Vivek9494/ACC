/**
 * Premium POINTS TABLE — navy/blue/gold standings with package stagger motion.
 * Data from existing tournament standings (NRR math unchanged).
 */

import './premium-points-table-card.css';
import { concealGraphic, revealGraphic } from '../graphic-visibility';
import type { TeamStandingRowView, TournamentStandingsView } from '../types';
import { teamInitials } from '../view-model';

const SECTION_STAGGER_MS = 45;
const EXIT_MS = 320;
/** Flag A: fixed top-N blue accent (not full APL qualification logic). */
export const POINTS_TABLE_QUALIFICATION_TOP_N = 4;

export interface PointsTableCardController {
  readonly host: HTMLElement;
  isOnAir(): boolean;
  hide(): void;
  show(standings: TournamentStandingsView | null): boolean;
}

function warnGraphics(err: unknown): void {
  console.warn('[premium-points-table]', err);
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function formatNrr(nrr: number, matches: number): string {
  if (matches <= 0) {
    return '—';
  }
  const rounded = Math.round(nrr * 1000) / 1000;
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded.toFixed(3)}`;
}

function mergedTeams(standings: TournamentStandingsView): TeamStandingRowView[] {
  const teams = standings.tables.flatMap((table) => table.teams);
  return [...teams].sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points;
    }
    if (b.netRunRate !== a.netRunRate) {
      return b.netRunRate - a.netRunRate;
    }
    return a.teamName.localeCompare(b.teamName);
  });
}

function buildMarkup(): string {
  return `
    <div class="panel panel-premium-pt">
      <section class="ppt-section ppt-id-strip" data-ppt-section="id">
        <p class="ppt-id-line">POINTS TABLE</p>
      </section>
      <section class="ppt-section ppt-title-bar" data-ppt-section="title">
        <p class="ppt-title">Points Table</p>
        <p data-ppt-context class="ppt-context"></p>
        <div class="ppt-title-sweep" aria-hidden="true"></div>
      </section>
      <section class="ppt-section ppt-col-heads" data-ppt-section="cols" aria-hidden="true">
        <span>Pos</span>
        <span class="ppt-col-team">Team</span>
        <span>P</span>
        <span>W</span>
        <span>L</span>
        <span>T</span>
        <span>NR</span>
        <span data-ppt-col-nrr>NRR</span>
        <span class="ppt-col-pts">Pts</span>
      </section>
      <section class="ppt-section ppt-list-wrap" data-ppt-section="list">
        <ol class="ppt-list" data-ppt-list aria-label="Tournament points table"></ol>
        <p class="ppt-empty" data-ppt-empty hidden>No standings yet</p>
      </section>
      <section class="ppt-section ppt-legend" data-ppt-section="legend">
        <p data-ppt-qualify class="ppt-qualify">
          <span class="ppt-qualify-mark" aria-hidden="true"></span>
          Top ${POINTS_TABLE_QUALIFICATION_TOP_N} · Qualification positions
        </p>
        <p class="ppt-keys">NR = No result · NRR = Net run rate</p>
      </section>
      <section class="ppt-section ppt-footer" data-ppt-section="footer">
        <p class="ppt-footer-mark">ASC</p>
        <p class="ppt-footer-note">Ordered by points, then NRR</p>
      </section>
    </div>
  `.trim();
}

export function mountPremiumPointsTableCard(
  host: HTMLElement,
): PointsTableCardController {
  let onAir = false;
  let motionGen = 0;
  let exitTimer: number | null = null;
  const entranceTimers: number[] = [];

  const qs = <T extends HTMLElement>(selector: string): T | null =>
    host.querySelector(selector) as T | null;

  const panel = (): HTMLElement | null =>
    host.querySelector('.panel-premium-pt');

  const ensureMarkup = (): void => {
    if (!host.querySelector('.panel-premium-pt')) {
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
      p.classList.remove('ppt-exiting', 'ppt-entering');
      for (const section of p.querySelectorAll('.ppt-section')) {
        section.classList.remove('ppt-section-visible');
      }
      for (const row of p.querySelectorAll('.ppt-row')) {
        row.classList.remove('ppt-row-visible');
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
    const sections = [...p.querySelectorAll<HTMLElement>('.ppt-section')];
    const rows = [...p.querySelectorAll<HTMLElement>('.ppt-row')];
    const reduced = prefersReducedMotion();

    if (reduced) {
      p.classList.add('ppt-entering');
      for (const section of sections) {
        section.classList.add('ppt-section-visible');
      }
      for (const row of rows) {
        row.classList.add('ppt-row-visible');
      }
      return;
    }

    p.classList.remove('ppt-exiting');
    p.classList.add('ppt-entering');
    for (const section of sections) {
      section.classList.remove('ppt-section-visible');
    }
    for (const row of rows) {
      row.classList.remove('ppt-row-visible');
    }

    sections.forEach((section, index) => {
      const timer = window.setTimeout(() => {
        if (gen !== motionGen) {
          return;
        }
        section.classList.add('ppt-section-visible');
      }, index * SECTION_STAGGER_MS);
      entranceTimers.push(timer);
    });

    const rowBase = sections.length * SECTION_STAGGER_MS;
    rows.forEach((row, index) => {
      const timer = window.setTimeout(() => {
        if (gen !== motionGen) {
          return;
        }
        row.classList.add('ppt-row-visible');
      }, rowBase + index * SECTION_STAGGER_MS);
      entranceTimers.push(timer);
    });

    const sweep = p.querySelector<HTMLElement>('.ppt-title-sweep');
    if (sweep) {
      sweep.style.animation = 'none';
      void sweep.offsetWidth;
      sweep.style.animation = '';
    }
  };

  const paint = (standings: TournamentStandingsView): boolean => {
    ensureMarkup();
    const list = qs<HTMLElement>('[data-ppt-list]');
    const empty = qs<HTMLElement>('[data-ppt-empty]');
    const context = qs<HTMLElement>('[data-ppt-context]');
    const colNrr = qs<HTMLElement>('[data-ppt-col-nrr]');
    const colHeads = qs<HTMLElement>('.ppt-col-heads');
    const p = panel();
    if (!list || !empty || !colHeads || !p) {
      return false;
    }

    const teams = mergedTeams(standings);
    const showNrr = standings.showNetRunRate;
    p.classList.toggle('ppt-hide-nrr', !showNrr);
    if (colNrr) {
      colNrr.hidden = !showNrr;
    }
    if (context) {
      const n = teams.length;
      context.textContent = n === 1 ? '1 team' : `${n} teams`;
    }

    if (teams.length === 0) {
      list.replaceChildren();
      empty.hidden = false;
      return false;
    }
    empty.hidden = true;

    list.replaceChildren();
    for (let i = 0; i < teams.length; i += 1) {
      const row = teams[i];
      if (!row) {
        continue;
      }
      const pos = i + 1;
      const li = document.createElement('li');
      li.className = 'ppt-row';
      if (!showNrr) {
        li.classList.add('ppt-row--no-nrr');
      }
      if (pos <= POINTS_TABLE_QUALIFICATION_TOP_N) {
        li.classList.add('is-qualify');
      }

      const posEl = document.createElement('span');
      posEl.className = 'ppt-pos';
      posEl.textContent = String(pos);

      const teamEl = document.createElement('div');
      teamEl.className = 'ppt-team';
      const shield = document.createElement('div');
      shield.className = 'ppt-mono-shield';
      shield.setAttribute('aria-hidden', 'true');
      shield.innerHTML =
        '<span class="ppt-mono-star">★</span>' +
        `<span class="ppt-mono-abbr">${teamInitials(row.teamName)}</span>` +
        '<span class="ppt-mono-stripe"></span>';
      const nameEl = document.createElement('span');
      nameEl.className = 'ppt-team-name';
      nameEl.textContent = row.teamName;
      teamEl.append(shield, nameEl);

      const cell = (text: string, className: string): HTMLSpanElement => {
        const el = document.createElement('span');
        el.className = className;
        el.textContent = text;
        return el;
      };

      li.append(
        posEl,
        teamEl,
        cell(String(row.matches), 'ppt-stat'),
        cell(String(row.wins), 'ppt-stat'),
        cell(String(row.losses), 'ppt-stat'),
        // Ties are not stored in standings (Super Over required); column kept for layout.
        cell('0', 'ppt-stat'),
        cell(String(row.noResults), 'ppt-stat'),
      );
      if (showNrr) {
        li.append(cell(formatNrr(row.netRunRate, row.matches), 'ppt-stat ppt-nrr'));
      }
      li.append(cell(String(row.points), 'ppt-pts'));
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
      p.classList.add('ppt-exiting');
      p.classList.remove('ppt-entering');
      for (const section of p.querySelectorAll('.ppt-section')) {
        section.classList.remove('ppt-section-visible');
      }
      for (const row of p.querySelectorAll('.ppt-row')) {
        row.classList.remove('ppt-row-visible');
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
      p.classList.add('ppt-entering');
      for (const section of p.querySelectorAll('.ppt-section')) {
        section.classList.add('ppt-section-visible');
      }
      for (const row of p.querySelectorAll('.ppt-row')) {
        row.classList.add('ppt-row-visible');
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
    show(standings) {
      try {
        if (!standings || !paint(standings)) {
          hideNode();
          return false;
        }
        onAir = true;
        reveal(true);
        return true;
      } catch (err) {
        warnGraphics(err);
        hideNode();
        return false;
      }
    },
  };
}

/** Alias kept for theme registry / existing import sites. */
export const mountPointsTableCard = mountPremiumPointsTableCard;
