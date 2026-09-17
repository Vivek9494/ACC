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

function inningsHeadingShort(innings: InningsScorecard): string {
  return inningsHeading(innings).toUpperCase();
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

function pctText(part: number, total: number): string {
  if (total <= 0) {
    return '0.0%';
  }
  return `${((part / total) * 100).toFixed(1)}%`;
}

function formatFooter(innings: InningsScorecard): string {
  const parts = [inningsHeadingShort(innings)];
  if (innings.oversAllotted != null && innings.oversAllotted > 0) {
    parts.push(`${innings.oversAllotted} OVERS`);
  }
  return parts.join(' · ');
}

function buildBatterPanel(side: 'a' | 'b'): string {
  return `
    <div class="ps-batter" data-ps-side="${side === 'a' ? 'left' : 'right'}">
      <p class="ps-batter-label">
        <span class="ps-batter-mark" aria-hidden="true"></span>
        Batter contribution
      </p>
      <p data-ps-${side}-name class="ps-batter-name">—</p>
      <div class="ps-batter-runs-row">
        <p data-ps-${side}-runs class="ps-batter-runs">0</p>
        <div class="ps-batter-runs-meta">
          <span class="ps-batter-runs-label">Runs</span>
          <span data-ps-${side}-balls class="ps-batter-balls">0 BALLS</span>
        </div>
      </div>
      <p data-ps-${side}-sr class="ps-batter-sr">Strike rate —</p>
    </div>
  `.trim();
}

function buildMarkup(): string {
  return `
    <div class="panel panel-partnership-card">
      <section class="ps-section ps-id-strip" data-ps-section="id">
        <p data-ps-id-left class="ps-id-left">ASC</p>
        <p data-ps-id-center class="ps-id-center">ASC LIVE</p>
        <p data-ps-id-right class="ps-id-right">—</p>
      </section>
      <section class="ps-section ps-header" data-ps-section="header">
        <div class="ps-header-copy">
          <p data-ps-matchup class="ps-matchup">—</p>
          <p class="ps-title">
            <span class="ps-title-main">Current</span>
            <span class="ps-title-accent">Partnership</span>
          </p>
        </div>
        <div class="ps-mono-shield" aria-hidden="true">
          <span class="ps-mono-star">★</span>
          <span data-ps-abbr class="ps-mono-abbr">—</span>
          <span class="ps-mono-stripe"></span>
        </div>
        <div class="ps-header-sweep" aria-hidden="true"></div>
      </section>
      <section class="ps-section ps-figures" data-ps-section="figures">
        ${buildBatterPanel('a')}
        <div class="ps-center">
          <p class="ps-center-label">Partnership runs</p>
          <p data-ps-total class="ps-total">0</p>
          <p data-ps-from-balls class="ps-from-balls">From 0 balls</p>
          <p data-ps-rr class="ps-rr">Run rate 0.00</p>
        </div>
        ${buildBatterPanel('b')}
      </section>
      <section class="ps-section ps-share" data-ps-section="share">
        <div class="ps-share-head">
          <p class="ps-share-title">Share of partnership</p>
          <p data-ps-summary class="ps-share-summary">0 + 0 EXTRAS + 0</p>
        </div>
        <div class="ps-bar-track" aria-hidden="true">
          <div data-ps-bar-fill class="ps-bar-fill">
            <div data-ps-bar-left class="ps-bar-seg is-left"></div>
            <div data-ps-bar-extras class="ps-bar-seg is-extras"></div>
            <div data-ps-bar-right class="ps-bar-seg is-right"></div>
          </div>
        </div>
        <div class="ps-share-pcts">
          <span data-ps-pct-left>0.0%</span>
          <span data-ps-pct-extras>Extras 0</span>
          <span data-ps-pct-right>0.0%</span>
        </div>
      </section>
      <section class="ps-section ps-footer" data-ps-section="footer">
        <p data-ps-footer-format class="ps-footer-format">—</p>
        <p class="ps-footer-brand">ASC</p>
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
    // Rebuild when upgrading from the prior compact / centered-id markup.
    if (!host.querySelector('.panel-partnership-card .ps-title-accent')) {
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

    leftEl.style.flexGrow = String(Math.max(leftRuns, 0));
    extrasEl.style.flexGrow = String(Math.max(extras, 0));
    rightEl.style.flexGrow = String(Math.max(rightRuns, 0));
    leftEl.style.flexBasis = '0';
    extrasEl.style.flexBasis = '0';
    rightEl.style.flexBasis = '0';
    leftEl.style.display = leftRuns > 0 ? '' : 'none';
    // Gray extras segment must render whenever extras > 0.
    extrasEl.style.display = extras > 0 ? '' : 'none';
    rightEl.style.display = rightRuns > 0 ? '' : 'none';

    if (total <= 0) {
      leftEl.style.display = 'none';
      extrasEl.style.display = 'none';
      rightEl.style.display = 'none';
    }

    pctLeft.textContent = pctText(leftRuns, total);
    pctExtras.textContent = `Extras ${extras}`;
    pctRight.textContent = pctText(rightRuns, total);
    summary.textContent = `${leftRuns} + ${extras} EXTRAS + ${rightRuns}`;
  };

  const paint = (
    card: ScorecardResponse,
    innings: InningsScorecard,
    ps: Partnership,
  ): boolean => {
    ensureMarkup();
    const idLeft = qs<HTMLElement>('[data-ps-id-left]');
    const idCenter = qs<HTMLElement>('[data-ps-id-center]');
    const idRight = qs<HTMLElement>('[data-ps-id-right]');
    const abbr = qs<HTMLElement>('[data-ps-abbr]');
    const matchup = qs<HTMLElement>('[data-ps-matchup]');
    const aName = qs<HTMLElement>('[data-ps-a-name]');
    const aRuns = qs<HTMLElement>('[data-ps-a-runs]');
    const aBalls = qs<HTMLElement>('[data-ps-a-balls]');
    const aSr = qs<HTMLElement>('[data-ps-a-sr]');
    const bName = qs<HTMLElement>('[data-ps-b-name]');
    const bRunsEl = qs<HTMLElement>('[data-ps-b-runs]');
    const bBalls = qs<HTMLElement>('[data-ps-b-balls]');
    const bSr = qs<HTMLElement>('[data-ps-b-sr]');
    const total = qs<HTMLElement>('[data-ps-total]');
    const fromBalls = qs<HTMLElement>('[data-ps-from-balls]');
    const rrEl = qs<HTMLElement>('[data-ps-rr]');
    const footerFormat = qs<HTMLElement>('[data-ps-footer-format]');

    if (
      !idLeft ||
      !idCenter ||
      !idRight ||
      !abbr ||
      !matchup ||
      !aName ||
      !aRuns ||
      !aBalls ||
      !aSr ||
      !bName ||
      !bRunsEl ||
      !bBalls ||
      !bSr ||
      !total ||
      !fromBalls ||
      !rrEl ||
      !footerFormat
    ) {
      return false;
    }

    const battingName = battingTeamLabel(card, innings);
    const bowlingName = bowlingTeamLabel(card, innings);
    const wicketNo = currentPartnershipWicketNumber(innings);

    idLeft.textContent = 'ASC';
    idCenter.textContent = `${battingName} v ${bowlingName}`.toUpperCase();
    idRight.textContent = `${wicketOrdinal(wicketNo)} WICKET`;

    abbr.textContent = teamInitials(battingName);
    matchup.textContent = `${battingName} v ${bowlingName}`;

    const [aId, bId] = ps.batterIds;
    const standIndex = innings.partnerships?.length ?? 0;
    const leftRuns = partnershipBatterRuns(ps, aId ?? '');
    const rightRuns = partnershipBatterRuns(ps, bId ?? '');
    const leftBalls = aId
      ? partnershipBatterBalls(innings.timeline, standIndex, aId)
      : 0;
    const rightBalls = bId
      ? partnershipBatterBalls(innings.timeline, standIndex, bId)
      : 0;
    const extras = partnershipExtras(ps);
    const awaiting = ps.runs <= 0;

    aName.textContent = nameOf(card, aId ?? null);
    bName.textContent = nameOf(card, bId ?? null);
    aRuns.textContent = String(leftRuns);
    bRunsEl.textContent = String(rightRuns);
    aBalls.textContent = `${leftBalls} BALLS`;
    bBalls.textContent = `${rightBalls} BALLS`;
    aSr.textContent = `Strike rate ${strikeRateText(leftRuns, leftBalls)}`;
    bSr.textContent = `Strike rate ${strikeRateText(rightRuns, rightBalls)}`;

    total.classList.toggle('is-awaiting', awaiting);
    if (awaiting) {
      total.textContent = '—';
      fromBalls.textContent = `From ${ps.balls} balls`;
      rrEl.textContent = 'Run rate —';
    } else {
      total.textContent = String(ps.runs);
      fromBalls.textContent = `From ${ps.balls} balls`;
      const rr = partnershipRunRate(ps.runs, ps.balls);
      rrEl.textContent = `Run rate ${rr.toFixed(2)}`;
    }

    paintBar(leftRuns, extras, rightRuns);
    footerFormat.textContent = formatFooter(innings);
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
