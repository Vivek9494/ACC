/**
 * Premium innings-break graphic — tabbed multi-view overlay.
 * Batting / Bowling / Partnerships reuse premium card body designs;
 * Wickets + Overs are package-styled sub-views. Live /live data only.
 */

import './batting-card.css';
import './bowling-card.css';
import './team-partnerships-card.css';
import './innings-scorecard.css';
import {
  battingTeamLabel,
  bowlingTeamLabel,
  extrasTotal,
  formatDismissalShort,
  formatStat,
  groupTimelineByOver,
  partnershipBatterRuns,
  partnershipExtras,
  playerName,
  resolveBattingSide,
  resolveInningsBreakInnings,
  shortName,
  teamPartnershipStandRows,
  type SidePlayer,
} from './graphics-format';
import { concealGraphic, revealGraphic } from './graphic-visibility';
import type {
  BatterCard,
  BowlerCard,
  ExtrasBreakdown,
  InningsBreakView,
  InningsScorecard,
  MatchContext,
  OverSummary,
  ScorecardResponse,
  ScorecardViewSource,
} from './types';
import { parseInningsBreakView, parseScorecardViewSource } from './types';
import { teamInitials } from './view-model';

/** Match batting card row stagger (bowling uses 48ms — package standard is 45). */
const SECTION_STAGGER_MS = 45;
const EXIT_MS = 320;
const TAB_FADE_MS = 180;
const MAX_STANDS = 10;

/** Absolute shell delays aligned with batting-card DELAY. */
const DELAY = {
  id: 0,
  header: 65,
  tabs: 110,
  content0: 155,
  rowStep: 45,
} as const;

export type InningsScorecardView = InningsBreakView;
export type InningsXiStatus = 'full' | 'no_squad' | 'loading';

export interface InningsScorecardController {
  readonly host: HTMLElement;
  isOnAir(): boolean;
  currentView(): InningsScorecardView;
  xiStatus(): InningsXiStatus | null;
  hide(): void;
  showLoading(
    view?: InningsScorecardView,
    source?: ScorecardViewSource,
  ): boolean;
  show(
    card: ScorecardResponse | null,
    ctx: MatchContext | null,
    view?: InningsScorecardView,
    xiStatus?: InningsXiStatus,
    innings?: InningsScorecard | null,
    source?: ScorecardViewSource,
  ): boolean;
}

function warnGraphics(err: unknown): void {
  console.warn('[innings-scorecard]', err);
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function nameOf(card: ScorecardResponse, id: string | null | undefined): string {
  if (!id) {
    return '—';
  }
  const full = playerName(card.display, id);
  return full === '—' ? '—' : shortName(full);
}

function sidePlayerName(p: SidePlayer, card: ScorecardResponse): string {
  const fromDisplay = playerName(card.display, p.playerId);
  if (fromDisplay !== '—') {
    return shortName(fromDisplay);
  }
  return p.name ? shortName(p.name) : '—';
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
    total: e?.total ?? extrasTotal(innings),
  };
}

function formatExtrasHeader(extras: ExtrasBreakdown): string {
  const parts: string[] = [];
  if (extras.wides > 0) {
    parts.push(`${extras.wides} wd`);
  }
  if (extras.noBalls > 0) {
    parts.push(`${extras.noBalls} nb`);
  }
  if (extras.byes > 0) {
    parts.push(`${extras.byes} b`);
  }
  if (extras.legByes > 0) {
    parts.push(`${extras.legByes} lb`);
  }
  if (extras.penalties > 0) {
    parts.push(`${extras.penalties} p`);
  }
  if (parts.length > 0) {
    return `${extras.total} EXTRAS (${parts.join(', ')})`;
  }
  return `${extras.total} EXTRAS`;
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
    const label = sidePlayerName(p, card);
    if (label !== '—') {
      names.push(label);
    }
  }
  return names;
}

function batterById(
  innings: InningsScorecard,
  playerId: string,
): BatterCard | null {
  const id = String(playerId);
  return innings.batters.find((b) => String(b.playerId) === id) ?? null;
}

function oversYTicks(maxRuns: number): number[] {
  const cap = Math.max(6, maxRuns);
  const step = cap <= 8 ? 2 : cap <= 16 ? 4 : cap <= 24 ? 6 : 8;
  const top = Math.ceil(cap / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top; v += step) {
    ticks.push(v);
  }
  return ticks;
}

