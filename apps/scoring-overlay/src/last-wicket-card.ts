/**
 * Premium LAST WICKET card — most-recently-dismissed batter's innings figures.
 */

import './last-wicket-card.css';
import {
  battingTeamLabel,
  bowlingTeamLabel,
  deriveBatterDotBalls,
  findInningsByKey,
  formatDismissalShort,
  latestFallOfWicket,
  playerName,
  resolveActiveInnings,
  shortName,
} from './graphics-format';
import { concealGraphic, revealGraphic } from './graphic-visibility';
import type {
  BatterCard,
  FallOfWicket,
  InningsScorecard,
  ScorecardResponse,
} from './types';
import { teamInitials } from './view-model';

const SECTION_STAGGER_MS = 45;
const EXIT_MS = 320;

export interface LastWicketCardShowOptions {
  /** Prefer this innings (team Last wicket payload); else active innings. */
  inningsId?: string | null;
  /** When false, repaint without replaying entrance. */
  animate?: boolean;
}

export interface LastWicketCardController {
  host: HTMLElement;
  isOnAir: () => boolean;
  hide: () => void;
  show: (
    card: ScorecardResponse | null,
    options?: LastWicketCardShowOptions,
  ) => boolean;
  update: (
    card: ScorecardResponse | null,
    options?: Pick<LastWicketCardShowOptions, 'inningsId'>,
  ) => boolean;
}

