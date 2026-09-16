/**
 * Premium in-match BATTER card — this-innings figures for a crease batter.
 */

import './batsman-match-card.css';
import {
  battingTeamLabel,
  bowlingTeamLabel,
  deriveBatterDotBalls,
  playerName,
  resolveActiveInnings,
  shortName,
} from './graphics-format';
import { concealGraphic, revealGraphic } from './graphic-visibility';
import type {
  BatterCard,
  InningsScorecard,
  ScorecardResponse,
} from './types';

const SECTION_STAGGER_MS = 45;
const EXIT_MS = 320;

export interface BatsmanMatchShowOptions {
  playerId: string;
  /** When false, repaint without replaying entrance. */
  animate?: boolean;
}

export interface BatsmanMatchCardController {
  host: HTMLElement;
  isOnAir: () => boolean;
  hide: () => void;
  show: (
    card: ScorecardResponse | null,
    options: BatsmanMatchShowOptions,
  ) => boolean;
  update: (
    card: ScorecardResponse | null,
    options: Pick<BatsmanMatchShowOptions, 'playerId'>,
  ) => boolean;
}

function warnGraphics(err: unknown): void {
  console.warn('[batsman-match-card]', err);
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

function strikeRateText(batter: BatterCard | undefined): string {
  if (!batter || batter.balls <= 0) {
    return '—';
  }
  if (Number.isFinite(batter.strikeRate)) {
    return batter.strikeRate.toFixed(2);
  }
  return ((batter.runs / batter.balls) * 100).toFixed(2);
}

function creaseChip(
  innings: InningsScorecard,
  playerId: string,
): string | null {
  if (innings.currentStrikerId === playerId) {
    return 'STRIKER';
  }
  if (innings.currentNonStrikerId === playerId) {
    return 'NON-STRIKER';
  }
  return null;
}

function buildMarkup(): string {
  return `
    <div class="panel panel-batsman-match">
      <section class="bm-section bm-id-strip" data-bm-section="id">
        <p data-bm-id-line class="bm-id-line">BATTER</p>
      </section>
      <section class="bm-section bm-header" data-bm-section="title">
        <div class="bm-header-copy">
          <p class="bm-kicker">This innings</p>
          <p class="bm-title">Batter</p>
          <p data-bm-name class="bm-player-name">—</p>
          <p data-bm-vs class="bm-vs-line">—</p>
        </div>
        <div class="bm-header-aside">
          <div class="bm-score-block">
            <p class="bm-score-label">Score</p>
            <p data-bm-headline class="bm-score-value">0 (0)</p>
          </div>
          <p data-bm-chip class="bm-role-chip" hidden>—</p>
        </div>
        <div class="bm-header-sweep" aria-hidden="true"></div>
      </section>
      <div class="bm-stats" role="group" aria-label="This innings batting">
        <section class="bm-section bm-cell is-edge" data-bm-section="runs">
          <p class="bm-cell-label">Runs</p>
          <p data-bm-runs class="bm-cell-value">0</p>
        </section>
        <section class="bm-section bm-cell is-alt" data-bm-section="balls">
          <p class="bm-cell-label">Balls</p>
          <p data-bm-balls class="bm-cell-value">0</p>
        </section>
        <section class="bm-section bm-cell" data-bm-section="dots">
          <p class="bm-cell-label">Dots</p>
          <p data-bm-dots class="bm-cell-value">0</p>
        </section>
        <section class="bm-section bm-cell is-alt" data-bm-section="fours">
          <p class="bm-cell-label">4s</p>
          <p data-bm-fours class="bm-cell-value">0</p>
        </section>
        <section class="bm-section bm-cell" data-bm-section="sixes">
          <p class="bm-cell-label">6s</p>
          <p data-bm-sixes class="bm-cell-value">0</p>
        </section>
        <section class="bm-section bm-cell is-sr" data-bm-section="sr">
          <p class="bm-cell-label">Strike rate</p>
          <p data-bm-sr class="bm-cell-value">—</p>
        </section>
      </div>
      <section class="bm-section bm-footer" data-bm-section="footer">
        <p class="bm-footer-mark">ASC</p>
        <p data-bm-footer-note class="bm-footer-note"></p>
      </section>
    </div>
  `.trim();
}

export function mountBatsmanMatchCard(
  host: HTMLElement,
): BatsmanMatchCardController {
  let onAir = false;
  let activePlayerId: string | null = null;
  let motionGen = 0;
  let exitTimer: number | null = null;
  const entranceTimers: number[] = [];

  const qs = <T extends HTMLElement>(selector: string): T | null =>
    host.querySelector(selector) as T | null;

  const panel = (): HTMLElement | null =>
    host.querySelector('.panel-batsman-match');

  const ensureMarkup = (): void => {
    if (!host.querySelector('.panel-batsman-match')) {
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
      p.classList.remove('bm-exiting', 'bm-entering');
      for (const section of p.querySelectorAll('.bm-section')) {
        section.classList.remove('bm-section-visible');
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
    const sections = [...p.querySelectorAll<HTMLElement>('.bm-section')];
    if (prefersReducedMotion()) {
      p.classList.add('bm-entering');
      for (const section of sections) {
        section.classList.add('bm-section-visible');
      }
      return;
    }
    p.classList.remove('bm-exiting');
    p.classList.add('bm-entering');
    for (const section of sections) {
      section.classList.remove('bm-section-visible');
    }
    sections.forEach((section, index) => {
      const delay = index * SECTION_STAGGER_MS;
      const timer = window.setTimeout(() => {
        if (gen !== motionGen) {
          return;
        }
        section.classList.add('bm-section-visible');
      }, delay);
      entranceTimers.push(timer);
    });
    const sweep = p.querySelector<HTMLElement>('.bm-header-sweep');
    if (sweep) {
      sweep.style.animation = 'none';
      void sweep.offsetWidth;
      sweep.style.animation = '';
    }
  };

  const paint = (card: ScorecardResponse, playerId: string): boolean => {
    ensureMarkup();
    const innings = resolveActiveInnings(card);
    if (!innings) {
      return false;
    }
    const batter = innings.batters.find((b) => b.playerId === playerId);

    const idLine = qs<HTMLElement>('[data-bm-id-line]');
    const name = qs<HTMLElement>('[data-bm-name]');
    const vs = qs<HTMLElement>('[data-bm-vs]');
    const headline = qs<HTMLElement>('[data-bm-headline]');
    const chip = qs<HTMLElement>('[data-bm-chip]');
    const runs = qs<HTMLElement>('[data-bm-runs]');
    const balls = qs<HTMLElement>('[data-bm-balls]');
    const dots = qs<HTMLElement>('[data-bm-dots]');
    const fours = qs<HTMLElement>('[data-bm-fours]');
    const sixes = qs<HTMLElement>('[data-bm-sixes]');
    const sr = qs<HTMLElement>('[data-bm-sr]');
    const footerNote = qs<HTMLElement>('[data-bm-footer-note]');

    if (
      !idLine ||
      !name ||
      !vs ||
      !headline ||
      !chip ||
      !runs ||
      !balls ||
      !dots ||
      !fours ||
      !sixes ||
      !sr ||
      !footerNote
    ) {
      return false;
    }

    const battingName = battingTeamLabel(card, innings);
    const bowlingName = bowlingTeamLabel(card, innings);
    const heading = inningsHeading(innings);
    idLine.textContent = `${battingName.toUpperCase()} · ${heading.toUpperCase()}`;
    name.textContent = nameOf(card, playerId);
    vs.textContent = `${battingName} vs ${bowlingName}`;

    const r = batter?.runs ?? 0;
    const b = batter?.balls ?? 0;
    headline.textContent = `${r} (${b})`;

    const role = creaseChip(innings, playerId);
    if (role) {
      chip.hidden = false;
      chip.textContent = role;
    } else {
      chip.hidden = true;
      chip.textContent = '';
    }

    runs.textContent = String(r);
    balls.textContent = String(b);
    dots.textContent = String(deriveBatterDotBalls(batter));
    fours.textContent = String(batter?.fours ?? 0);
    sixes.textContent = String(batter?.sixes ?? 0);
    sr.textContent = strikeRateText(batter);
    footerNote.textContent = `${battingName} vs ${bowlingName} · ${heading}`;
    return true;
  };

  const hideNode = (): void => {
    cancelMotion();
    onAir = false;
    activePlayerId = null;
    const p = panel();
    const reduced = prefersReducedMotion();
    const ms = reduced ? 0 : EXIT_MS;

    if (p && !reduced) {
      p.classList.add('bm-exiting');
      p.classList.remove('bm-entering');
      for (const section of p.querySelectorAll('.bm-section')) {
        section.classList.remove('bm-section-visible');
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
      p.classList.add('bm-entering');
      for (const section of p.querySelectorAll('.bm-section')) {
        section.classList.add('bm-section-visible');
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
        activePlayerId = null;
        host.hidden = true;
        host.classList.remove('is-visible');
      }
    },
    show(card, options) {
      try {
        const playerId = options.playerId?.trim() || '';
        if (!card || !playerId || !paint(card, playerId)) {
          hideNode();
          return false;
        }
        activePlayerId = playerId;
        onAir = true;
        reveal(options.animate !== false);
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
        const playerId = options.playerId?.trim() || activePlayerId || '';
        if (!card || !playerId || !paint(card, playerId)) {
          hideNode();
          return false;
        }
        activePlayerId = playerId;
        return true;
      } catch (err) {
        warnGraphics(err);
        hideNode();
        return false;
      }
    },
  };
}
