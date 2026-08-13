/**
 * Full innings scorecard graphic (batting / bowling tabs) for innings break.
 */

import './innings-scorecard.css';
import {
  battingTeamLabel,
  dismissalColumns,
  extrasTotal,
  formatStat,
  groupTimelineByOver,
  partnershipBatterRuns,
  partnershipStandRows,
  playerName,
  resolveBattingSide,
  resolveInningsBreakInnings,
  shortName,
} from './graphics-format';
import type { SidePlayer } from './graphics-format';
import type {
  BatterCard,
  InningsBreakView,
  InningsScorecard,
  MatchContext,
  OverSummary,
  ScorecardResponse,
} from './types';
import { parseInningsBreakView } from './types';

const ANIM_MS = 280;

export type InningsScorecardView = InningsBreakView;
export type InningsXiStatus = 'full' | 'no_squad' | 'loading';

export interface InningsScorecardController {
  readonly host: HTMLElement;
  isOnAir(): boolean;
  currentView(): InningsScorecardView;
  xiStatus(): InningsXiStatus | null;
  hide(): void;
  showLoading(view?: InningsScorecardView): boolean;
  show(
    card: ScorecardResponse | null,
    ctx: MatchContext | null,
    view?: InningsScorecardView,
    xiStatus?: InningsXiStatus,
    innings?: InningsScorecard | null,
  ): boolean;
}

function warnGraphics(err: unknown): void {
  console.warn('[innings-scorecard]', err);
}