function warnGraphics(err: unknown): void {
  console.warn('[last-wicket-card]', err);
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

function strikeRateText(batter: BatterCard | undefined): string {
  if (!batter || batter.balls <= 0) {
    return '—';
  }
  if (Number.isFinite(batter.strikeRate)) {
    return batter.strikeRate.toFixed(2);
  }
  return ((batter.runs / batter.balls) * 100).toFixed(2);
}

function boundaryRuns(batter: BatterCard | undefined): number {
  if (!batter) {
    return 0;
  }
  return batter.fours * 4 + batter.sixes * 6;
}

function buildMarkup(): string {
  return `
    <div class="panel panel-last-wicket">
      <section class="lw-section lw-id-strip" data-lw-section="id">
        <p data-lw-id-line class="lw-id-line">LAST WICKET</p>
      </section>
      <section class="lw-section lw-header" data-lw-section="title">
        <div class="lw-w-badge" aria-hidden="true">W</div>
        <div class="lw-header-copy">
          <p class="lw-kicker">Fall of wicket</p>
          <p class="lw-title">Last Wicket</p>
          <p data-lw-vs class="lw-vs-line">—</p>
        </div>
        <p data-lw-wicket-chip class="lw-wicket-chip">—</p>
        <div class="lw-header-sweep" aria-hidden="true"></div>
      </section>
      <div class="lw-stats" role="group" aria-label="Dismissed batter figures">
        <section class="lw-section lw-cell is-name" data-lw-section="name">
          <p class="lw-cell-label">Name</p>
          <p data-lw-name class="lw-cell-value">—</p>
        </section>
        <section class="lw-section lw-cell is-runs" data-lw-section="runs">
          <p class="lw-cell-label">Runs</p>
          <p data-lw-runs class="lw-cell-value">0</p>
        </section>
        <section class="lw-section lw-cell is-alt" data-lw-section="balls">
          <p class="lw-cell-label">Balls</p>
          <p data-lw-balls class="lw-cell-value">0</p>
        </section>
        <section class="lw-section lw-cell" data-lw-section="dots">
          <p class="lw-cell-label">Dots</p>
          <p data-lw-dots class="lw-cell-value">0</p>
        </section>
        <section class="lw-section lw-cell is-alt" data-lw-section="fours">
          <p class="lw-cell-label">4s</p>
          <p data-lw-fours class="lw-cell-value">0</p>
        </section>
        <section class="lw-section lw-cell" data-lw-section="sixes">
          <p class="lw-cell-label">6s</p>
          <p data-lw-sixes class="lw-cell-value">0</p>
        </section>
        <section class="lw-section lw-cell is-sr" data-lw-section="sr">
          <p class="lw-cell-label">Strike rate</p>
          <p data-lw-sr class="lw-cell-value">—</p>
        </section>
      </div>
      <section class="lw-section lw-dismissal" data-lw-section="dismissal">
        <p data-lw-dismissal class="lw-dismissal-text">out</p>
        <p data-lw-boundaries class="lw-boundaries">0 RUNS IN BOUNDARIES</p>
      </section>
      <section class="lw-section lw-footer" data-lw-section="footer">
        <p class="lw-footer-mark">ASC</p>
        <p data-lw-footer-note class="lw-footer-note"></p>
      </section>
    </div>
  `.trim();
}

export function mountLastWicketCard(host: HTMLElement): LastWicketCardController {
  let onAir = false;
  let motionGen = 0;
  let exitTimer: number | null = null;
  const entranceTimers: number[] = [];

  const qs = <T extends HTMLElement>(selector: string): T | null =>
    host.querySelector(selector) as T | null;

  const panel = (): HTMLElement | null =>
    host.querySelector('.panel-last-wicket');

  const ensureMarkup = (): void => {
    if (!host.querySelector('.panel-last-wicket')) {
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
      p.classList.remove('lw-exiting', 'lw-entering');
      for (const section of p.querySelectorAll('.lw-section')) {
        section.classList.remove('lw-section-visible');
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
    const sections = [...p.querySelectorAll<HTMLElement>('.lw-section')];
    if (prefersReducedMotion()) {
      p.classList.add('lw-entering');
      for (const section of sections) {
        section.classList.add('lw-section-visible');
      }
      return;
    }
    p.classList.remove('lw-exiting');
    p.classList.add('lw-entering');
    for (const section of sections) {
      section.classList.remove('lw-section-visible');
    }
    sections.forEach((section, index) => {
      const delay = index * SECTION_STAGGER_MS;
      const timer = window.setTimeout(() => {
        if (gen !== motionGen) {
          return;
        }
        section.classList.add('lw-section-visible');
      }, delay);
      entranceTimers.push(timer);
    });
    const sweep = p.querySelector<HTMLElement>('.lw-header-sweep');
    if (sweep) {
      sweep.style.animation = 'none';
      void sweep.offsetWidth;
      sweep.style.animation = '';
    }
  };

  const resolve = (
    card: ScorecardResponse | null,
    inningsId: string | null | undefined,
  ): {
    card: ScorecardResponse;
    innings: InningsScorecard;
    fow: FallOfWicket;
    batter: BatterCard | undefined;
  } | null => {
    if (!card) {
      return null;
    }
    const innings =
      (inningsId?.trim()
        ? findInningsByKey(card, inningsId.trim())
        : null) ?? resolveActiveInnings(card);
    const fow = latestFallOfWicket(innings);
    if (!innings || !fow) {
      return null;
    }
    const batter = innings.batters.find((b) => b.playerId === fow.playerId);
    return { card, innings, fow, batter };
  };

  const paint = (
    card: ScorecardResponse,
    innings: InningsScorecard,
    fow: FallOfWicket,
    batter: BatterCard | undefined,
  ): boolean => {
    ensureMarkup();
    const idLine = qs<HTMLElement>('[data-lw-id-line]');
    const vs = qs<HTMLElement>('[data-lw-vs]');
    const chip = qs<HTMLElement>('[data-lw-wicket-chip]');
    const name = qs<HTMLElement>('[data-lw-name]');
    const runs = qs<HTMLElement>('[data-lw-runs]');
    const balls = qs<HTMLElement>('[data-lw-balls]');
    const dots = qs<HTMLElement>('[data-lw-dots]');
    const fours = qs<HTMLElement>('[data-lw-fours]');
    const sixes = qs<HTMLElement>('[data-lw-sixes]');
    const sr = qs<HTMLElement>('[data-lw-sr]');
    const dismissal = qs<HTMLElement>('[data-lw-dismissal]');
    const boundaries = qs<HTMLElement>('[data-lw-boundaries]');
    const footerNote = qs<HTMLElement>('[data-lw-footer-note]');

    if (
      !idLine ||
      !vs ||
      !chip ||
      !name ||
      !runs ||
      !balls ||
      !dots ||
      !fours ||
      !sixes ||
      !sr ||
      !dismissal ||
      !boundaries ||
      !footerNote
    ) {
      return false;
    }

    const battingName = battingTeamLabel(card, innings);
    const bowlingName = bowlingTeamLabel(card, innings);
    const heading = inningsHeading(innings);
    idLine.textContent = `${battingName.toUpperCase()} · ${heading.toUpperCase()}`;
    vs.textContent = `${teamInitials(battingName)} vs ${bowlingName}`;
    chip.textContent = `${wicketOrdinal(fow.wicketNumber)} WICKET`;

    name.textContent = nameOf(card, fow.playerId);
    runs.textContent = String(batter?.runs ?? 0);
    balls.textContent = String(batter?.balls ?? 0);
    dots.textContent = String(deriveBatterDotBalls(batter));
    fours.textContent = String(batter?.fours ?? 0);
    sixes.textContent = String(batter?.sixes ?? 0);
    sr.textContent = strikeRateText(batter);

    const howOut = batter
      ? formatDismissalShort(batter, (id) => nameOf(card, id)).trim()
      : '';
    dismissal.textContent = howOut || 'out';
    const bound = boundaryRuns(batter);
    boundaries.textContent = `${bound} RUNS IN BOUNDARIES`;
    footerNote.textContent = `${battingName} vs ${bowlingName} · ${fow.oversText} ov`;
    return true;
  };

  const hideNode = (): void => {
    cancelMotion();
    onAir = false;
    const p = panel();
    const reduced = prefersReducedMotion();
    const ms = reduced ? 0 : EXIT_MS;

    if (p && !reduced) {
      p.classList.add('lw-exiting');
      p.classList.remove('lw-entering');
      for (const section of p.querySelectorAll('.lw-section')) {
        section.classList.remove('lw-section-visible');
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
      p.classList.add('lw-entering');
      for (const section of p.querySelectorAll('.lw-section')) {
        section.classList.add('lw-section-visible');
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
        if (
          !resolved ||
          !paint(resolved.card, resolved.innings, resolved.fow, resolved.batter)
        ) {
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
        if (
          !resolved ||
          !paint(resolved.card, resolved.innings, resolved.fow, resolved.batter)
        ) {
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
