/**
 * Premium CURRENT PARTNERSHIP card — partnership-scoped live figures.
 */

import './partnership-card.css';
import {
  battingTeamLabel,
  bowlingTeamLabel,
  currentPartnershipWicketNumber,
  partnershipBatterBalls,
  partnershipBatterRuns,
  partnershipExtras,
  partnershipRunRate,
  playerName,
  resolveActiveInnings,
  shortName,
} from './graphics-format';
import { concealGraphic, revealGraphic } from './graphic-visibility';
import type { InningsScorecard, Partnership, ScorecardResponse } from './types';
import { teamInitials } from './view-model';

const SECTION_STAGGER_MS = 65;
const BAR_WIPE_DELAY_MS = 350;
const EXIT_MS = 320;

export interface PartnershipCardShowOptions {
  /** When false, repaint without replaying entrance / bar wipe. */
  animate?: boolean;
}

export interface PartnershipCardController {
  host: HTMLElement;
  isOnAir: () => boolean;
  hide: () => void;
  show: (
    card: ScorecardResponse | null,
    options?: PartnershipCardShowOptions,
  ) => boolean;
  update: (card: ScorecardResponse | null) => boolean;
}

function warnGraphics(err: unknown): void {
  console.warn('[partnership-card]', err);
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

function strikeRateText(runs: number, balls: number): string {
  if (balls <= 0) {
    return '—';
  }
  return ((runs / balls) * 100).toFixed(2);
}

function scoreText(runs: number, balls: number): string {
  return `${runs}(${balls})`;
}

function pctText(part: number, total: number): string {
  if (total <= 0) {
    return '0.0%';
  }
  return `${((part / total) * 100).toFixed(1)}%`;
}

function buildMarkup(): string {
  return `
    <div class="panel panel-partnership-card">
      <section class="ps-section ps-id-strip" data-ps-section="id">
        <p data-ps-id-line class="ps-id-line">CURRENT PARTNERSHIP</p>
      </section>
      <section class="ps-section ps-header" data-ps-section="header">
        <div class="ps-mono-shield" aria-hidden="true">
          <span class="ps-mono-star">★</span>
          <span data-ps-abbr class="ps-mono-abbr">—</span>
          <span class="ps-mono-stripe"></span>
        </div>
        <div class="ps-header-copy">
          <p class="ps-kicker">Live stand</p>
          <p class="ps-title">Current Partnership</p>
          <p data-ps-vs class="ps-vs-line">—</p>
        </div>
        <div class="ps-header-sweep" aria-hidden="true"></div>
      </section>
      <section class="ps-section ps-figures" data-ps-section="figures">
        <div class="ps-batter" data-ps-side="left">
          <p data-ps-a-name class="ps-batter-name">—</p>
          <p data-ps-a-score class="ps-batter-score">0(0)</p>
          <p data-ps-a-sr class="ps-batter-meta">SR —</p>
        </div>
        <div class="ps-center">
          <p data-ps-wicket class="ps-wicket">1ST WICKET</p>
          <p data-ps-total class="ps-total">0</p>
          <p data-ps-center-meta class="ps-center-meta">0 balls · RR 0.00</p>
        </div>
        <div class="ps-batter" data-ps-side="right">
          <p data-ps-b-name class="ps-batter-name">—</p>
          <p data-ps-b-score class="ps-batter-score">0(0)</p>
          <p data-ps-b-sr class="ps-batter-meta">SR —</p>
        </div>
      </section>
      <section class="ps-section ps-share" data-ps-section="share">
        <p class="ps-share-title">Share of partnership</p>
        <div class="ps-bar-track" aria-hidden="true">
          <div data-ps-bar-fill class="ps-bar-fill">
            <div data-ps-bar-left class="ps-bar-seg is-left"></div>
            <div data-ps-bar-extras class="ps-bar-seg is-extras"></div>
            <div data-ps-bar-right class="ps-bar-seg is-right"></div>
          </div>
        </div>
        <div class="ps-share-pcts">
          <span data-ps-pct-left>0.0%</span>
          <span data-ps-pct-extras>0.0% extras</span>
          <span data-ps-pct-right>0.0%</span>
        </div>
        <p data-ps-summary class="ps-share-summary">0 + 0 EXTRAS + 0</p>
      </section>
      <section class="ps-section ps-footer" data-ps-section="footer">
        <p class="ps-footer-mark">ASC</p>
        <p data-ps-footer-note class="ps-footer-note"></p>
      </section>
    </div>
  `.trim();
}

export function mountPartnershipCard(host: HTMLElement): PartnershipCardController {
  let onAir = false;
  let motionGen = 0;
  let exitTimer: number | null = null;
  let barTimer: number | null = null;
  const entranceTimers: number[] = [];

  const qs = <T extends HTMLElement>(selector: string): T | null =>
    host.querySelector(selector) as T | null;

  const panel = (): HTMLElement | null =>
    host.querySelector('.panel-partnership-card');

  const ensureMarkup = (): void => {
    if (!host.querySelector('.panel-partnership-card')) {
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
    if (barTimer != null) {
      window.clearTimeout(barTimer);
      barTimer = null;
    }
    const p = panel();
    if (p) {
      p.classList.remove('ps-exiting', 'ps-entering', 'ps-bar-ready');
      for (const section of p.querySelectorAll('.ps-section')) {
        section.classList.remove('ps-section-visible');
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
    const sections = [...p.querySelectorAll<HTMLElement>('.ps-section')];
    const reduced = prefersReducedMotion();

    if (reduced) {
      p.classList.add('ps-entering', 'ps-bar-ready');
      for (const section of sections) {
        section.classList.add('ps-section-visible');
      }
      return;
    }

    p.classList.remove('ps-exiting', 'ps-bar-ready');
    p.classList.add('ps-entering');
    for (const section of sections) {
      section.classList.remove('ps-section-visible');
    }
    sections.forEach((section, index) => {
      const delay = index * SECTION_STAGGER_MS;
      const timer = window.setTimeout(() => {
        if (gen !== motionGen) {
          return;
        }
        section.classList.add('ps-section-visible');
      }, delay);
      entranceTimers.push(timer);
    });

    barTimer = window.setTimeout(() => {
      barTimer = null;
      if (gen !== motionGen) {
        return;
      }
      p.classList.add('ps-bar-ready');
    }, BAR_WIPE_DELAY_MS);

    const sweep = p.querySelector<HTMLElement>('.ps-header-sweep');
    if (sweep) {
      sweep.style.animation = 'none';
      void sweep.offsetWidth;
      sweep.style.animation = '';
    }
  };

  const paintBar = (
    leftRuns: number,
    extras: number,
    rightRuns: number,
  ): void => {
    const total = leftRuns + extras + rightRuns;
    const leftEl = qs<HTMLElement>('[data-ps-bar-left]');
    const extrasEl = qs<HTMLElement>('[data-ps-bar-extras]');
    const rightEl = qs<HTMLElement>('[data-ps-bar-right]');
    const pctLeft = qs<HTMLElement>('[data-ps-pct-left]');
    const pctExtras = qs<HTMLElement>('[data-ps-pct-extras]');
    const pctRight = qs<HTMLElement>('[data-ps-pct-right]');
    const summary = qs<HTMLElement>('[data-ps-summary]');
    if (
      !leftEl ||
      !extrasEl ||
      !rightEl ||
      !pctLeft ||
      !pctExtras ||
      !pctRight ||
      !summary
    ) {
      return;
    }

    const leftPct = total > 0 ? (leftRuns / total) * 100 : 0;
    const extrasPct = total > 0 ? (extras / total) * 100 : 0;
    const rightPct = total > 0 ? (rightRuns / total) * 100 : 0;

    leftEl.style.flexGrow = String(leftRuns);
    extrasEl.style.flexGrow = String(extras);
    rightEl.style.flexGrow = String(rightRuns);
    leftEl.style.flexBasis = leftPct > 0 ? '0' : '0';
    extrasEl.style.flexBasis = extrasPct > 0 ? '0' : '0';
    rightEl.style.flexBasis = rightPct > 0 ? '0' : '0';
    leftEl.style.display = leftRuns > 0 ? '' : 'none';
    extrasEl.style.display = extras > 0 ? '' : 'none';
    rightEl.style.display = rightRuns > 0 ? '' : 'none';

    // When all zero, keep empty track (zero-width fill via no ready / empty flex).
    if (total <= 0) {
      leftEl.style.display = 'none';
      extrasEl.style.display = 'none';
      rightEl.style.display = 'none';
    }

    pctLeft.textContent = pctText(leftRuns, total);
    pctExtras.textContent = `${pctText(extras, total)} extras`;
    pctRight.textContent = pctText(rightRuns, total);
    summary.textContent = `${leftRuns} + ${extras} EXTRAS + ${rightRuns}`;
  };

  const paint = (card: ScorecardResponse, innings: InningsScorecard, ps: Partnership): boolean => {
    ensureMarkup();
    const idLine = qs<HTMLElement>('[data-ps-id-line]');
    const abbr = qs<HTMLElement>('[data-ps-abbr]');
    const vs = qs<HTMLElement>('[data-ps-vs]');
    const aName = qs<HTMLElement>('[data-ps-a-name]');
    const aScore = qs<HTMLElement>('[data-ps-a-score]');
    const aSr = qs<HTMLElement>('[data-ps-a-sr]');
    const bName = qs<HTMLElement>('[data-ps-b-name]');
    const bScore = qs<HTMLElement>('[data-ps-b-score]');
    const bSr = qs<HTMLElement>('[data-ps-b-sr]');
    const wicket = qs<HTMLElement>('[data-ps-wicket]');
    const total = qs<HTMLElement>('[data-ps-total]');
    const centerMeta = qs<HTMLElement>('[data-ps-center-meta]');
    const footerNote = qs<HTMLElement>('[data-ps-footer-note]');

    if (
      !idLine ||
      !abbr ||
      !vs ||
      !aName ||
      !aScore ||
      !aSr ||
      !bName ||
      !bScore ||
      !bSr ||
      !wicket ||
      !total ||
      !centerMeta ||
      !footerNote
    ) {
      return false;
    }

    const battingName = battingTeamLabel(card, innings);
    const bowlingName = bowlingTeamLabel(card, innings);
    const heading = inningsHeading(innings);
    idLine.textContent = `${battingName.toUpperCase()} · ${heading.toUpperCase()}`;
    abbr.textContent = teamInitials(battingName);
    vs.textContent = `vs ${bowlingName}`;

    const [aId, bId] = ps.batterIds;
    const standIndex = innings.partnerships?.length ?? 0;
    const aRuns = partnershipBatterRuns(ps, aId ?? '');
    const bRuns = partnershipBatterRuns(ps, bId ?? '');
    const aBalls = aId
      ? partnershipBatterBalls(innings.timeline, standIndex, aId)
      : 0;
    const bBalls = bId
      ? partnershipBatterBalls(innings.timeline, standIndex, bId)
      : 0;
    const extras = partnershipExtras(ps);
    const wicketNo = currentPartnershipWicketNumber(innings);
    const awaiting = ps.runs <= 0;

    aName.textContent = nameOf(card, aId ?? null);
    bName.textContent = nameOf(card, bId ?? null);
    aScore.textContent = scoreText(aRuns, aBalls);
    bScore.textContent = scoreText(bRuns, bBalls);
    aSr.textContent = `SR ${strikeRateText(aRuns, aBalls)}`;
    bSr.textContent = `SR ${strikeRateText(bRuns, bBalls)}`;

    wicket.textContent = `${wicketOrdinal(wicketNo)} WICKET`;
    total.classList.toggle('is-awaiting', awaiting);
    if (awaiting) {
      total.textContent = 'AWAITING FIRST RUN';
      centerMeta.textContent = `${ps.balls} balls · RR —`;
    } else {
      total.textContent = String(ps.runs);
      const rr = partnershipRunRate(ps.runs, ps.balls);
      centerMeta.textContent = `${ps.balls} balls · RR ${rr.toFixed(2)}`;
    }

    paintBar(aRuns, extras, bRuns);
    footerNote.textContent = `${battingName} vs ${bowlingName}`;
    return true;
  };

  const resolve = (
    card: ScorecardResponse | null,
  ): { card: ScorecardResponse; innings: InningsScorecard; ps: Partnership } | null => {
    if (!card) {
      return null;
    }
    const innings = resolveActiveInnings(card);
    const ps = innings?.partnership ?? null;
    if (!innings || !ps || ps.batterIds.length < 2) {
      return null;
    }
    return { card, innings, ps };
  };

  const hideNode = (): void => {
    cancelMotion();
    onAir = false;
    const p = panel();
    const reduced = prefersReducedMotion();
    const ms = reduced ? 0 : EXIT_MS;

    if (p && !reduced) {
      p.classList.add('ps-exiting');
      p.classList.remove('ps-entering', 'ps-bar-ready');
      for (const section of p.querySelectorAll('.ps-section')) {
        section.classList.remove('ps-section-visible');
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
      p.classList.add('ps-entering', 'ps-bar-ready');
      for (const section of p.querySelectorAll('.ps-section')) {
        section.classList.add('ps-section-visible');
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
        const resolved = resolve(card);
        if (!resolved || !paint(resolved.card, resolved.innings, resolved.ps)) {
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
    update(card) {
      try {
        if (!onAir) {
          return false;
        }
        const resolved = resolve(card);
        if (!resolved || !paint(resolved.card, resolved.innings, resolved.ps)) {
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