function nameOfCard(
  card: ScorecardResponse,
  id: string | null | undefined,
): string {
  return shortName(playerName(card.display, id));
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

type BatRowStatus = 'out' | 'not_out' | 'dnb';

interface BatRow {
  playerId: string;
  name: string;
  status: BatRowStatus;
  fielder: string;
  bowler: string;
  runs: string;
  balls: string;
}

function buildBatRows(
  card: ScorecardResponse,
  innings: InningsScorecard,
  xi: SidePlayer[],
): BatRow[] {
  const seen = new Set<string>();
  const rows: BatRow[] = [];

  const pushBatter = (batter: BatterCard): void => {
    const batterId = String(batter.playerId);
    if (seen.has(batterId)) {
      return;
    }
    seen.add(batterId);
    const name = nameOfCard(card, batter.playerId);
    if (batter.isOut) {
      const cols = dismissalColumns(batter, (id) => nameOfCard(card, id));
      rows.push({
        playerId: batter.playerId,
        name,
        status: 'out',
        fielder: cols.fielder,
        bowler: cols.bowler,
        runs: String(batter.runs),
        balls: String(batter.balls),
      });
      return;
    }
    rows.push({
      playerId: batter.playerId,
      name,
      status: 'not_out',
      fielder: 'NOT OUT',
      bowler: '',
      runs: String(batter.runs),
      balls: String(batter.balls),
    });
  };

  for (const batter of innings.batters) {
    pushBatter(batter);
  }

  for (const p of dnbInRosterOrder(xi, seen)) {
    const name = sidePlayerName(p, card);
    if (name === '—') {
      continue;
    }
    seen.add(String(p.playerId));
    rows.push({
      playerId: p.playerId,
      name,
      status: 'dnb',
      fielder: '',
      bowler: '',
      runs: '',
      balls: '',
    });
  }

  return rows;
}

function batterById(
  innings: InningsScorecard,
  playerId: string,
): BatterCard | null {
  const id = String(playerId);
  return innings.batters.find((b) => String(b.playerId) === id) ?? null;
}

function paintFowPane(
  list: HTMLElement,
  emptyEl: HTMLElement,
  card: ScorecardResponse,
  innings: InningsScorecard,
): void {
  list.replaceChildren();
  const falls = innings.fallOfWickets ?? [];
  emptyEl.hidden = falls.length > 0;
  for (const fow of falls) {
    const row = document.createElement('div');
    row.className = 'isc-fow-card';
    const score = document.createElement('span');
    score.className = 'isc-fow-score';
    score.textContent = `${fow.teamRuns}–${fow.wicketNumber}`;
    const batter = batterById(innings, fow.playerId);
    const detail = document.createElement('span');
    detail.className = 'isc-fow-batter';
    const name = nameOfCard(card, fow.playerId);
    detail.textContent =
      batter != null ? `${name}  ${batter.runs} (${batter.balls})` : name;
    row.append(score, detail);
    list.appendChild(row);
  }
}

function paintPartnershipsPane(
  list: HTMLElement,
  emptyEl: HTMLElement,
  card: ScorecardResponse,
  innings: InningsScorecard,
): void {
  list.replaceChildren();
  const stands = partnershipStandRows(innings);
  emptyEl.hidden = stands.length > 0;
  for (const stand of stands) {
    const wrap = document.createElement('div');
    wrap.className = 'isc-ps-stand';
    const row = document.createElement('div');
    row.className = 'isc-ps-row';
    const leftId = stand.batterIds[0];
    const rightId = stand.batterIds[1];
    const leftRuns = leftId ? partnershipBatterRuns(stand, leftId) : 0;
    const rightRuns = rightId ? partnershipBatterRuns(stand, rightId) : 0;
    const left = document.createElement('span');
    left.className = 'isc-ps-end isc-ps-a';
    left.textContent = leftId ? `${nameOfCard(card, leftId)} (${leftRuns})` : '';
    const mid = document.createElement('span');
    mid.className = 'isc-ps-total';
    mid.textContent = `${stand.runs} (${stand.balls})`;
    const right = document.createElement('span');
    right.className = 'isc-ps-end isc-ps-b';
    right.textContent = rightId
      ? `(${rightRuns}) ${nameOfCard(card, rightId)}`
      : '';
    row.append(left, mid, right);
    wrap.appendChild(row);
    if (leftId && rightId) {
      const bar = document.createElement('div');
      bar.className = 'isc-ps-bar';
      const total = leftRuns + rightRuns;
      if (total > 0) {
        if (leftRuns > 0) {
          const a = document.createElement('span');
          a.className = 'isc-ps-bar-a';
          a.style.flex = String(leftRuns);
          bar.appendChild(a);
        }
        if (rightRuns > 0) {
          const b = document.createElement('span');
          b.className = 'isc-ps-bar-b';
          b.style.flex = String(rightRuns);
          bar.appendChild(b);
        }
      }
      wrap.appendChild(bar);
    }
    list.appendChild(wrap);
  }
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
  const xStep =
    overs.length <= 12 ? 1 : overs.length <= 20 ? 2 : 3;

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
    <div class="panel panel-innings-sc">
      <div class="panel-accent"></div>
      <div class="isc-body">
        <div class="isc-tabs" role="tablist" aria-label="Scorecard">
          <span data-isc-tab="batting" class="isc-tab is-active">Batting</span>
          <span data-isc-tab="bowling" class="isc-tab">Bowling</span>
          <span data-isc-tab="fow" class="isc-tab">Wickets</span>
          <span data-isc-tab="partnerships" class="isc-tab">Partnerships</span>
          <span data-isc-tab="overs" class="isc-tab">Overs</span>
        </div>
        <p data-isc-loading class="isc-loading" hidden>Loading playing XI…</p>
        <div data-isc-pane="batting" class="isc-pane">
          <div class="isc-table-wrap">
            <table class="isc-table" aria-label="Batting scorecard">
              <thead>
                <tr>
                  <th class="isc-col-name">Batter</th>
                  <th class="isc-col-how"></th>
                  <th class="isc-col-how"></th>
                  <th class="isc-col-num">R</th>
                  <th class="isc-col-num">B</th>
                </tr>
              </thead>
              <tbody data-isc-bat-body></tbody>
            </table>
          </div>
          <p data-isc-note class="isc-note" hidden></p>
          <div class="isc-total">
            <p class="isc-total-score">
              <span data-isc-total-team class="isc-total-team"></span>
              <span data-isc-total-runs class="isc-total-runs"></span>
            </p>
            <p data-isc-total-meta class="isc-total-meta"></p>
          </div>
        </div>
        <div data-isc-pane="bowling" class="isc-pane" hidden>
          <div class="isc-table-wrap">
            <table class="isc-table" aria-label="Bowling figures">
              <thead>
                <tr>
                  <th class="isc-col-name">Bowler</th>
                  <th class="isc-col-num">O</th>
                  <th class="isc-col-num">M</th>
                  <th class="isc-col-num">R</th>
                  <th class="isc-col-num">W</th>
                  <th class="isc-col-num">Econ</th>
                </tr>
              </thead>
              <tbody data-isc-bowl-body></tbody>
            </table>
          </div>
        </div>
        <div data-isc-pane="fow" class="isc-pane" hidden>
          <div data-isc-fow-list class="isc-fow-list"></div>
          <p data-isc-fow-empty class="isc-empty" hidden>No wickets fell</p>
        </div>
        <div data-isc-pane="partnerships" class="isc-pane" hidden>
          <div data-isc-ps-list class="isc-ps-list"></div>
          <p data-isc-ps-empty class="isc-empty" hidden>No partnerships</p>
        </div>
        <div data-isc-pane="overs" class="isc-pane" hidden>
          <div data-isc-overs-chart class="isc-overs-chart"></div>
          <p data-isc-overs-empty class="isc-empty" hidden>No overs recorded</p>
        </div>
      </div>
    </div>
  `.trim();
}

export function mountInningsScorecard(
  host: HTMLElement,
): InningsScorecardController {
  let onAir = false;
  let view: InningsScorecardView = 'batting';
  let xiStatus: InningsXiStatus | null = null;

  const qs = <T extends HTMLElement>(selector: string): T | null =>
    host.querySelector(selector) as T | null;

  const ensureMarkup = (): void => {
    if (
      !host.querySelector('.panel-innings-sc') ||
      !host.querySelector('[data-isc-pane="fow"]')
    ) {
      host.innerHTML = buildCardMarkup();
    }
  };

  const hideNode = (): void => {
    onAir = false;
    xiStatus = null;
    host.classList.remove('is-visible');
    window.setTimeout(() => {
      if (!onAir) {
        host.hidden = true;
      }
    }, ANIM_MS);
  };

  const showNode = (): void => {
    host.hidden = false;
    requestAnimationFrame(() => host.classList.add('is-visible'));
  };

  const setViewUi = (): void => {
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
    qs<HTMLElement>('.panel-innings-sc')?.classList.toggle('is-loading-xi', loading);
  };

  const paint = (
    card: ScorecardResponse,
    ctx: MatchContext | null,
    status: InningsXiStatus,
    innings: InningsScorecard,
  ): boolean => {
    ensureMarkup();

    setViewUi();
    setLoadingUi(false);

    const batBody = qs<HTMLTableSectionElement>('[data-isc-bat-body]');
    const bowlBody = qs<HTMLTableSectionElement>('[data-isc-bowl-body]');
    const totalTeam = qs<HTMLElement>('[data-isc-total-team]');
    const totalRuns = qs<HTMLElement>('[data-isc-total-runs]');
    const totalMeta = qs<HTMLElement>('[data-isc-total-meta]');
    const noteEl = qs<HTMLElement>('[data-isc-note]');
    const fowList = qs<HTMLElement>('[data-isc-fow-list]');
    const fowEmpty = qs<HTMLElement>('[data-isc-fow-empty]');
    const psList = qs<HTMLElement>('[data-isc-ps-list]');
    const psEmpty = qs<HTMLElement>('[data-isc-ps-empty]');
    const oversChart = qs<HTMLElement>('[data-isc-overs-chart]');
    const oversEmpty = qs<HTMLElement>('[data-isc-overs-empty]');
    if (
      !batBody ||
      !bowlBody ||
      !totalTeam ||
      !totalRuns ||
      !totalMeta ||
      !noteEl ||
      !fowList ||
      !fowEmpty ||
      !psList ||
      !psEmpty ||
      !oversChart ||
      !oversEmpty
    ) {
      return false;
    }

    const side = status === 'full' ? resolveBattingSide(card, innings, ctx) : null;
    const xi = side?.players ?? [];
    const batRows = buildBatRows(card, innings, xi);
    batBody.replaceChildren();
    for (const row of batRows) {
      const tr = document.createElement('tr');
      tr.className = `isc-row isc-row-${row.status}`;
      const cells = [row.name, row.fielder, row.bowler, row.runs, row.balls];
      for (const [i, text] of cells.entries()) {
        const td = document.createElement('td');
        td.textContent = text;
        if (i >= 3) {
          td.className = 'isc-col-num';
        } else if (i === 0) {
          td.className = 'isc-col-name';
        } else {
          td.className = 'isc-col-how';
        }
        tr.appendChild(td);
      }
      batBody.appendChild(tr);
    }

    const showNote = status !== 'full' || xi.length === 0;
    noteEl.textContent = showNote ? 'Playing XI unavailable for this side' : '';
    noteEl.hidden = !showNote;

    totalTeam.textContent = battingTeamLabel(card, innings);
    totalRuns.textContent = `${innings.runs}–${innings.wickets}`;
    const extra = extrasTotal(innings);
    const extras = innings.extras;
    const extraParts: string[] = [];
    if (extras) {
      if (extras.wides > 0) extraParts.push(`${extras.wides} wd`);
      if (extras.noBalls > 0) extraParts.push(`${extras.noBalls} nb`);
      if (extras.byes > 0) extraParts.push(`${extras.byes} b`);
      if (extras.legByes > 0) extraParts.push(`${extras.legByes} lb`);
      if (extras.penalties > 0) extraParts.push(`${extras.penalties} p`);
    }
    const extraBit =
      extraParts.length > 0
        ? `${extra} EXTRAS (${extraParts.join(', ')})`
        : `${extra} EXTRAS`;
    totalMeta.textContent = `${innings.oversText} OVERS  |  ${extraBit}`;

    bowlBody.replaceChildren();
    for (const bowler of innings.bowlers) {
      const tr = document.createElement('tr');
      tr.className = 'isc-row';
      const econ =
        Number.isFinite(bowler.economy) && bowler.legalBalls > 0
          ? formatStat(bowler.economy, 2)
          : '0.00';
      const vals = [
        nameOfCard(card, bowler.playerId),
        bowler.oversText?.trim() || '0.0',
        String(bowler.maidens ?? 0),
        String(bowler.runsConceded ?? 0),
        String(bowler.wickets ?? 0),
        econ,
      ];
      for (const [i, text] of vals.entries()) {
        const td = document.createElement('td');
        td.textContent = text;
        td.className = i === 0 ? 'isc-col-name' : 'isc-col-num';
        tr.appendChild(td);
      }
      bowlBody.appendChild(tr);
    }

    try {
      paintFowPane(fowList, fowEmpty, card, innings);
    } catch (err) {
      warnGraphics(err);
    }
    try {
      paintPartnershipsPane(psList, psEmpty, card, innings);
    } catch (err) {
      warnGraphics(err);
    }
    try {
      const overs = groupTimelineByOver(innings.timeline);
      oversEmpty.hidden = overs.length > 0;
      paintOversChart(oversChart, overs);
    } catch (err) {
      warnGraphics(err);
    }

    return batRows.length > 0 || innings.bowlers.length > 0 || innings.runs >= 0;
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
      }
    },
    showLoading(nextView = 'batting'): boolean {
      try {
        view = parseInningsBreakView(nextView);
        xiStatus = 'loading';
        ensureMarkup();
        setViewUi();
        setLoadingUi(true);
        onAir = true;
        showNode();
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
    show(card, ctx, nextView = 'batting', status = 'no_squad', inningsArg = null): boolean {
      try {
        view = parseInningsBreakView(nextView);
        if (status === 'loading') {
          xiStatus = 'loading';
          ensureMarkup();
          setViewUi();
          setLoadingUi(true);
          onAir = true;
          showNode();
          return true;
        }
        if (!card) {
          hideNode();
          return false;
        }
        const innings =
          inningsArg ?? resolveInningsBreakInnings(card);
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
        showNode();
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
