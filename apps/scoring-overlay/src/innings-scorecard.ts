/**
 * Full innings scorecard graphic (batting / bowling tabs) for innings break.
 */

import './innings-scorecard.css';
import {
  battingTeamLabel,
  dismissalColumns,
  extrasTotal,
  formatStat,
  playerName,
  resolveBattingSide,
  resolveInningsBreakInnings,
  shortName,
} from './graphics-format';
import type { SidePlayer } from './graphics-format';
import type {
  BatterCard,
  InningsScorecard,
  MatchContext,
  ScorecardResponse,
} from './types';

const ANIM_MS = 280;

export type InningsScorecardView = 'batting' | 'bowling';
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

function buildCardMarkup(): string {
  return `
    <div class="panel panel-innings-sc">
      <div class="panel-accent"></div>
      <div class="isc-body">
        <div class="isc-tabs" role="tablist" aria-label="Scorecard">
          <span data-isc-tab="batting" class="isc-tab is-active">Batting</span>
          <span data-isc-tab="bowling" class="isc-tab">Bowling</span>
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
    if (!host.querySelector('.panel-innings-sc')) {
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
  ): boolean => {
    ensureMarkup();
    const innings = resolveInningsBreakInnings(card);
    if (!innings) {
      return false;
    }

    setViewUi();
    setLoadingUi(false);

    const batBody = qs<HTMLTableSectionElement>('[data-isc-bat-body]');
    const bowlBody = qs<HTMLTableSectionElement>('[data-isc-bowl-body]');
    const totalTeam = qs<HTMLElement>('[data-isc-total-team]');
    const totalRuns = qs<HTMLElement>('[data-isc-total-runs]');
    const totalMeta = qs<HTMLElement>('[data-isc-total-meta]');
    const noteEl = qs<HTMLElement>('[data-isc-note]');
    if (
      !batBody ||
      !bowlBody ||
      !totalTeam ||
      !totalRuns ||
      !totalMeta ||
      !noteEl
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
        view = nextView === 'bowling' ? 'bowling' : 'batting';
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
    show(card, ctx, nextView = 'batting', status = 'no_squad'): boolean {
      try {
        view = nextView === 'bowling' ? 'bowling' : 'batting';
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
        const innings = resolveInningsBreakInnings(card);
        const side =
          innings != null ? resolveBattingSide(card, innings, ctx) : null;
        const xi: InningsXiStatus =
          status === 'full' && side != null && side.players.length > 0
            ? 'full'
            : 'no_squad';
        if (!paint(card, ctx, xi)) {
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
