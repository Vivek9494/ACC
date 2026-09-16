/**
 * Premium TEAM PARTNERSHIPS — full-innings wicket-by-wicket stand table.
 * Distinct from the single-stand Current Partnership card.
 */

import './team-partnerships-card.css';
import {
  battingTeamLabel,
  bowlingTeamLabel,
  findInningsByKey,
  partnershipBatterRuns,
  partnershipExtras,
  playerName,
  resolveActiveInnings,
  shortName,
  teamPartnershipStandRows,
} from './graphics-format';
import { concealGraphic, revealGraphic } from './graphic-visibility';
import type { InningsScorecard, ScorecardResponse } from './types';
import { teamInitials } from './view-model';

const MAX_STANDS = 10;
const SECTION_STAGGER_MS = 45;
const BAR_WIPE_START_MS = 300;
const BAR_WIPE_STEP_MS = 45;
const EXIT_MS = 320;

export interface TeamPartnershipsShowOptions {
  inningsId?: string | null;
  animate?: boolean;
}

export interface TeamPartnershipsCardController {
  host: HTMLElement;
  isOnAir: () => boolean;
  hide: () => void;
  show: (
    card: ScorecardResponse | null,
    options?: TeamPartnershipsShowOptions,
  ) => boolean;
  update: (
    card: ScorecardResponse | null,
    options?: Pick<TeamPartnershipsShowOptions, 'inningsId'>,
  ) => boolean;
}

function warnGraphics(err: unknown): void {
  console.warn('[team-partnerships]', err);
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function nameOf(card: ScorecardResponse, id: string | null): string {
  if (!id) {
    return '—';
  }
  const full = playerName(card.display, id);
  return full === '—' ? '—' : shortName(full);
}

function inningsHeading(innings: InningsScorecard): string {
  const n = innings.sequence;
  if (n === 1) {
    return '1st Innings';
  }
  if (n === 2) {
    return '2nd Innings';
  }
  if (n === 3) {
    return '3rd Innings';
  }
  return `${n}th Innings`;
}

function wicketOrdinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return `${n}TH`;
  }
  const mod10 = n % 10;
  if (mod10 === 1) {
    return `${n}ST`;
  }
  if (mod10 === 2) {
    return `${n}ND`;
  }
  if (mod10 === 3) {
    return `${n}RD`;
  }
  return `${n}TH`;
}

/** Non-decimal overs from legal balls (255 → 42.3). */
function oversFromLegalBalls(legalBalls: number): string {
  const whole = Math.floor(legalBalls / 6);
  const rem = legalBalls % 6;
  return `${whole}.${rem}`;
}