function paintOversChart(host: HTMLElement, overs: OverSummary[]): void {
  host.replaceChildren();
  if (overs.length === 0) {
    return;
  }
  const NS = 'http://www.w3.org/2000/svg';
  const W = 720;
  const H = 280;
  const pad = { l: 40, r: 16, t: 28, b: 36 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;
  const maxRuns = Math.max(1, ...overs.map((o) => o.runs));
  const ticks = oversYTicks(maxRuns);
  const chartMax = ticks[ticks.length - 1] ?? maxRuns;
  const slot = plotW / overs.length;
  const barW = Math.min(28, slot * 0.62);
  const xStep = overs.length <= 12 ? 1 : overs.length <= 20 ? 2 : 3;

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'isc-overs-svg');
  svg.setAttribute('aria-label', 'Runs per over');

  const axis = document.createElementNS(NS, 'line');
  axis.setAttribute('x1', String(pad.l));
  axis.setAttribute('x2', String(W - pad.r));
  axis.setAttribute('y1', String(pad.t + plotH));
  axis.setAttribute('y2', String(pad.t + plotH));
  axis.setAttribute('class', 'isc-overs-axis');
  svg.appendChild(axis);

  for (const tick of ticks) {
    const y = pad.t + plotH - (tick / chartMax) * plotH;
    const grid = document.createElementNS(NS, 'line');
    grid.setAttribute('x1', String(pad.l));
    grid.setAttribute('x2', String(W - pad.r));
    grid.setAttribute('y1', String(y));
    grid.setAttribute('y2', String(y));
    grid.setAttribute('class', 'isc-overs-grid');
    svg.appendChild(grid);
    const label = document.createElementNS(NS, 'text');
    label.setAttribute('x', String(pad.l - 8));
    label.setAttribute('y', String(y + 4));
    label.setAttribute('class', 'isc-overs-ylabel');
    label.textContent = String(tick);
    svg.appendChild(label);
  }

  for (const [i, over] of overs.entries()) {
    const cx = pad.l + slot * i + slot / 2;
    const barH = (over.runs / chartMax) * plotH;
    const y = pad.t + plotH - barH;
    const rect = document.createElementNS(NS, 'rect');
    rect.setAttribute('x', String(cx - barW / 2));
    rect.setAttribute('y', String(y));
    rect.setAttribute('width', String(barW));
    rect.setAttribute('height', String(Math.max(barH, over.runs > 0 ? 2 : 0)));
    rect.setAttribute('class', 'isc-overs-bar');
    rect.setAttribute('rx', '3');
    svg.appendChild(rect);

    for (let w = 0; w < over.wickets; w += 1) {
      const dot = document.createElementNS(NS, 'circle');
      dot.setAttribute('cx', String(cx));
      dot.setAttribute('cy', String(y - 8 - w * 11));
      dot.setAttribute('r', '5');
      dot.setAttribute('class', 'isc-overs-wicket');
      svg.appendChild(dot);
    }

    if ((i + 1) % xStep === 0 || i === 0 || i === overs.length - 1) {
      const xlab = document.createElementNS(NS, 'text');
      xlab.setAttribute('x', String(cx));
      xlab.setAttribute('y', String(H - 10));
      xlab.setAttribute('class', 'isc-overs-xlabel');
      xlab.textContent = String(over.overNumber);
      svg.appendChild(xlab);
    }
  }

  host.appendChild(svg);
}

