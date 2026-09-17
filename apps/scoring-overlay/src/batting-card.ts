/**
 * Batting card — premium broadcast batting scorecard for one team's innings.
 * Layout matches the package reference (navy/blue/gold, shield, RUNS/WICKETS + OVERS header).
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
const EXIT_MS = 320;

/** Same absolute timeline model as Playing XI. */
const DELAY = {
  id: 0,
  header: 65,
  columns: 180,
  row0: 225,
  rowStep: 45,
} as const;

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
    return 'batting';
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

function inningsHeadingShort(innings: InningsScorecard): string {
  return inningsHeading(innings).toUpperCase();
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

function formatLine(innings: InningsScorecard): string {
  const parts = [inningsHeadingShort(innings)];
  if (innings.oversAllotted != null && innings.oversAllotted > 0) {
    parts.push(`${innings.oversAllotted} OVERS`);
  }
  return parts.join(' · ');
}

function matchupLine(ctx: MatchContext | null): string {
  if (!ctx) {
    return 'ASC LIVE';
  }
  const a = ctx.homeTeamName?.trim();
  const b = ctx.awayTeamName?.trim() || ctx.externalOpponentName?.trim();
  if (!a && !b) {
    return 'ASC LIVE';
  }
  return `${a || 'Home'} vs ${b || 'Away'}`.toUpperCase();
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
      <section
        class="bc-section bc-id-strip"
        data-bc-section="id"
        data-bc-delay="${DELAY.id}"
      >
        <p data-bc-id-left class="bc-id-left">ASC</p>
        <p data-bc-id-center class="bc-id-center">ASC LIVE</p>
        <p data-bc-id-right class="bc-id-right">—</p>
      </section>
      <section
        class="bc-section bc-header"
        data-bc-section="header"
        data-bc-delay="${DELAY.header}"
      >
        <div class="bc-header-inner">
          <div class="bc-mono-shield" aria-hidden="true">
            <span class="bc-mono-star">★</span>
            <span data-bc-abbr class="bc-mono-abbr">—</span>
            <span class="bc-mono-stripe"></span>
          </div>
          <div class="bc-header-copy">
            <p data-bc-team class="bc-team-name">—</p>
          </div>
          <div class="bc-score-block">
            <span class="bc-score-label">Runs / Wickets</span>
            <p data-bc-total class="bc-score-total">0 / 0</p>
          </div>
          <div class="bc-header-vdiv" aria-hidden="true"></div>
          <div class="bc-overs-block">
            <span class="bc-overs-label">Overs</span>
            <p data-bc-overs class="bc-overs-value">0.0</p>
            <p data-bc-rr class="bc-rr-value">RR 0.00</p>
          </div>
        </div>
        <div class="bc-header-sweep" aria-hidden="true"></div>
      </section>
      <section
        class="bc-section bc-columns"
        data-bc-section="columns"
        data-bc-delay="${DELAY.columns}"
      >
        <div class="bc-col-grid bc-col-head" role="row">
          <span class="bc-col-name">Batter</span>
          <span class="bc-col-how">How out</span>
          <span class="bc-col-runs">Runs</span>
          <span class="bc-col-num">B</span>
          <span class="bc-col-num">4s</span>
          <span class="bc-col-num">6s</span>
          <span class="bc-col-num">SR</span>
        </div>
      </section>
      <div class="bc-rows-wrap">
        <div data-bc-rows class="bc-rows"></div>
        <p
          data-bc-empty
          class="bc-section bc-empty"
          data-bc-section="empty"
          data-bc-delay="${DELAY.row0}"
          hidden
        >No batters yet</p>
      </div>
      <section
        class="bc-section bc-extras"
        data-bc-section="extras"
        data-bc-delay="720"
      >
        <div class="bc-extras-main">
          <span data-bc-extras-total class="bc-extras-total">Extras 0</span>
          <span class="bc-extras-parts">
            <span class="bc-ex-part">B <span data-bc-ex-b>0</span></span>
            <span class="bc-ex-part">LB <span data-bc-ex-lb>0</span></span>
            <span class="bc-ex-part">WD <span data-bc-ex-wd>0</span></span>
            <span class="bc-ex-part">NB <span data-bc-ex-nb>0</span></span>
          </span>
        </div>
        <span class="bc-not-out-legend">
          <span class="bc-not-out-mark" aria-hidden="true"></span>
          Not out
        </span>
      </section>
      <section
        class="bc-section bc-ytb"
        data-bc-section="ytb"
        data-bc-delay="765"
        hidden
      >
        <p data-bc-ytb-label class="bc-ytb-label">Yet to bat</p>
        <p data-bc-ytb-names class="bc-ytb-names"></p>
      </section>
      <section
        class="bc-section bc-footer"
        data-bc-section="footer"
        data-bc-delay="810"
      >
        <p data-bc-footer-format class="bc-footer-format">—</p>
        <p class="bc-footer-brand">ASC</p>
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
    // Rebuild when upgrading from the prior gold-square / total-pill markup.
    if (!host.querySelector('.panel-batting-card .bc-score-block')) {
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
    const sections = [...p.querySelectorAll<HTMLElement>('.bc-section')].filter(
      (el) => !el.hidden,
    );
    if (prefersReducedMotion()) {
      p.classList.add('bc-entering');
      for (const section of sections) {
        section.classList.add('bc-section-visible');
      }
      return;
    }
    p.classList.remove('bc-exiting');
    p.classList.add('bc-entering');
    for (const section of sections) {
      section.classList.remove('bc-section-visible');
    }
    for (const section of sections) {
      const raw = section.getAttribute('data-bc-delay');
      const delay = raw != null ? Number(raw) : 0;
      const timer = window.setTimeout(() => {
        if (gen !== motionGen) {
          return;
        }
        section.classList.add('bc-section-visible');
      }, Number.isFinite(delay) ? delay : 0);
      entranceTimers.push(timer);
    }
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
    const idLeft = qs<HTMLElement>('[data-bc-id-left]');
    const idCenter = qs<HTMLElement>('[data-bc-id-center]');
    const idRight = qs<HTMLElement>('[data-bc-id-right]');
    const abbr = qs<HTMLElement>('[data-bc-abbr]');
    const teamEl = qs<HTMLElement>('[data-bc-team]');
    const totalEl = qs<HTMLElement>('[data-bc-total]');
    const oversEl = qs<HTMLElement>('[data-bc-overs]');
    const rrEl = qs<HTMLElement>('[data-bc-rr]');
    const rowsHost = qs<HTMLElement>('[data-bc-rows]');
    const empty = qs<HTMLElement>('[data-bc-empty]');
    const extrasTotal = qs<HTMLElement>('[data-bc-extras-total]');
    const exB = qs<HTMLElement>('[data-bc-ex-b]');
    const exLb = qs<HTMLElement>('[data-bc-ex-lb]');
    const exWd = qs<HTMLElement>('[data-bc-ex-wd]');
    const exNb = qs<HTMLElement>('[data-bc-ex-nb]');
    const ytbSection = qs<HTMLElement>('[data-bc-section="ytb"]');
    const ytbLabel = qs<HTMLElement>('[data-bc-ytb-label]');
    const ytbNames = qs<HTMLElement>('[data-bc-ytb-names]');
    const footerFormat = qs<HTMLElement>('[data-bc-footer-format]');

    if (
      !idLeft ||
      !idCenter ||
      !idRight ||
      !abbr ||
      !teamEl ||
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
      !ytbSection ||
      !ytbLabel ||
      !ytbNames ||
      !footerFormat
    ) {
      return false;
    }

    const teamName = battingTeamLabel(card, innings);
    idLeft.textContent = 'ASC';
    idCenter.textContent = matchupLine(ctx);
    idRight.textContent = inningsHeadingShort(innings);
    abbr.textContent = teamInitials(teamName);
    teamEl.textContent = teamName;
    totalEl.textContent = `${innings.runs} / ${innings.wickets}`;
    oversEl.textContent = innings.oversText || '0.0';
    rrEl.textContent = `RR ${runRateText(innings)}`;

    rowsHost.replaceChildren();
    const batters = innings.batters;
    empty.hidden = batters.length > 0;

    batters.forEach((batter, index) => {
      const batting = !batter.isOut;

      const row = document.createElement('div');
      row.className = 'bc-section bc-row bc-col-grid';
      row.setAttribute('data-bc-section', 'row');
      row.setAttribute(
        'data-bc-delay',
        String(DELAY.row0 + index * DELAY.rowStep),
      );
      if (index % 2 === 0) {
        row.classList.add('bc-row-alt-a');
      } else {
        row.classList.add('bc-row-alt-b');
      }
      if (batting) {
        row.classList.add('is-batting');
      }

      const name = document.createElement('span');
      name.className = 'bc-col-name';
      name.textContent = `${nameOf(card, batter.playerId)}${batting ? ' *' : ''}`;

      const how = document.createElement('span');
      how.className = 'bc-col-how';
      if (batting) {
        how.classList.add('is-batting-how');
      }
      how.textContent = howOutText(card, batter);
      how.title = how.textContent;

      const runs = document.createElement('span');
      runs.className = 'bc-col-runs';
      runs.textContent = String(batter.runs);

      const cells: Array<[string, string]> = [
        ['bc-col-num', String(batter.balls)],
        ['bc-col-num', String(batter.fours)],
        ['bc-col-num', String(batter.sixes)],
        ['bc-col-num', strikeRateText(batter)],
      ];

      row.append(name, how, runs);
      for (const [cls, text] of cells) {
        const span = document.createElement('span');
        span.className = cls;
        span.textContent = text;
        row.appendChild(span);
      }
      rowsHost.appendChild(row);
    });

    const waiting = yetToBatNames(card, innings, ctx);
    const waitingWillShow = waiting.length > 0;

    const rowCount = batters.length > 0 ? batters.length : empty.hidden ? 0 : 1;
    const afterRows = DELAY.row0 + rowCount * DELAY.rowStep;
    const extrasSection = qs<HTMLElement>('[data-bc-section="extras"]');
    const footerSection = qs<HTMLElement>('[data-bc-section="footer"]');
    extrasSection?.setAttribute('data-bc-delay', String(afterRows));
    ytbSection.setAttribute('data-bc-delay', String(afterRows + DELAY.rowStep));
    footerSection?.setAttribute(
      'data-bc-delay',
      String(afterRows + DELAY.rowStep * (waitingWillShow ? 2 : 1)),
    );

    const extras = normalizeExtras(innings);
    extrasTotal.textContent = `Extras ${extras.total}`;
    exB.textContent = String(extras.byes);
    exLb.textContent = String(extras.legByes);
    exWd.textContent = String(extras.wides);
    exNb.textContent = String(extras.noBalls);

    if (waitingWillShow) {
      ytbSection.hidden = false;
      ytbLabel.textContent = innings.closed ? 'Did not bat' : 'Yet to bat';
      ytbNames.textContent = waiting.join(', ');
    } else {
      ytbSection.hidden = true;
      ytbNames.textContent = '';
    }

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
