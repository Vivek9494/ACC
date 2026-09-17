/**
 * Bowling card — premium broadcast bowling scorecard for one team's fielding innings.
 * Header = opposition (batting) totals; rows = this team's bowlers.
 */

import {
  battingTeamLabel,
  bowlingTeamLabel,
  findInningsByKey,
  formatStat,
  playerName,
} from './graphics-format';
import { concealGraphic, revealGraphic } from './graphic-visibility';
import type {
  BowlerCard,
  ExtrasBreakdown,
  InningsScorecard,
  ScorecardResponse,
} from './types';
import { teamInitials } from './view-model';

import './bowling-card.css';

const BALLS_PER_OVER = 6;
const SECTION_STAGGER_MS = 48;
const EXIT_MS = 320;

const ANALYSIS_DESCRIPTOR =
  'Figures shown as overs · maidens · runs · wickets';

export interface BowlingCardShowOptions {
  /** When false, repaint live data without replaying section entrance. */
  animate?: boolean;
}

export interface BowlingCardController {
  host: HTMLElement;
  isOnAir: () => boolean;
  hide: () => void;
  show: (
    card: ScorecardResponse | null,
    inningsId: string | null,
    options?: BowlingCardShowOptions,
  ) => boolean;
  update: (
    card: ScorecardResponse | null,
    inningsId: string | null,
  ) => boolean;
}