function buildMarkup(): string {
  return `
    <div class="panel panel-team-partnerships">
      <section class="tp-section tp-id-strip" data-tp-section="id">
        <p data-tp-id-line class="tp-id-line">TEAM PARTNERSHIPS</p>
      </section>
      <section class="tp-section tp-header" data-tp-section="header">
        <div class="tp-mono-shield" aria-hidden="true">
          <span class="tp-mono-star">★</span>
          <span data-tp-abbr class="tp-mono-abbr">—</span>
          <span class="tp-mono-stripe"></span>
        </div>
        <div class="tp-header-copy">
          <p class="tp-kicker">Innings stands</p>
          <p class="tp-title">Team Partnerships</p>
          <p data-tp-vs class="tp-vs-line">—</p>
        </div>
        <div class="tp-total-block">
          <p data-tp-total class="tp-total-badge">0/0</p>
          <p data-tp-overs class="tp-total-meta">0.0 ov</p>
        </div>
        <div class="tp-header-sweep" aria-hidden="true"></div>
      </section>
      <section class="tp-section tp-col-heads" data-tp-section="cols">
        <span>Wicket</span>
        <span>Batter</span>
        <span>Contribution</span>
        <span>Batter</span>
        <span>Runs</span>
        <span>Balls</span>
      </section>
      <div data-tp-rows class="tp-rows"></div>
      <p data-tp-empty class="tp-empty" hidden>No partnerships yet</p>
      <section class="tp-section tp-legend" data-tp-section="legend">
        <span class="tp-legend-item">
          <span class="tp-swatch is-left"></span> Batter A
        </span>
        <span class="tp-legend-item">
          <span class="tp-swatch is-extras"></span> Extras
        </span>
        <span class="tp-legend-item">
          <span class="tp-swatch is-right"></span> Batter B
        </span>
        <span class="tp-legend-item">* Current stand</span>
      </section>
      <section class="tp-section tp-summary" data-tp-section="summary">
        <div class="tp-summary-cell">
          <p class="tp-summary-label">Highest stand</p>
          <p data-tp-highest class="tp-summary-value">0</p>
        </div>
        <div class="tp-summary-cell">
          <p class="tp-summary-label">Total extras</p>
          <p data-tp-extras-total class="tp-summary-value">0</p>
        </div>
      </section>
      <section class="tp-section tp-footer" data-tp-section="footer">
        <p class="tp-footer-mark">ASC</p>
        <p data-tp-footer-note class="tp-footer-note"></p>
      </section>
    </div>
  `.trim();
}