function buildCardMarkup(): string {
  return `
    <div class="panel panel-innings-break">
      <section class="isc-section isc-id-strip" data-isc-section="id">
        <p data-isc-id-line class="isc-id-line">INNINGS BREAK</p>
      </section>
      <section class="isc-section isc-header" data-isc-section="header">
        <div class="isc-header-inner">
          <div data-isc-monogram class="isc-monogram" aria-hidden="true">—</div>
          <div class="isc-header-copy">
            <p class="isc-kicker">Innings break</p>
            <p data-isc-team class="isc-team-name">—</p>
            <p data-isc-meta class="isc-meta-line">—</p>
          </div>
          <p data-isc-total class="isc-total-badge">0–0</p>
        </div>
        <div class="isc-header-sweep" aria-hidden="true"></div>
      </section>
      <div class="isc-section isc-tabs" data-isc-section="tabs" role="tablist" aria-label="Scorecard">
        <span data-isc-tab="batting" class="isc-tab is-active">Batting</span>
        <span data-isc-tab="bowling" class="isc-tab">Bowling</span>
        <span data-isc-tab="fow" class="isc-tab">Wickets</span>
        <span data-isc-tab="partnerships" class="isc-tab">Partnerships</span>
        <span data-isc-tab="overs" class="isc-tab">Overs</span>
      </div>
      <section class="isc-section isc-content" data-isc-section="content">
        <p data-isc-loading class="isc-loading" hidden>Loading playing XI…</p>
        <div data-isc-pane-stage class="isc-pane-stage">
          <div data-isc-pane="batting" class="isc-pane isc-embed isc-embed-batting">
            <div class="isc-section bc-columns" data-isc-motion="columns">
              <div class="bc-col-grid bc-col-head" role="row">
                <span class="bc-col-name">Batter</span>
                <span class="bc-col-how">How out</span>
                <span class="bc-col-num">R</span>
                <span class="bc-col-num">B</span>
                <span class="bc-col-num">4s</span>
                <span class="bc-col-num">6s</span>
                <span class="bc-col-num">SR</span>
              </div>
            </div>
            <div class="bc-rows-wrap">
              <div data-isc-bat-rows class="bc-rows"></div>
              <p data-isc-bat-empty class="isc-section bc-empty" data-isc-motion="empty" hidden>No batters yet</p>
            </div>
            <div class="isc-section bc-extras" data-isc-motion="extras">
              <p data-isc-bat-extras class="bc-extras-line">Extras</p>
              <div class="bc-extras-grid">
                <div class="bc-extra-cell"><span class="bc-extra-k">B</span><span data-isc-ex-b class="bc-extra-v">0</span></div>
                <div class="bc-extra-cell"><span class="bc-extra-k">LB</span><span data-isc-ex-lb class="bc-extra-v">0</span></div>
                <div class="bc-extra-cell"><span class="bc-extra-k">WD</span><span data-isc-ex-wd class="bc-extra-v">0</span></div>
                <div class="bc-extra-cell"><span class="bc-extra-k">NB</span><span data-isc-ex-nb class="bc-extra-v">0</span></div>
              </div>
            </div>
            <div data-isc-ytb class="isc-section bc-ytb" data-isc-motion="ytb" hidden>
              <p data-isc-ytb-label class="bc-ytb-label">Yet to bat</p>
              <p data-isc-ytb-names class="bc-ytb-names"></p>
            </div>
            <p data-isc-note class="isc-section isc-note" data-isc-motion="note" hidden></p>
          </div>
          <div data-isc-pane="bowling" class="isc-pane isc-embed isc-embed-bowling" hidden>
            <div class="isc-section bowl-columns" data-isc-motion="columns">
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
            </div>
            <div class="bowl-rows-wrap">
              <div data-isc-bowl-rows class="bowl-rows"></div>
              <p data-isc-bowl-empty class="isc-section bowl-empty" data-isc-motion="empty" hidden>No bowlers yet</p>
            </div>
            <div class="isc-section bowl-extras" data-isc-motion="extras">
              <p data-isc-bowl-extras class="bowl-extras-line">Extras</p>
              <div class="bowl-extras-grid">
                <div class="bowl-extra-cell"><span class="bowl-extra-k">B</span><span data-isc-bowl-ex-b class="bowl-extra-v">0</span></div>
                <div class="bowl-extra-cell"><span class="bowl-extra-k">LB</span><span data-isc-bowl-ex-lb class="bowl-extra-v">0</span></div>
                <div class="bowl-extra-cell"><span class="bowl-extra-k">WD</span><span data-isc-bowl-ex-wd class="bowl-extra-v">0</span></div>
                <div class="bowl-extra-cell"><span class="bowl-extra-k">NB</span><span data-isc-bowl-ex-nb class="bowl-extra-v">0</span></div>
              </div>
            </div>
          </div>
          <div data-isc-pane="fow" class="isc-pane" hidden>
            <div class="isc-section isc-fow-heads" data-isc-fow-heads data-isc-motion="columns">
              <span>Wicket</span>
              <span>Batter</span>
              <span>Score</span>
              <span>Over</span>
            </div>
            <div data-isc-fow-list class="isc-fow-list"></div>
            <p data-isc-fow-empty class="isc-section isc-empty" data-isc-motion="empty" hidden>No wickets fell</p>
          </div>
          <div data-isc-pane="partnerships" class="isc-pane isc-embed isc-embed-ps" hidden>
            <section class="isc-section tp-col-heads" data-isc-ps-cols data-isc-motion="columns">
              <span>Wicket</span>
              <span>Batter</span>
              <span>Contribution</span>
              <span>Batter</span>
              <span>Runs</span>
              <span>Balls</span>
            </section>
            <div data-isc-ps-rows class="tp-rows"></div>
            <p data-isc-ps-empty class="isc-section tp-empty" data-isc-motion="empty" hidden>No partnerships</p>
            <section class="isc-section tp-legend" data-isc-ps-legend data-isc-motion="legend">
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
            <section class="isc-section tp-summary" data-isc-ps-summary data-isc-motion="summary">
              <div class="tp-summary-cell">
                <p class="tp-summary-label">Highest stand</p>
                <p data-isc-ps-highest class="tp-summary-value">0</p>
              </div>
              <div class="tp-summary-cell">
                <p class="tp-summary-label">Total extras</p>
                <p data-isc-ps-extras class="tp-summary-value">0</p>
              </div>
            </section>
          </div>
          <div data-isc-pane="overs" class="isc-pane" hidden>
            <div data-isc-overs-chart class="isc-section isc-overs-chart" data-isc-motion="chart"></div>
            <div data-isc-overs-legend class="isc-section isc-overs-legend" data-isc-motion="legend" hidden>
              <span><span class="isc-overs-legend-swatch is-runs"></span>Runs</span>
              <span><span class="isc-overs-legend-swatch is-wicket"></span>Wicket</span>
            </div>
            <p data-isc-overs-empty class="isc-section isc-empty" data-isc-motion="empty" hidden>No overs recorded</p>
          </div>
        </div>
      </section>
      <section class="isc-section isc-footer" data-isc-section="footer">
        <p class="isc-footer-mark">ASC</p>
        <p data-isc-footer-note class="isc-footer-note"></p>
      </section>
    </div>
  `.trim();
}