function warnGraphics(err: unknown): void {
  console.warn('[bowling-card]', err);
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** BOWLER column — full first + surname (keeps disambiguators like "(PEI)"). */
function bowlerColumnName(card: ScorecardResponse, id: string | null): string {
  return playerName(card.display, id);
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

function inningsHeadingShort(innings: InningsScorecard): string {
  return inningsHeading(innings).toUpperCase();
}

function oppositionRunRate(innings: InningsScorecard): string {
  if (innings.legalBalls <= 0) {
    return '0.00';
  }
  const rr = (innings.runs * BALLS_PER_OVER) / innings.legalBalls;
  return Number.isFinite(rr) ? rr.toFixed(2) : '0.00';
}

/** Reuse feed economy — never recompute from oversText. Em dash at 0 legal balls. */
function economyText(bowler: BowlerCard): string {
  if (bowler.legalBalls <= 0) {
    return '—';
  }
  if (Number.isFinite(bowler.economy)) {
    return formatStat(bowler.economy, 2);
  }
  return '—';
}

function bowlersWhoHaveBowled(innings: InningsScorecard): BowlerCard[] {
  return innings.bowlers.filter(
    (b) => b.legalBalls > 0 || (b.wides ?? 0) > 0 || (b.noBalls ?? 0) > 0,
  );
}

function normalizeExtras(innings: InningsScorecard): ExtrasBreakdown {
  const e = innings.extras;
  return {
    wides: e?.wides ?? 0,
    noBalls: e?.noBalls ?? 0,
    byes: e?.byes ?? 0,
    legByes: e?.legByes ?? 0,
    penalties: e?.penalties ?? 0,
    total: e?.total ?? 0,
  };
}

function formatLine(innings: InningsScorecard): string {
  const parts = [inningsHeadingShort(innings)];
  if (innings.oversAllotted != null && innings.oversAllotted > 0) {
    parts.push(`${innings.oversAllotted} OVERS`);
  }
  return parts.join(' · ');
}

/**
 * Current-spell highlight: live feed exposes one currentBowlerId.
 * Also mark any other bowler who is mid-over (legalBalls % 6 !== 0) while
 * the innings is open — covers the “other end” still unfinished.
 */
function isCurrentSpell(
  innings: InningsScorecard,
  bowler: BowlerCard,
): boolean {
  if (innings.closed) {
    return false;
  }
  const currentId = innings.currentBowlerId;
  if (currentId && bowler.playerId === currentId) {
    return true;
  }
  // Other end still mid-over (incomplete over) — treat as current spell too.
  if (
    currentId &&
    bowler.playerId !== currentId &&
    bowler.legalBalls > 0 &&
    bowler.legalBalls % BALLS_PER_OVER !== 0
  ) {
    return true;
  }
  return false;
}

function buildMarkup(): string {
  return `
    <div class="panel panel-bowling-card">
      <section class="bowl-section bowl-id-strip" data-bowl-section="id">
        <p data-bowl-id-left class="bowl-id-left">ASC</p>
        <p data-bowl-id-center class="bowl-id-center">ASC LIVE</p>
        <p data-bowl-id-right class="bowl-id-right">—</p>
      </section>
      <section class="bowl-section bowl-header" data-bowl-section="header">
        <div class="bowl-header-inner">
          <div class="bowl-mono-shield" aria-hidden="true">
            <span class="bowl-mono-star">★</span>
            <span data-bowl-abbr class="bowl-mono-abbr">—</span>
            <span class="bowl-mono-stripe"></span>
          </div>
          <div class="bowl-header-copy">
            <p data-bowl-team class="bowl-team-name">—</p>
            <p data-bowl-vs class="bowl-vs-line">—</p>
          </div>
          <div class="bowl-score-block">
            <span class="bowl-score-label">Opposition total</span>
            <p data-bowl-total class="bowl-score-total">0 / 0</p>
          </div>
          <div class="bowl-header-vdiv" aria-hidden="true"></div>
          <div class="bowl-overs-block">
            <span class="bowl-overs-label">Overs</span>
            <p data-bowl-overs class="bowl-overs-value">0.0</p>
            <p data-bowl-rr class="bowl-rr-value">RR 0.00</p>
          </div>
        </div>
        <div class="bowl-header-sweep" aria-hidden="true"></div>
      </section>
      <section class="bowl-section bowl-columns" data-bowl-section="columns">
        <div class="bowl-col-grid bowl-col-head" role="row">
          <span class="bowl-col-name">Bowler</span>
          <span class="bowl-col-num">O</span>
          <span class="bowl-col-num">M</span>
          <span class="bowl-col-num">R</span>
          <span class="bowl-col-num bowl-col-w">W</span>
          <span class="bowl-col-num bowl-col-econ">Econ</span>
          <span class="bowl-col-num">WD</span>
          <span class="bowl-col-num">NB</span>
        </div>
      </section>
      <section class="bowl-section bowl-rows-wrap" data-bowl-section="rows">
        <div data-bowl-rows class="bowl-rows"></div>
        <p data-bowl-empty class="bowl-empty" hidden>No bowlers yet</p>
      </section>
      <section class="bowl-section bowl-extras" data-bowl-section="extras">
        <div class="bowl-extras-main">
          <span data-bowl-extras-total class="bowl-extras-total">Extras 0</span>
          <span class="bowl-extras-parts">
            <span class="bowl-ex-part">B <span data-bowl-ex-b>0</span></span>
            <span class="bowl-ex-part">LB <span data-bowl-ex-lb>0</span></span>
            <span class="bowl-ex-part">WD <span data-bowl-ex-wd>0</span></span>
            <span class="bowl-ex-part">NB <span data-bowl-ex-nb>0</span></span>
          </span>
        </div>
        <span class="bowl-spell-legend">
          <span class="bowl-spell-mark" aria-hidden="true"></span>
          Current spell
        </span>
      </section>
      <section class="bowl-section bowl-analysis" data-bowl-section="analysis">
        <p class="bowl-analysis-label">Bowling analysis</p>
        <p class="bowl-analysis-desc">${ANALYSIS_DESCRIPTOR}</p>
      </section>
      <section class="bowl-section bowl-footer" data-bowl-section="footer">
        <p data-bowl-footer-format class="bowl-footer-format">—</p>
        <p class="bowl-footer-brand">ASC</p>
      </section>
    </div>
  `.trim();
}

function resolveInnings(
  card: ScorecardResponse,
  inningsId: string | null,
): InningsScorecard | null {
  if (inningsId) {
    return findInningsByKey(card, inningsId);
  }
  return card.innings.at(-1) ?? null;
}

export function mountBowlingCard(host: HTMLElement): BowlingCardController {
  let onAir = false;
  let motionGen = 0;
  let exitTimer: number | null = null;
  const entranceTimers: number[] = [];

  const qs = <T extends HTMLElement>(selector: string): T | null =>
    host.querySelector(selector) as T | null;

  const panel = (): HTMLElement | null => host.querySelector('.panel-bowling-card');

  const ensureMarkup = (): void => {
    // Rebuild when upgrading from the prior gold-square / total-pill markup.
    if (!host.querySelector('.panel-bowling-card .bowl-score-block')) {
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
      p.classList.remove('bowl-exiting', 'bowl-entering');
      for (const section of p.querySelectorAll('.bowl-section')) {
        section.classList.remove('bowl-section-visible');
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
    if (prefersReducedMotion()) {
      p.classList.add('bowl-entering');
      for (const section of p.querySelectorAll('.bowl-section')) {
        if (!(section as HTMLElement).hidden) {
          section.classList.add('bowl-section-visible');
        }
      }
      return;
    }
    p.classList.remove('bowl-exiting');
    p.classList.add('bowl-entering');

    const fixedBefore = [
      ...p.querySelectorAll<HTMLElement>(
        '[data-bowl-section="id"], [data-bowl-section="header"], [data-bowl-section="columns"]',
      ),
    ];
    const rows = [
      ...p.querySelectorAll<HTMLElement>('[data-bowl-rows] .bowl-row'),
    ];
    const fixedAfter = [
      ...p.querySelectorAll<HTMLElement>(
        '[data-bowl-section="extras"], [data-bowl-section="analysis"], [data-bowl-section="footer"]',
      ),
    ].filter((el) => !el.hidden);

    const sequence = [...fixedBefore, ...rows, ...fixedAfter];
    for (const el of p.querySelectorAll('.bowl-section, .bowl-row')) {
      el.classList.remove('bowl-section-visible');
    }
    const rowsWrap = p.querySelector('[data-bowl-section="rows"]');
    if (rowsWrap) {
      rowsWrap.classList.add('bowl-section-visible');
    }

    sequence.forEach((section, index) => {
      const delay = index * SECTION_STAGGER_MS;
      const timer = window.setTimeout(() => {
        if (gen !== motionGen) {
          return;
        }
        section.classList.add('bowl-section-visible');
      }, delay);
      entranceTimers.push(timer);
    });

    const sweep = p.querySelector<HTMLElement>('.bowl-header-sweep');
    if (sweep) {
      sweep.style.animation = 'none';
      void sweep.offsetWidth;
      sweep.style.animation = '';
    }
  };

  const paint = (card: ScorecardResponse, innings: InningsScorecard): boolean => {
    ensureMarkup();
    const idLeft = qs<HTMLElement>('[data-bowl-id-left]');
    const idCenter = qs<HTMLElement>('[data-bowl-id-center]');
    const idRight = qs<HTMLElement>('[data-bowl-id-right]');
    const abbr = qs<HTMLElement>('[data-bowl-abbr]');
    const teamEl = qs<HTMLElement>('[data-bowl-team]');
    const vsEl = qs<HTMLElement>('[data-bowl-vs]');
    const totalEl = qs<HTMLElement>('[data-bowl-total]');
    const oversEl = qs<HTMLElement>('[data-bowl-overs]');
    const rrEl = qs<HTMLElement>('[data-bowl-rr]');
    const rowsHost = qs<HTMLElement>('[data-bowl-rows]');
    const empty = qs<HTMLElement>('[data-bowl-empty]');
    const extrasTotal = qs<HTMLElement>('[data-bowl-extras-total]');
    const exB = qs<HTMLElement>('[data-bowl-ex-b]');
    const exLb = qs<HTMLElement>('[data-bowl-ex-lb]');
    const exWd = qs<HTMLElement>('[data-bowl-ex-wd]');
    const exNb = qs<HTMLElement>('[data-bowl-ex-nb]');
    const footerFormat = qs<HTMLElement>('[data-bowl-footer-format]');

    if (
      !idLeft ||
      !idCenter ||
      !idRight ||
      !abbr ||
      !teamEl ||
      !vsEl ||
      !totalEl ||
      !oversEl ||
      !rrEl ||
      !rowsHost ||
      !empty ||
      !extrasTotal ||
      !exB ||
      !exLb ||
      !exWd ||
      !exNb ||
      !footerFormat
    ) {
      return false;
    }

    const bowlingName = bowlingTeamLabel(card, innings);
    const battingName = battingTeamLabel(card, innings);

    idLeft.textContent = 'ASC';
    idCenter.textContent = `${bowlingName} vs ${battingName}`.toUpperCase();
    idRight.textContent = inningsHeadingShort(innings);

    abbr.textContent = teamInitials(bowlingName);
    teamEl.textContent = bowlingName;
    vsEl.textContent = `Bowling · v ${battingName}`;

    // Header total = OPPOSITION (batting side) — the score this team bowled at.
    totalEl.textContent = `${innings.runs} / ${innings.wickets}`;
    oversEl.textContent = innings.oversText || '0.0';
    rrEl.textContent = `RR ${oppositionRunRate(innings)}`;

    rowsHost.replaceChildren();
    const bowlers = bowlersWhoHaveBowled(innings);
    empty.hidden = bowlers.length > 0;

    bowlers.forEach((bowler, index) => {
      const current = isCurrentSpell(innings, bowler);

      const row = document.createElement('div');
      row.className = 'bowl-row bowl-col-grid bowl-section';
      if (index % 2 === 0) {
        row.classList.add('bowl-row-alt-a');
      } else {
        row.classList.add('bowl-row-alt-b');
      }
      if (current) {
        row.classList.add('is-current');
      }

      const name = document.createElement('span');
      name.className = 'bowl-col-name';
      const fullName = bowlerColumnName(card, bowler.playerId);
      name.textContent = fullName;
      if (fullName !== '—') {
        name.title = fullName;
      }
      if (current) {
        name.classList.add('is-current-name');
        const star = document.createElement('span');
        star.className = 'bowl-spell-star';
        star.textContent = ' *';
        name.appendChild(star);
      }

      const cells: Array<[string, string]> = [
        ['bowl-col-num', bowler.oversText?.trim() || '0.0'],
        ['bowl-col-num', String(bowler.maidens ?? 0)],
        ['bowl-col-num', String(bowler.runsConceded ?? 0)],
        ['bowl-col-num bowl-col-w', String(bowler.wickets ?? 0)],
        ['bowl-col-num bowl-col-econ', economyText(bowler)],
        ['bowl-col-num', String(bowler.wides ?? 0)],
        ['bowl-col-num', String(bowler.noBalls ?? 0)],
      ];

      row.append(name);
      for (const [cls, text] of cells) {
        const span = document.createElement('span');
        span.className = cls;
        span.textContent = text;
        row.appendChild(span);
      }
      rowsHost.appendChild(row);
    });

    const extras = normalizeExtras(innings);
    extrasTotal.textContent = `Extras ${extras.total}`;
    exB.textContent = String(extras.byes);
    exLb.textContent = String(extras.legByes);
    exWd.textContent = String(extras.wides);
    exNb.textContent = String(extras.noBalls);

    footerFormat.textContent = formatLine(innings);

    return true;
  };

  const hideNode = (): void => {
    cancelMotion();
    onAir = false;
    const p = panel();
    const reduced = prefersReducedMotion();
    const ms = reduced ? 0 : EXIT_MS;

    if (p && !reduced) {
      p.classList.add('bowl-exiting');
      p.classList.remove('bowl-entering');
      for (const section of p.querySelectorAll('.bowl-section')) {
        section.classList.remove('bowl-section-visible');
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
    } else {
      const p = panel();
      if (p) {
        p.classList.add('bowl-entering');
        for (const section of p.querySelectorAll('.bowl-section, .bowl-row')) {
          if (!(section as HTMLElement).hidden) {
            section.classList.add('bowl-section-visible');
          }
        }
      }
    }
  };

  const showInternal = (
    card: ScorecardResponse | null,
    inningsId: string | null,
    animate: boolean,
  ): boolean => {
    try {
      if (!card) {
        hideNode();
        return false;
      }
      const innings = resolveInnings(card, inningsId);
      if (!innings || !paint(card, innings)) {
        hideNode();
        return false;
      }
      onAir = true;
      reveal(animate);
      return true;
    } catch (err) {
      warnGraphics(err);
      hideNode();
      return false;
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
    show(card, inningsId, options) {
      const animate = options?.animate !== false;
      return showInternal(card, inningsId, animate);
    },
    update(card, inningsId) {
      if (!onAir) {
        return showInternal(card, inningsId, false);
      }
      try {
        if (!card) {
          hideNode();
          return false;
        }
        const innings = resolveInnings(card, inningsId);
        if (!innings || !paint(card, innings)) {
          hideNode();
          return false;
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