export function mountTeamPartnershipsCard(
  host: HTMLElement,
): TeamPartnershipsCardController {
  let onAir = false;
  let motionGen = 0;
  let exitTimer: number | null = null;
  const entranceTimers: number[] = [];

  const qs = <T extends HTMLElement>(selector: string): T | null =>
    host.querySelector(selector) as T | null;

  const panel = (): HTMLElement | null =>
    host.querySelector('.panel-team-partnerships');

  const ensureMarkup = (): void => {
    if (!host.querySelector('.panel-team-partnerships')) {
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
      p.classList.remove('tp-exiting', 'tp-entering', 'tp-bars-ready');
      for (const section of p.querySelectorAll('.tp-section')) {
        section.classList.remove('tp-section-visible');
      }
      for (const fill of p.querySelectorAll('.tp-bar-fill')) {
        fill.classList.remove('is-ready');
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
    const sections = [...p.querySelectorAll<HTMLElement>('.tp-section')];
    const fills = [...p.querySelectorAll<HTMLElement>('.tp-bar-fill')];
    const reduced = prefersReducedMotion();

    if (reduced) {
      p.classList.add('tp-entering', 'tp-bars-ready');
      for (const section of sections) {
        section.classList.add('tp-section-visible');
      }
      for (const fill of fills) {
        fill.classList.add('is-ready');
      }
      return;
    }

    p.classList.remove('tp-exiting', 'tp-bars-ready');
    p.classList.add('tp-entering');
    for (const section of sections) {
      section.classList.remove('tp-section-visible');
    }
    for (const fill of fills) {
      fill.classList.remove('is-ready');
    }

    sections.forEach((section, index) => {
      const timer = window.setTimeout(() => {
        if (gen !== motionGen) {
          return;
        }
        section.classList.add('tp-section-visible');
      }, index * SECTION_STAGGER_MS);
      entranceTimers.push(timer);
    });

    fills.forEach((fill, index) => {
      const timer = window.setTimeout(() => {
        if (gen !== motionGen) {
          return;
        }
        p.classList.add('tp-bars-ready');
        fill.classList.add('is-ready');
      }, BAR_WIPE_START_MS + index * BAR_WIPE_STEP_MS);
      entranceTimers.push(timer);
    });

    const sweep = p.querySelector<HTMLElement>('.tp-header-sweep');
    if (sweep) {
      sweep.style.animation = 'none';
      void sweep.offsetWidth;
      sweep.style.animation = '';
    }
  };

  const paint = (card: ScorecardResponse, innings: InningsScorecard): boolean => {
    ensureMarkup();
    const idLine = qs<HTMLElement>('[data-tp-id-line]');
    const abbr = qs<HTMLElement>('[data-tp-abbr]');
    const vs = qs<HTMLElement>('[data-tp-vs]');
    const total = qs<HTMLElement>('[data-tp-total]');
    const overs = qs<HTMLElement>('[data-tp-overs]');
    const rowsHost = qs<HTMLElement>('[data-tp-rows]');
    const empty = qs<HTMLElement>('[data-tp-empty]');
    const highest = qs<HTMLElement>('[data-tp-highest]');
    const extrasTotal = qs<HTMLElement>('[data-tp-extras-total]');
    const footerNote = qs<HTMLElement>('[data-tp-footer-note]');
    const legend = qs<HTMLElement>('[data-tp-section="legend"]');
    const summary = qs<HTMLElement>('[data-tp-section="summary"]');
    const cols = qs<HTMLElement>('[data-tp-section="cols"]');

    if (
      !idLine ||
      !abbr ||
      !vs ||
      !total ||
      !overs ||
      !rowsHost ||
      !empty ||
      !highest ||
      !extrasTotal ||
      !footerNote ||
      !legend ||
      !summary ||
      !cols
    ) {
      return false;
    }

    const battingName = battingTeamLabel(card, innings);
    const bowlingName = bowlingTeamLabel(card, innings);
    const heading = inningsHeading(innings);
    idLine.textContent = `${battingName.toUpperCase()} · ${heading.toUpperCase()}`;
    abbr.textContent = teamInitials(battingName);
    vs.textContent = `vs ${bowlingName}`;
    total.textContent = `${innings.runs}/${innings.wickets}`;
    overs.textContent = `${innings.oversText?.trim() || oversFromLegalBalls(innings.legalBalls)} ov`;
    footerNote.textContent = `${battingName} vs ${bowlingName}`;

    const stands = teamPartnershipStandRows(innings).slice(0, MAX_STANDS);
    rowsHost.replaceChildren();

    if (stands.length === 0) {
      empty.hidden = false;
      cols.hidden = true;
      legend.hidden = true;
      summary.hidden = true;
      highest.textContent = '0';
      extrasTotal.textContent = '0';
      return true;
    }

    empty.hidden = true;
    cols.hidden = false;
    legend.hidden = false;
    summary.hidden = false;

    const maxStandRuns = Math.max(...stands.map((row) => row.stand.runs), 0);
    let extrasSum = 0;

    for (const row of stands) {
      const leftId = row.stand.batterIds[0] ?? null;
      const rightId = row.stand.batterIds[1] ?? null;
      const leftRuns = leftId ? partnershipBatterRuns(row.stand, leftId) : 0;
      const rightRuns = rightId ? partnershipBatterRuns(row.stand, rightId) : 0;
      const extras = partnershipExtras(row.stand);
      extrasSum += extras;

      const el = document.createElement('div');
      el.className = `tp-section tp-row${row.isCurrent ? ' is-current' : ''}`;
      el.setAttribute('data-tp-section', 'row');

      const wicket = document.createElement('span');
      wicket.className = 'tp-wicket';
      wicket.textContent = `${wicketOrdinal(row.standNumber)}${row.isCurrent ? '*' : ''}`;

      const batterA = document.createElement('span');
      batterA.className = 'tp-batter is-a';
      batterA.textContent =
        leftId != null
          ? `${nameOf(card, leftId)} (${leftRuns})`
          : '—';

      const contrib = document.createElement('div');
      contrib.className = 'tp-contrib';
      const track = document.createElement('div');
      track.className = 'tp-bar-track';
      const scale = document.createElement('div');
      scale.className = 'tp-bar-scale';
      const scalePct =
        maxStandRuns > 0 ? Math.max(0, (row.stand.runs / maxStandRuns) * 100) : 0;
      scale.style.width = `${scalePct}%`;
      const fill = document.createElement('div');
      fill.className = 'tp-bar-fill';
      const segTotal = leftRuns + extras + rightRuns;
      if (segTotal > 0) {
        if (leftRuns > 0) {
          const a = document.createElement('div');
          a.className = 'tp-bar-seg is-left';
          a.style.flexGrow = String(leftRuns);
          fill.appendChild(a);
        }
        if (extras > 0) {
          const e = document.createElement('div');
          e.className = 'tp-bar-seg is-extras';
          e.style.flexGrow = String(extras);
          fill.appendChild(e);
        }
        if (rightRuns > 0) {
          const b = document.createElement('div');
          b.className = 'tp-bar-seg is-right';
          b.style.flexGrow = String(rightRuns);
          fill.appendChild(b);
        }
      }
      scale.appendChild(fill);
      track.appendChild(scale);
      contrib.appendChild(track);

      const batterB = document.createElement('span');
      batterB.className = 'tp-batter is-b';
      batterB.textContent =
        rightId != null
          ? `(${rightRuns}) ${nameOf(card, rightId)}`
          : '—';

      const runs = document.createElement('span');
      runs.className = 'tp-runs';
      runs.textContent = `${row.stand.runs}${row.isCurrent ? '*' : ''}`;

      const balls = document.createElement('span');
      balls.className = 'tp-balls';
      balls.textContent = String(row.stand.balls);

      el.append(wicket, batterA, contrib, batterB, runs, balls);
      rowsHost.appendChild(el);
    }

    highest.textContent = String(maxStandRuns);
    extrasTotal.textContent = String(extrasSum);
    return true;
  };

  const resolve = (
    card: ScorecardResponse | null,
    inningsId: string | null | undefined,
  ): { card: ScorecardResponse; innings: InningsScorecard } | null => {
    if (!card) {
      return null;
    }
    const innings =
      (inningsId?.trim()
        ? findInningsByKey(card, inningsId.trim())
        : null) ?? resolveActiveInnings(card);
    if (!innings) {
      return null;
    }
    return { card, innings };
  };

  const hideNode = (): void => {
    cancelMotion();
    onAir = false;
    const p = panel();
    const reduced = prefersReducedMotion();
    const ms = reduced ? 0 : EXIT_MS;

    if (p && !reduced) {
      p.classList.add('tp-exiting');
      p.classList.remove('tp-entering', 'tp-bars-ready');
      for (const section of p.querySelectorAll('.tp-section')) {
        section.classList.remove('tp-section-visible');
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
      p.classList.add('tp-entering', 'tp-bars-ready');
      for (const section of p.querySelectorAll('.tp-section')) {
        section.classList.add('tp-section-visible');
      }
      for (const fill of p.querySelectorAll('.tp-bar-fill')) {
        fill.classList.add('is-ready');
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
    show(card, options) {
      try {
        const resolved = resolve(card, options?.inningsId);
        if (!resolved || !paint(resolved.card, resolved.innings)) {
          hideNode();
          return false;
        }
        onAir = true;
        reveal(options?.animate !== false);
        return true;
      } catch (err) {
        warnGraphics(err);
        hideNode();
        return false;
      }
    },
    update(card, options) {
      try {
        if (!onAir) {
          return false;
        }
        const resolved = resolve(card, options?.inningsId);
        if (!resolved || !paint(resolved.card, resolved.innings)) {
          hideNode();
          return false;
        }
        const p = panel();
        if (p) {
          p.classList.add('tp-entering', 'tp-bars-ready');
          for (const section of p.querySelectorAll('.tp-section')) {
            section.classList.add('tp-section-visible');
          }
          for (const fill of p.querySelectorAll('.tp-bar-fill')) {
            fill.classList.add('is-ready');
          }
        }
        return true;
      } catch (err) {
        warnGraphics(err);
        hideNode();
        return false;
      }
    },
  };
}