export function mountInningsScorecard(
  host: HTMLElement,
): InningsScorecardController {
  let onAir = false;
  let view: InningsScorecardView = 'batting';
  let chrome: ScorecardViewSource = 'break';
  let xiStatus: InningsXiStatus | null = null;
  let motionGen = 0;
  let tabGen = 0;
  let exitTimer: number | null = null;
  const entranceTimers: number[] = [];
  let tabTimer: number | null = null;

  const qs = <T extends HTMLElement>(selector: string): T | null =>
    host.querySelector(selector) as T | null;

  const panel = (): HTMLElement | null =>
    host.querySelector('.panel-innings-break');

  const ensureMarkup = (): void => {
    if (!host.querySelector('.panel-innings-break')) {
      host.innerHTML = buildCardMarkup();
    }
  };

  const cancelEntrance = (): void => {
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
      p.classList.remove('isc-exiting', 'isc-entering');
      for (const section of p.querySelectorAll('.isc-section')) {
        section.classList.remove('isc-section-visible');
      }
    }
  };

  const cancelTabTransition = (): void => {
    tabGen += 1;
    if (tabTimer != null) {
      window.clearTimeout(tabTimer);
      tabTimer = null;
    }
    const stage = qs<HTMLElement>('[data-isc-pane-stage]');
    if (stage) {
      stage.classList.remove('is-tab-out', 'is-tab-in');
    }
  };

  const applyPaneVisibility = (): void => {
    const tabs = qs<HTMLElement>('.isc-tabs');
    if (tabs) {
      tabs.hidden = chrome === 'scorecard';
    }
    panel()?.classList.toggle('is-single-view', chrome === 'scorecard');
    for (const tab of host.querySelectorAll<HTMLElement>('[data-isc-tab]')) {
      tab.classList.toggle('is-active', tab.dataset.iscTab === view);
    }
    for (const pane of host.querySelectorAll<HTMLElement>('[data-isc-pane]')) {
      pane.hidden = pane.dataset.iscPane !== view;
    }
  };

  const setLoadingUi = (loading: boolean): void => {
    const loadingEl = qs<HTMLElement>('[data-isc-loading]');
    if (loadingEl) {
      loadingEl.hidden = !loading;
    }
    panel()?.classList.toggle('is-loading-xi', loading);
  };

  /** Shell chrome + active-tab body pieces, batting/bowling order. */
  const motionSequence = (
    p: HTMLElement,
  ): { shell: HTMLElement[]; body: HTMLElement[]; footer: HTMLElement | null } => {
    const shell = [
      ...p.querySelectorAll<HTMLElement>(
        '[data-isc-section="id"], [data-isc-section="header"], [data-isc-section="tabs"]',
      ),
    ].filter((el) => !el.hidden);

    const pane = p.querySelector<HTMLElement>(
      `[data-isc-pane="${view}"]:not([hidden])`,
    );
    const body: HTMLElement[] = [];
    if (pane) {
      const columns = pane.querySelectorAll<HTMLElement>(
        '[data-isc-motion="columns"]',
      );
      const rows = pane.querySelectorAll<HTMLElement>(
        '.bc-row, .bowl-row, .isc-fow-row, .tp-row',
      );
      const after = pane.querySelectorAll<HTMLElement>(
        '[data-isc-motion="extras"], [data-isc-motion="ytb"], [data-isc-motion="note"], [data-isc-motion="legend"], [data-isc-motion="summary"], [data-isc-motion="chart"], [data-isc-motion="empty"]',
      );
      for (const el of columns) {
        if (!el.hidden) {
          body.push(el);
        }
      }
      for (const el of rows) {
        body.push(el);
      }
      for (const el of after) {
        if (!el.hidden) {
          body.push(el);
        }
      }
    }

    const footer = p.querySelector<HTMLElement>('[data-isc-section="footer"]');
    return {
      shell,
      body,
      footer: footer && !footer.hidden ? footer : null,
    };
  };

  const runEntrance = (): void => {
    cancelEntrance();
    cancelTabTransition();
    const p = panel();
    if (!p) {
      return;
    }
    const gen = motionGen;
    const { shell, body, footer } = motionSequence(p);
    const sequence = [...shell, ...body, ...(footer ? [footer] : [])];

    if (prefersReducedMotion()) {
      p.classList.add('isc-entering');
      for (const section of p.querySelectorAll('.isc-section')) {
        if (!(section as HTMLElement).hidden) {
          section.classList.add('isc-section-visible');
        }
      }
      return;
    }

    p.classList.remove('isc-exiting');
    p.classList.add('isc-entering');
    for (const section of p.querySelectorAll('.isc-section')) {
      section.classList.remove('isc-section-visible');
    }

    // Content host stays visible so body rows can stagger (like bowl-rows-wrap).
    const content = p.querySelector<HTMLElement>('[data-isc-section="content"]');
    content?.classList.add('isc-section-visible');

    const shellDelays = [DELAY.id, DELAY.header, DELAY.tabs];
    sequence.forEach((section, index) => {
      let delay: number;
      if (index < shell.length) {
        delay = shellDelays[index] ?? index * SECTION_STAGGER_MS;
      } else {
        delay = DELAY.content0 + (index - shell.length) * DELAY.rowStep;
      }
      const timer = window.setTimeout(() => {
        if (gen !== motionGen) {
          return;
        }
        section.classList.add('isc-section-visible');
      }, delay);
      entranceTimers.push(timer);
    });

    const sweep = p.querySelector<HTMLElement>('.isc-header-sweep');
    if (sweep) {
      sweep.style.animation = 'none';
      void sweep.offsetWidth;
      sweep.style.animation = '';
    }
  };

  const ensureSectionsVisible = (): void => {
    const p = panel();
    if (!p) {
      return;
    }
    p.classList.add('isc-entering');
    for (const section of p.querySelectorAll<HTMLElement>('.isc-section')) {
      if (!section.hidden) {
        section.classList.add('isc-section-visible');
      }
    }
  };

  const runTabContentTransition = (applyView: () => void): void => {
    cancelTabTransition();
    const stage = qs<HTMLElement>('[data-isc-pane-stage]');
    if (!stage || prefersReducedMotion()) {
      applyView();
      ensureSectionsVisible();
      return;
    }
    const gen = ++tabGen;
    stage.classList.remove('is-tab-in');
    stage.classList.add('is-tab-out');
    tabTimer = window.setTimeout(() => {
      if (gen !== tabGen) {
        return;
      }
      applyView();
      ensureSectionsVisible();
      stage.classList.remove('is-tab-out');
      stage.classList.add('is-tab-in');
      void stage.offsetWidth;
      requestAnimationFrame(() => {
        if (gen !== tabGen) {
          return;
        }
        stage.classList.remove('is-tab-in');
      });
      tabTimer = null;
    }, TAB_FADE_MS);
  };

  const paintBattingPane = (
    card: ScorecardResponse,
    innings: InningsScorecard,
    ctx: MatchContext | null,
    status: InningsXiStatus,
  ): void => {
    const rowsHost = qs<HTMLElement>('[data-isc-bat-rows]');
    const empty = qs<HTMLElement>('[data-isc-bat-empty]');
    const extrasLine = qs<HTMLElement>('[data-isc-bat-extras]');
    const exB = qs<HTMLElement>('[data-isc-ex-b]');
    const exLb = qs<HTMLElement>('[data-isc-ex-lb]');
    const exWd = qs<HTMLElement>('[data-isc-ex-wd]');
    const exNb = qs<HTMLElement>('[data-isc-ex-nb]');
    const ytb = qs<HTMLElement>('[data-isc-ytb]');
    const ytbLabel = qs<HTMLElement>('[data-isc-ytb-label]');
    const ytbNames = qs<HTMLElement>('[data-isc-ytb-names]');
    const noteEl = qs<HTMLElement>('[data-isc-note]');
    if (
      !rowsHost ||
      !empty ||
      !extrasLine ||
      !exB ||
      !exLb ||
      !exWd ||
      !exNb ||
      !ytb ||
      !ytbLabel ||
      !ytbNames ||
      !noteEl
    ) {
      return;
    }

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
      row.className = 'isc-section bc-row bc-col-grid';
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

      row.append(name, how);
      for (const text of [
        String(batter.runs),
        String(batter.balls),
        String(batter.fours),
        String(batter.sixes),
        strikeRateText(batter),
      ]) {
        const span = document.createElement('span');
        span.className = 'bc-col-num';
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
      ytb.hidden = false;
      ytbLabel.textContent = innings.closed ? 'Did not bat' : 'Yet to bat';
      ytbNames.textContent = waiting.join(', ');
    } else {
      ytb.hidden = true;
      ytbNames.textContent = '';
    }

    const side = status === 'full' ? resolveBattingSide(card, innings, ctx) : null;
    const showNote = status !== 'full' || (side?.players.length ?? 0) === 0;
    noteEl.textContent = showNote ? 'Playing XI unavailable for this side' : '';
    noteEl.hidden = !showNote;
  };

  const paintBowlingPane = (
    card: ScorecardResponse,
    innings: InningsScorecard,
  ): void => {
    const rowsHost = qs<HTMLElement>('[data-isc-bowl-rows]');
    const empty = qs<HTMLElement>('[data-isc-bowl-empty]');
    const extrasLine = qs<HTMLElement>('[data-isc-bowl-extras]');
    const exB = qs<HTMLElement>('[data-isc-bowl-ex-b]');
    const exLb = qs<HTMLElement>('[data-isc-bowl-ex-lb]');
    const exWd = qs<HTMLElement>('[data-isc-bowl-ex-wd]');
    const exNb = qs<HTMLElement>('[data-isc-bowl-ex-nb]');
    if (!rowsHost || !empty || !extrasLine || !exB || !exLb || !exWd || !exNb) {
      return;
    }

    rowsHost.replaceChildren();
    const bowlers = bowlersWhoHaveBowled(innings);
    empty.hidden = bowlers.length > 0;

    bowlers.forEach((bowler, index) => {
      const current =
        !innings.closed && bowler.playerId === innings.currentBowlerId;
      const row = document.createElement('div');
      row.className = 'isc-section bowl-row bowl-col-grid';
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
      row.appendChild(name);

      const cells: Array<[string, string]> = [
        ['bowl-col-num', bowler.oversText?.trim() || '0.0'],
        ['bowl-col-num', String(bowler.maidens ?? 0)],
        ['bowl-col-num', String(bowler.runsConceded ?? 0)],
        ['bowl-col-num', String(bowler.wickets ?? 0)],
        ['bowl-col-num bowl-col-econ', economyText(bowler)],
        ['bowl-col-num', String(bowler.wides ?? 0)],
        ['bowl-col-num', String(bowler.noBalls ?? 0)],
      ];
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
  };

  const paintFowPane = (
    card: ScorecardResponse,
    innings: InningsScorecard,
  ): void => {
    const list = qs<HTMLElement>('[data-isc-fow-list]');
    const emptyEl = qs<HTMLElement>('[data-isc-fow-empty]');
    const heads = qs<HTMLElement>('[data-isc-fow-heads]');
    if (!list || !emptyEl || !heads) {
      return;
    }
    list.replaceChildren();
    const falls = innings.fallOfWickets ?? [];
    emptyEl.hidden = falls.length > 0;
    heads.hidden = falls.length === 0;

    for (const fow of falls) {
      const row = document.createElement('div');
      row.className = 'isc-section isc-fow-row';

      const wicket = document.createElement('span');
      wicket.className = 'isc-fow-wicket';
      wicket.textContent = wicketOrdinal(fow.wicketNumber);

      const batter = batterById(innings, fow.playerId);
      const batterEl = document.createElement('span');
      batterEl.className = 'isc-fow-batter';
      const name = nameOf(card, fow.playerId);
      if (batter != null) {
        batterEl.innerHTML = '';
        batterEl.appendChild(document.createTextNode(name));
        const meta = document.createElement('span');
        meta.className = 'isc-fow-batter-meta';
        meta.textContent = `  ${batter.runs} (${batter.balls})`;
        batterEl.appendChild(meta);
      } else {
        batterEl.textContent = name;
      }

      const score = document.createElement('span');
      score.className = 'isc-fow-score';
      score.textContent = `${fow.teamRuns}–${fow.wicketNumber}`;

      const over = document.createElement('span');
      over.className = 'isc-fow-over';
      over.textContent = fow.oversText?.trim() || '—';

      row.append(wicket, batterEl, score, over);
      list.appendChild(row);
    }
  };

  const paintPartnershipsPane = (
    card: ScorecardResponse,
    innings: InningsScorecard,
  ): void => {
    const rowsHost = qs<HTMLElement>('[data-isc-ps-rows]');
    const empty = qs<HTMLElement>('[data-isc-ps-empty]');
    const cols = qs<HTMLElement>('[data-isc-ps-cols]');
    const legend = qs<HTMLElement>('[data-isc-ps-legend]');
    const summary = qs<HTMLElement>('[data-isc-ps-summary]');
    const highest = qs<HTMLElement>('[data-isc-ps-highest]');
    const extrasTotalEl = qs<HTMLElement>('[data-isc-ps-extras]');
    if (
      !rowsHost ||
      !empty ||
      !cols ||
      !legend ||
      !summary ||
      !highest ||
      !extrasTotalEl
    ) {
      return;
    }

    const stands = teamPartnershipStandRows(innings).slice(0, MAX_STANDS);
    rowsHost.replaceChildren();

    if (stands.length === 0) {
      empty.hidden = false;
      cols.hidden = true;
      legend.hidden = true;
      summary.hidden = true;
      highest.textContent = '0';
      extrasTotalEl.textContent = '0';
      return;
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
      el.className = `isc-section tp-row${row.isCurrent ? ' is-current' : ''}`;

      const wicket = document.createElement('span');
      wicket.className = 'tp-wicket';
      wicket.textContent = `${wicketOrdinal(row.standNumber)}${row.isCurrent ? '*' : ''}`;

      const batterA = document.createElement('span');
      batterA.className = 'tp-batter is-a';
      batterA.textContent =
        leftId != null ? `${nameOf(card, leftId)} (${leftRuns})` : '—';

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
      fill.className = 'tp-bar-fill is-ready';
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
        rightId != null ? `(${rightRuns}) ${nameOf(card, rightId)}` : '—';

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
    extrasTotalEl.textContent = String(extrasSum);
  };

  const paintHeader = (
    card: ScorecardResponse,
    innings: InningsScorecard,
  ): void => {
    const idLine = qs<HTMLElement>('[data-isc-id-line]');
    const monogram = qs<HTMLElement>('[data-isc-monogram]');
    const teamEl = qs<HTMLElement>('[data-isc-team]');
    const metaEl = qs<HTMLElement>('[data-isc-meta]');
    const totalEl = qs<HTMLElement>('[data-isc-total]');
    const footerNote = qs<HTMLElement>('[data-isc-footer-note]');
    if (!idLine || !monogram || !teamEl || !metaEl || !totalEl || !footerNote) {
      return;
    }

    const teamName = battingTeamLabel(card, innings);
    const bowlingName = bowlingTeamLabel(card, innings);
    const heading = inningsHeading(innings);
    const extras = normalizeExtras(innings);
    const overs = innings.oversText?.trim() || '0.0';

    idLine.textContent = `INNINGS BREAK · ${heading.toUpperCase()}`;
    monogram.textContent = teamInitials(teamName);
    teamEl.textContent = teamName;
    totalEl.textContent = `${innings.runs}–${innings.wickets}`;
    metaEl.textContent = `${overs} OVERS  ·  ${formatExtrasHeader(extras)}`;
    footerNote.textContent = `${teamName} vs ${bowlingName}`;
  };

  const paint = (
    card: ScorecardResponse,
    ctx: MatchContext | null,
    status: InningsXiStatus,
    innings: InningsScorecard,
  ): boolean => {
    ensureMarkup();
    setLoadingUi(false);
    paintHeader(card, innings);

    try {
      paintBattingPane(card, innings, ctx, status);
    } catch (err) {
      warnGraphics(err);
    }
    try {
      paintBowlingPane(card, innings);
    } catch (err) {
      warnGraphics(err);
    }
    try {
      paintFowPane(card, innings);
    } catch (err) {
      warnGraphics(err);
    }
    try {
      paintPartnershipsPane(card, innings);
    } catch (err) {
      warnGraphics(err);
    }
    try {
      const oversChart = qs<HTMLElement>('[data-isc-overs-chart]');
      const oversEmpty = qs<HTMLElement>('[data-isc-overs-empty]');
      const oversLegend = qs<HTMLElement>('[data-isc-overs-legend]');
      if (oversChart && oversEmpty && oversLegend) {
        const overs = groupTimelineByOver(innings.timeline);
        oversEmpty.hidden = overs.length > 0;
        oversLegend.hidden = overs.length === 0;
        paintOversChart(oversChart, overs);
      }
    } catch (err) {
      warnGraphics(err);
    }

    return true;
  };

  const hideNode = (): void => {
    cancelEntrance();
    cancelTabTransition();
    onAir = false;
    xiStatus = null;
    const p = panel();
    const reduced = prefersReducedMotion();
    const ms = reduced ? 0 : EXIT_MS;

    if (p && !reduced) {
      p.classList.add('isc-exiting');
      p.classList.remove('isc-entering');
      for (const section of p.querySelectorAll('.isc-section')) {
        section.classList.remove('isc-section-visible');
      }
    }

    host.classList.remove('is-visible');
    exitTimer = window.setTimeout(() => {
      exitTimer = null;
      concealGraphic(host);
    }, ms);
  };

  return {
    host,
    isOnAir: () => onAir,
    currentView: () => view,
    xiStatus: () => xiStatus,
    hide(): void {
      try {
        hideNode();
      } catch (err) {
        warnGraphics(err);
        onAir = false;
        host.hidden = true;
        host.classList.remove('is-visible');
      }
    },
    showLoading(nextView = 'batting', source: ScorecardViewSource = 'break'): boolean {
      try {
        const alreadyOnAir = onAir;
        const prevView = view;
        view = parseInningsBreakView(nextView);
        chrome = parseScorecardViewSource(source);
        xiStatus = 'loading';
        ensureMarkup();
        setLoadingUi(true);
        const viewChanged = alreadyOnAir && prevView !== view;
        if (viewChanged) {
          runTabContentTransition(() => applyPaneVisibility());
        } else {
          applyPaneVisibility();
        }
        onAir = true;
        revealGraphic(host);
        if (!alreadyOnAir) {
          requestAnimationFrame(() => runEntrance());
        } else {
          ensureSectionsVisible();
        }
        return true;
      } catch (err) {
        warnGraphics(err);
        try {
          hideNode();
        } catch {
          /* ignore */
        }
        return false;
      }
    },
    show(
      card,
      ctx,
      nextView = 'batting',
      status = 'no_squad',
      inningsArg = null,
      source: ScorecardViewSource = 'break',
    ): boolean {
      try {
        const alreadyOnAir = onAir;
        const prevView = view;
        view = parseInningsBreakView(nextView);
        chrome = parseScorecardViewSource(source);

        if (status === 'loading') {
          return this.showLoading(view, chrome);
        }
        if (!card) {
          hideNode();
          return false;
        }
        const innings = inningsArg ?? resolveInningsBreakInnings(card);
        if (!innings) {
          hideNode();
          return false;
        }
        const side = resolveBattingSide(card, innings, ctx);
        const xi: InningsXiStatus =
          status === 'full' && side != null && side.players.length > 0
            ? 'full'
            : 'no_squad';
        if (!paint(card, ctx, xi, innings)) {
          hideNode();
          return false;
        }
        xiStatus = xi;
        onAir = true;

        const viewChanged = alreadyOnAir && prevView !== view;
        if (viewChanged) {
          runTabContentTransition(() => applyPaneVisibility());
        } else {
          applyPaneVisibility();
        }

        revealGraphic(host);
        if (!alreadyOnAir) {
          requestAnimationFrame(() => runEntrance());
        } else {
          ensureSectionsVisible();
        }
        return true;
      } catch (err) {
        warnGraphics(err);
        try {
          hideNode();
        } catch {
          /* ignore */
        }
        return false;
      }
    },
  };
}
