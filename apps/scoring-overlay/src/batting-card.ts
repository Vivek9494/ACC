/**
 * Batting card — premium broadcast batting scorecard for one team's innings.
 */

import {
  battingTeamLabel,
  findInningsByKey,
  formatDismissalShort,
  formatStat,
  playerName,
  resolveBattingSide,
  shortName,
  type SidePlayer,
} from './graphics-format';
import { concealGraphic, revealGraphic } from './graphic-visibility';
import type {
  BatterCard,
  ExtrasBreakdown,
  InningsScorecard,
  MatchContext,
  ScorecardResponse,
} from './types';
import { teamInitials } from './view-model';

import './batting-card.css';

const BALLS_PER_OVER = 6;
const SECTION_STAGGER_MS = 48;
const EXIT_MS = 320;

export interface BattingCardShowOptions {
  /** When false, repaint live data without replaying section entrance. */
  animate?: boolean;
}

export interface BattingCardController {
  host: HTMLElement;
  isOnAir: () => boolean;
  hide: () => void;
  show: (
    card: ScorecardResponse | null,
    inningsId: string | null,
    ctx: MatchContext | null,
    options?: BattingCardShowOptions,
  ) => boolean;
  update: (
    card: ScorecardResponse | null,
    inningsId: string | null,
    ctx: MatchContext | null,
  ) => boolean;
}

