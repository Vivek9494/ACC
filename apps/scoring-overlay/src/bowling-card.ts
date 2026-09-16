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
  shortName,
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

function formatExtrasSummary(extras: ExtrasBreakdown): string {
  const parts: string[] = [];
  if (extras.wides > 0) {
    parts.push(`w ${extras.wides}`);
  }
  if (extras.byes > 0) {
    parts.push(`b ${extras.byes}`);
  }
  if (extras.legByes > 0) {
    parts.push(`lb ${extras.legByes}`);
  }
  if (extras.noBalls > 0) {
    parts.push(`nb ${extras.noBalls}`);
  }
  if (extras.penalties > 0) {
    parts.push(`p ${extras.penalties}`);
  }
  const breakdown = parts.length > 0 ? ` (${parts.join(', ')})` : '';
  return `Extras${breakdown} = ${extras.total}`;
}

function lastFiveOversLine(innings: InningsScorecard): string | null {
  const timeline = innings.timeline ?? [];
  const overMap = new Map<number, { runs: number; wickets: number }>();
  for (const entry of timeline) {
    if (entry.overNumber === null) {
      continue;
    }
    let over = overMap.get(entry.overNumber);
    if (!over) {
      over = { runs: 0, wickets: 0 };
      overMap.set(entry.overNumber, over);
    }
    over.runs += entry.runs;
    if (entry.isWicket) {
      over.wickets += 1;
    }
  }
  const overs = [...overMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .slice(-5)
    .map(([, v]) => v);
  if (overs.length === 0) {
    return null;
  }
  const runs = overs.reduce((sum, o) => sum + o.runs, 0);
  const wickets = overs.reduce((sum, o) => sum + o.wickets, 0);
  return `Last ${overs.length} ov ${runs}/${wickets}`;
}

function analysisLine(innings: InningsScorecard): string | null {
  const parts: string[] = [];
  const last5 = lastFiveOversLine(innings);
  if (last5) {
    parts.push(last5);
  }
  const ps = innings.partnership;
  if (ps && ps.batterIds.length >= 2) {
    parts.push(`Partnership ${ps.runs} (${ps.balls})`);
  }
  if (innings.target != null && innings.target > 0 && !innings.closed) {
    const needs = Math.max(0, innings.target - innings.runs);
    if (needs > 0) {
      parts.push(`Need ${needs}`);
    }
  }
  return parts.length > 0 ? parts.join('  ·  ') : null;
}

function buildMarkup(): string {
  return `
    <div class="panel panel-bowling-card">
      <section class="bowl-section bowl-id-strip" data-bowl-section="id">
        <p data-bowl-id-line class="bowl-id-line">BOWLING SCORECARD</p>
      </section>
      <section class="bowl-section bowl-header" data-bowl-section="header">
        <div class="bowl-header-inner">
          <div data-bowl-monogram class="bowl-monogram" aria-hidden="true">—</div>
          <div class="bowl-header-copy">
            <p class="bowl-kicker">Bowling scorecard</p>
            <p data-bowl-team class="bowl-team-name">—</p>
            <p data-bowl-vs class="bowl-vs-line">—</p>
            <p data-bowl-innings-label class="bowl-innings-label">—</p>
          </div>
          <div class="bowl-total-block">
            <p data-bowl-total class="bowl-total-badge">0/0</p>
            <p data-bowl-opp-meta class="bowl-opp-meta">0.0 ov · RR 0.00</p>
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
          <span class="bowl-col-num">W</span>
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
        <p data-bowl-extras class="bowl-extras-line">Extras</p>
        <div class="bowl-extras-grid">
          <div class="bowl-extra-cell"><span class="bowl-extra-k">B</span><span data-bowl-ex-b class="bowl-extra-v">0</span></div>
          <div class="bowl-extra-cell"><span class="bowl-extra-k">LB</span><span data-bowl-ex-lb class="bowl-extra-v">0</span></div>
          <div class="bowl-extra-cell"><span class="bowl-extra-k">WD</span><span data-bowl-ex-wd class="bowl-extra-v">0</span></div>
          <div class="bowl-extra-cell"><span class="bowl-extra-k">NB</span><span data-bowl-ex-nb class="bowl-extra-v">0</span></div>
        </div>
      </section>
      <section class="bowl-section bowl-analysis" data-bowl-section="analysis" hidden>
        <p data-bowl-analysis class="bowl-analysis-line"></p>
      </section>
      <section class="bowl-section bowl-footer" data-bowl-section="footer">
        <p data-bowl-footer class="bowl-footer-line">—</p>
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
    if (!host.querySelector('.panel-bowling-card')) {
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
        section.classList.add('bowl-section-visible');
      }
      return;
    }
    p.classList.remove('bowl-exiting');
    p.classList.add('bowl-entering');

    // Stagger: ID → header → columns → each bowler row → extras → analysis → footer
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
    // Rows wrap section needs to be visible for children
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
    const idLine = qs<HTMLElement>('[data-bowl-id-line]');
    const monogram = qs<HTMLElement>('[data-bowl-monogram]');
    const teamEl = qs<HTMLElement>('[data-bowl-team]');
    const vsEl = qs<HTMLElement>('[data-bowl-vs]');
    const inningsLabel = qs<HTMLElement>('[data-bowl-innings-label]');
    const totalEl = qs<HTMLElement>('[data-bowl-total]');
    const oppMeta = qs<HTMLElement>('[data-bowl-opp-meta]');
    const rowsHost = qs<HTMLElement>('[data-bowl-rows]');
    const empty = qs<HTMLElement>('[data-bowl-empty]');
    const extrasLine = qs<HTMLElement>('[data-bowl-extras]');
    const exB = qs<HTMLElement>('[data-bowl-ex-b]');
    const exLb = qs<HTMLElement>('[data-bowl-ex-lb]');
    const exWd = qs<HTMLElement>('[data-bowl-ex-wd]');
    const exNb = qs<HTMLElement>('[data-bowl-ex-nb]');
    const analysisSection = qs<HTMLElement>('[data-bowl-section="analysis"]');
    const analysisEl = qs<HTMLElement>('[data-bowl-analysis]');
    const footer = qs<HTMLElement>('[data-bowl-footer]');

    if (
      !idLine ||
      !monogram ||
      !teamEl ||
      !vsEl ||
      !inningsLabel ||
      !totalEl ||
      !oppMeta ||
      !rowsHost ||
      !empty ||
      !extrasLine ||
      !exB ||
      !exLb ||
      !exWd ||
      !exNb ||
      !analysisSection ||
      !analysisEl ||
      !footer
    ) {
      return false;
    }

    const bowlingName = bowlingTeamLabel(card, innings);
    const battingName = battingTeamLabel(card, innings);
    idLine.textContent = `BOWLING SCORECARD · ${inningsHeading(innings)}`;
    monogram.textContent = teamInitials(bowlingName);
    teamEl.textContent = bowlingName;
    vsEl.textContent = `v ${battingName}`;
    inningsLabel.textContent = inningsHeading(innings);

    // Header total = OPPOSITION (batting) figures
    totalEl.textContent = `${innings.runs}/${innings.wickets}`;
    const overs = innings.oversText || '0.0';
    oppMeta.textContent = `${overs} ov · RR ${oppositionRunRate(innings)}`;

    rowsHost.replaceChildren();
    const bowlers = bowlersWhoHaveBowled(innings);
    empty.hidden = bowlers.length > 0;

    bowlers.forEach((bowler, index) => {
      const current =
        !innings.closed && bowler.playerId === innings.currentBowlerId;

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
      name.textContent = `${nameOf(card, bowler.playerId)}${current ? ' *' : ''}`;

      const cells: Array<[string, string]> = [
        ['bowl-col-num', bowler.oversText?.trim() || '0.0'],
        ['bowl-col-num', String(bowler.maidens ?? 0)],
        ['bowl-col-num', String(bowler.runsConceded ?? 0)],
        ['bowl-col-num', String(bowler.wickets ?? 0)],
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
    exB.textContent = String(extras.byes);
    exLb.textContent = String(extras.legByes);
    exWd.textContent = String(extras.wides);
    exNb.textContent = String(extras.noBalls);
    extrasLine.textContent = formatExtrasSummary(extras);

    const analysis = analysisLine(innings);
    if (analysis) {
      analysisSection.hidden = false;
      analysisEl.textContent = analysis;
    } else {
      analysisSection.hidden = true;
      analysisEl.textContent = '';
    }

    footer.textContent = `${battingName} ${innings.runs}/${innings.wickets} · ${overs} ov · RR ${oppositionRunRate(innings)}`;

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
