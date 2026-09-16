/**
 * Premium in-match BOWLER card — this-innings figures for a selected bowler.
 */

import './bowler-match-card.css';
import {
  battingTeamLabel,
  bowlingTeamLabel,
  formatStat,
  playerName,
  resolveActiveInnings,
  shortName,
} from './graphics-format';
import { concealGraphic, revealGraphic } from './graphic-visibility';
import type {
  BowlerCard,
  InningsScorecard,
  ScorecardResponse,
} from './types';

const SECTION_STAGGER_MS = 45;
const EXIT_MS = 320;

export interface BowlerMatchShowOptions {
  playerId: string;
  /** When false, repaint without replaying entrance. */
  animate?: boolean;
}

export interface BowlerMatchCardController {
  host: HTMLElement;
  isOnAir: () => boolean;
  hide: () => void;
  show: (
    card: ScorecardResponse | null,
    options: BowlerMatchShowOptions,
  ) => boolean;
  update: (
    card: ScorecardResponse | null,
    options: Pick<BowlerMatchShowOptions, 'playerId'>,
  ) => boolean;
}

function warnGraphics(err: unknown): void {
  console.warn('[bowler-match-card]', err);
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

function economyText(bowler: BowlerCard | undefined): string {
  if (!bowler || bowler.legalBalls <= 0) {
    return '—';
  }
  if (Number.isFinite(bowler.economy)) {
    return formatStat(bowler.economy, 2);
  }
  return '—';
}

function buildMarkup(): string {
  return `
    <div class="panel panel-bowler-match">
      <section class="bowl-section bowl-id-strip" data-bowl-section="id">
        <p data-bowl-id-line class="bowl-id-line">BOWLER</p>
      </section>
      <section class="bowl-section bowl-header" data-bowl-section="title">
        <div class="bowl-header-copy">
          <p class="bowl-kicker">This innings</p>
          <p class="bowl-title">Bowler</p>
          <p data-bowl-name class="bowl-player-name">—</p>
          <p data-bowl-vs class="bowl-vs-line">—</p>
        </div>
        <div class="bowl-header-aside">
          <div class="bowl-score-block">
            <p class="bowl-score-label">Figures</p>
            <p data-bowl-headline class="bowl-score-value">0/0</p>
          </div>
          <p data-bowl-chip class="bowl-role-chip" hidden>—</p>
        </div>
        <div class="bowl-header-sweep" aria-hidden="true"></div>
      </section>
      <div class="bowl-stats" role="group" aria-label="This innings bowling">
        <section class="bowl-section bowl-cell is-edge" data-bowl-section="overs">
          <p class="bowl-cell-label">Overs</p>
          <p data-bowl-overs class="bowl-cell-value">0.0</p>
        </section>
        <section class="bowl-section bowl-cell is-alt" data-bowl-section="maidens">
          <p class="bowl-cell-label">Maidens</p>
          <p data-bowl-maidens class="bowl-cell-value">0</p>
        </section>
        <section class="bowl-section bowl-cell" data-bowl-section="runs">
          <p class="bowl-cell-label">Runs</p>
          <p data-bowl-runs class="bowl-cell-value">0</p>
        </section>
        <section class="bowl-section bowl-cell is-alt" data-bowl-section="wickets">
          <p class="bowl-cell-label">Wickets</p>
          <p data-bowl-wickets class="bowl-cell-value">0</p>
        </section>
        <section class="bowl-section bowl-cell" data-bowl-section="dots">
          <p class="bowl-cell-label">Dots</p>
          <p data-bowl-dots class="bowl-cell-value">0</p>
        </section>
        <section class="bowl-section bowl-cell is-sr" data-bowl-section="econ">
          <p class="bowl-cell-label">Economy</p>
          <p data-bowl-econ class="bowl-cell-value">—</p>
        </section>
      </div>
      <section class="bowl-section bowl-footer" data-bowl-section="footer">
        <p class="bowl-footer-mark">ASC</p>
        <p data-bowl-footer-note class="bowl-footer-note"></p>
      </section>
    </div>
  `.trim();
}

export function mountBowlerMatchCard(
  host: HTMLElement,
): BowlerMatchCardController {
  let onAir = false;
  let activePlayerId: string | null = null;
  let motionGen = 0;
  let exitTimer: number | null = null;
  const entranceTimers: number[] = [];

  const qs = <T extends HTMLElement>(selector: string): T | null =>
    host.querySelector(selector) as T | null;

  const panel = (): HTMLElement | null =>
    host.querySelector('.panel-bowler-match');

  const ensureMarkup = (): void => {
    if (!host.querySelector('.panel-bowler-match')) {
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
    const sections = [...p.querySelectorAll<HTMLElement>('.bowl-section')];
    if (prefersReducedMotion()) {
      p.classList.add('bowl-entering');
      for (const section of sections) {
        section.classList.add('bowl-section-visible');
      }
      return;
    }
    p.classList.remove('bowl-exiting');
    p.classList.add('bowl-entering');
    for (const section of sections) {
      section.classList.remove('bowl-section-visible');
    }
    sections.forEach((section, index) => {
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

  const paint = (card: ScorecardResponse, playerId: string): boolean => {
    ensureMarkup();
    const innings = resolveActiveInnings(card);
    if (!innings) {
      return false;
    }
    const bowler = innings.bowlers.find((b) => b.playerId === playerId);

    const idLine = qs<HTMLElement>('[data-bowl-id-line]');
    const name = qs<HTMLElement>('[data-bowl-name]');
    const vs = qs<HTMLElement>('[data-bowl-vs]');
    const headline = qs<HTMLElement>('[data-bowl-headline]');
    const chip = qs<HTMLElement>('[data-bowl-chip]');
    const overs = qs<HTMLElement>('[data-bowl-overs]');
    const maidens = qs<HTMLElement>('[data-bowl-maidens]');
    const runs = qs<HTMLElement>('[data-bowl-runs]');
    const wickets = qs<HTMLElement>('[data-bowl-wickets]');
    const dots = qs<HTMLElement>('[data-bowl-dots]');
    const econ = qs<HTMLElement>('[data-bowl-econ]');
    const footerNote = qs<HTMLElement>('[data-bowl-footer-note]');

    if (
      !idLine ||
      !name ||
      !vs ||
      !headline ||
      !chip ||
      !overs ||
      !maidens ||
      !runs ||
      !wickets ||
      !dots ||
      !econ ||
      !footerNote
    ) {
      return false;
    }

    const battingName = battingTeamLabel(card, innings);
    const bowlingName = bowlingTeamLabel(card, innings);
    const heading = inningsHeading(innings);
    idLine.textContent = `${bowlingName.toUpperCase()} · ${heading.toUpperCase()}`;
    name.textContent = nameOf(card, playerId);
    vs.textContent = `${bowlingName} vs ${battingName}`;

    const w = bowler?.wickets ?? 0;
    const r = bowler?.runsConceded ?? 0;
    headline.textContent = `${w}/${r}`;

    if (innings.currentBowlerId === playerId) {
      chip.hidden = false;
      chip.textContent = 'CURRENT';
    } else {
      chip.hidden = true;
      chip.textContent = '';
    }

    overs.textContent = bowler?.oversText?.trim() || '0.0';
    maidens.textContent = String(bowler?.maidens ?? 0);
    runs.textContent = String(r);
    wickets.textContent = String(w);
    dots.textContent = String(bowler?.dotBalls ?? 0);
    econ.textContent = economyText(bowler);
    footerNote.textContent = `${bowlingName} vs ${battingName} · ${heading}`;
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
      return;
    }
    const p = panel();
    if (p) {
      p.classList.add('bowl-entering');
      for (const section of p.querySelectorAll('.bowl-section')) {
        section.classList.add('bowl-section-visible');
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