function warnGraphics(err: unknown): void {
  console.warn('[batting-card]', err);
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

function howOutText(card: ScorecardResponse, batter: BatterCard): string {
  if (batter.retiredHurt && !batter.isOut) {
    return 'retired hurt';
  }
  if (!batter.isOut) {
    return 'not out';
  }
  return formatDismissalShort(batter, (id) => nameOf(card, id)).trim() || 'out';
}

function strikeRateText(batter: BatterCard): string {
  if (batter.balls <= 0) {
    return '—';
  }
  if (Number.isFinite(batter.strikeRate)) {
    return formatStat(batter.strikeRate, 2);
  }
  return formatStat((batter.runs / batter.balls) * 100, 2);
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

function runRateText(innings: InningsScorecard): string {
  if (innings.legalBalls <= 0) {
    return '0.00';
  }
  const rr = (innings.runs * BALLS_PER_OVER) / innings.legalBalls;
  return Number.isFinite(rr) ? rr.toFixed(2) : '0.00';
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

function dnbInRosterOrder(
  xi: SidePlayer[],
  seen: ReadonlySet<string>,
): SidePlayer[] {
  const remaining = xi.filter((p) => !seen.has(String(p.playerId)));
  if (remaining.length === 0) {
    return remaining;
  }
  const allHaveOrder = remaining.every((p) => p.order != null);
  if (!allHaveOrder) {
    return remaining;
  }
  return [...remaining].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function yetToBatNames(
  card: ScorecardResponse,
  innings: InningsScorecard,
  ctx: MatchContext | null,
): string[] {
  const side = resolveBattingSide(card, innings, ctx);
  if (!side || side.players.length === 0) {
    return [];
  }
  const seen = new Set(innings.batters.map((b) => String(b.playerId)));
  const waiting = dnbInRosterOrder(side.players, seen);
  const names: string[] = [];
  for (const p of waiting) {
    const fromDisplay = playerName(card.display, p.playerId);
    const label =
      fromDisplay !== '—'
        ? shortName(fromDisplay)
        : p.name
          ? shortName(p.name)
          : '—';
    if (label !== '—') {
      names.push(label);
    }
  }
  return names;
}

function buildMarkup(): string {
  return `
    <div class="panel panel-batting-card">
      <section class="bc-section bc-id-strip" data-bc-section="id">
        <p data-bc-id-line class="bc-id-line">BATTING SCORECARD</p>
      </section>
      <section class="bc-section bc-header" data-bc-section="header">
        <div class="bc-header-inner">
          <div data-bc-monogram class="bc-monogram" aria-hidden="true">—</div>
          <div class="bc-header-copy">
            <p class="bc-kicker">Batting scorecard</p>
            <p data-bc-team class="bc-team-name">—</p>
            <p data-bc-innings-label class="bc-innings-label">—</p>
          </div>
          <p data-bc-total class="bc-total-badge">0/0</p>
        </div>
        <div class="bc-header-sweep" aria-hidden="true"></div>
      </section>
      <section class="bc-section bc-columns" data-bc-section="columns">
        <div class="bc-col-grid bc-col-head" role="row">
          <span class="bc-col-name">Batter</span>
          <span class="bc-col-how">How out</span>
          <span class="bc-col-num">R</span>
          <span class="bc-col-num">B</span>
          <span class="bc-col-num">4s</span>
          <span class="bc-col-num">6s</span>
          <span class="bc-col-num">SR</span>
        </div>
      </section>
      <section class="bc-section bc-rows-wrap" data-bc-section="rows">
        <div data-bc-rows class="bc-rows"></div>
        <p data-bc-empty class="bc-empty" hidden>No batters yet</p>
      </section>
      <section class="bc-section bc-extras" data-bc-section="extras">
        <p data-bc-extras class="bc-extras-line">Extras</p>
        <div class="bc-extras-grid">
          <div class="bc-extra-cell"><span class="bc-extra-k">B</span><span data-bc-ex-b class="bc-extra-v">0</span></div>
          <div class="bc-extra-cell"><span class="bc-extra-k">LB</span><span data-bc-ex-lb class="bc-extra-v">0</span></div>
          <div class="bc-extra-cell"><span class="bc-extra-k">WD</span><span data-bc-ex-wd class="bc-extra-v">0</span></div>
          <div class="bc-extra-cell"><span class="bc-extra-k">NB</span><span data-bc-ex-nb class="bc-extra-v">0</span></div>
        </div>
      </section>
      <section class="bc-section bc-ytb" data-bc-section="ytb" hidden>
        <p data-bc-ytb-label class="bc-ytb-label">Yet to bat</p>
        <p data-bc-ytb-names class="bc-ytb-names"></p>
      </section>
      <section class="bc-section bc-footer" data-bc-section="footer">
        <p data-bc-footer class="bc-footer-line">—</p>
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

export function mountBattingCard(host: HTMLElement): BattingCardController {
  let onAir = false;
  let motionGen = 0;
  let exitTimer: number | null = null;
  const entranceTimers: number[] = [];

  const qs = <T extends HTMLElement>(selector: string): T | null =>
    host.querySelector(selector) as T | null;

  const panel = (): HTMLElement | null => host.querySelector('.panel-batting-card');

  const ensureMarkup = (): void => {
    if (!host.querySelector('.panel-batting-card')) {
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
      p.classList.remove('bc-exiting', 'bc-entering');
      for (const section of p.querySelectorAll('.bc-section')) {
        section.classList.remove('bc-section-visible');
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
      p.classList.add('bc-entering');
      for (const section of p.querySelectorAll('.bc-section')) {
        section.classList.add('bc-section-visible');
      }
      return;
    }
    p.classList.remove('bc-exiting');
    p.classList.add('bc-entering');
    const sections = [...p.querySelectorAll<HTMLElement>('.bc-section')].filter(
      (el) => !el.hidden,
    );
    for (const section of sections) {
      section.classList.remove('bc-section-visible');
    }
    sections.forEach((section, index) => {
      const delay = index * SECTION_STAGGER_MS;
      const timer = window.setTimeout(() => {
        if (gen !== motionGen) {
          return;
        }
        section.classList.add('bc-section-visible');
      }, delay);
      entranceTimers.push(timer);
    });
    const sweep = p.querySelector<HTMLElement>('.bc-header-sweep');
    if (sweep) {
      sweep.style.animation = 'none';
      void sweep.offsetWidth;
      sweep.style.animation = '';
    }
  };

  const paint = (
    card: ScorecardResponse,
    innings: InningsScorecard,
    ctx: MatchContext | null,
  ): boolean => {
    ensureMarkup();
    const idLine = qs<HTMLElement>('[data-bc-id-line]');
    const monogram = qs<HTMLElement>('[data-bc-monogram]');
    const teamEl = qs<HTMLElement>('[data-bc-team]');
    const inningsLabel = qs<HTMLElement>('[data-bc-innings-label]');
    const totalEl = qs<HTMLElement>('[data-bc-total]');
    const rowsHost = qs<HTMLElement>('[data-bc-rows]');
    const empty = qs<HTMLElement>('[data-bc-empty]');
    const extrasLine = qs<HTMLElement>('[data-bc-extras]');
    const exB = qs<HTMLElement>('[data-bc-ex-b]');
    const exLb = qs<HTMLElement>('[data-bc-ex-lb]');
    const exWd = qs<HTMLElement>('[data-bc-ex-wd]');
    const exNb = qs<HTMLElement>('[data-bc-ex-nb]');
    const ytbSection = qs<HTMLElement>('[data-bc-section="ytb"]');
    const ytbLabel = qs<HTMLElement>('[data-bc-ytb-label]');
    const ytbNames = qs<HTMLElement>('[data-bc-ytb-names]');
    const footer = qs<HTMLElement>('[data-bc-footer]');

    if (
      !idLine ||
      !monogram ||
      !teamEl ||
      !inningsLabel ||
      !totalEl ||
      !rowsHost ||
      !empty ||
      !extrasLine ||
      !exB ||
      !exLb ||
      !exWd ||
      !exNb ||
      !ytbSection ||
      !ytbLabel ||
      !ytbNames ||
      !footer
    ) {
      return false;
    }

    const teamName = battingTeamLabel(card, innings);
    idLine.textContent = `BATTING SCORECARD · ${inningsHeading(innings)}`;
    monogram.textContent = teamInitials(teamName);
    teamEl.textContent = teamName;
    inningsLabel.textContent = inningsHeading(innings);
    totalEl.textContent = `${innings.runs}/${innings.wickets}`;

    rowsHost.replaceChildren();
    const batters = innings.batters;
    empty.hidden = batters.length > 0;

    batters.forEach((batter, index) => {
      const atCrease =
        !batter.isOut &&
        (batter.playerId === innings.currentStrikerId ||
          batter.playerId === innings.currentNonStrikerId);
      const onStrike =
        !batter.isOut && batter.playerId === innings.currentStrikerId;

      const row = document.createElement('div');
      row.className = 'bc-row bc-col-grid';
      if (index % 2 === 0) {
        row.classList.add('bc-row-alt-a');
      } else {
        row.classList.add('bc-row-alt-b');
      }
      if (atCrease) {
        row.classList.add('is-crease');
      }

      const name = document.createElement('span');
      name.className = 'bc-col-name';
      name.textContent = `${nameOf(card, batter.playerId)}${onStrike ? ' *' : ''}`;

      const how = document.createElement('span');
      how.className = 'bc-col-how';
      how.textContent = howOutText(card, batter);
      how.title = how.textContent;

      const cells: Array<[string, string]> = [
        ['bc-col-num', String(batter.runs)],
        ['bc-col-num', String(batter.balls)],
        ['bc-col-num', String(batter.fours)],
        ['bc-col-num', String(batter.sixes)],
        ['bc-col-num', strikeRateText(batter)],
      ];

      row.append(name, how);
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

    const waiting = yetToBatNames(card, innings, ctx);
    if (waiting.length > 0) {
      ytbSection.hidden = false;
      ytbLabel.textContent = innings.closed ? 'Did not bat' : 'Yet to bat';
      ytbNames.textContent = waiting.join(', ');
    } else {
      ytbSection.hidden = true;
      ytbNames.textContent = '';
    }

    const overs = innings.oversText || '0.0';
    footer.textContent = `Total ${innings.runs}/${innings.wickets} · ${overs} ov · RR ${runRateText(innings)}`;

    return true;
  };

  const hideNode = (): void => {
    cancelMotion();
    onAir = false;
    const p = panel();
    const reduced = prefersReducedMotion();
    const ms = reduced ? 0 : EXIT_MS;

    if (p && !reduced) {
      p.classList.add('bc-exiting');
      p.classList.remove('bc-entering');
      for (const section of p.querySelectorAll('.bc-section')) {
        section.classList.remove('bc-section-visible');
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
        p.classList.add('bc-entering');
        for (const section of p.querySelectorAll('.bc-section')) {
          if (!(section as HTMLElement).hidden) {
            section.classList.add('bc-section-visible');
          }
        }
      }
    }
  };

  const showInternal = (
    card: ScorecardResponse | null,
    inningsId: string | null,
    ctx: MatchContext | null,
    animate: boolean,
  ): boolean => {
    try {
      if (!card) {
        hideNode();
        return false;
      }
      const innings = resolveInnings(card, inningsId);
      if (!innings || !paint(card, innings, ctx)) {
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
    show(card, inningsId, ctx, options) {
      const animate = options?.animate !== false;
      return showInternal(card, inningsId, ctx, animate);
    },
    update(card, inningsId, ctx) {
      if (!onAir) {
        return showInternal(card, inningsId, ctx, false);
      }
      try {
        if (!card) {
          hideNode();
          return false;
        }
        const innings = resolveInnings(card, inningsId);
        if (!innings || !paint(card, innings, ctx)) {
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
