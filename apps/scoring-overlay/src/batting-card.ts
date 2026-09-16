/**
 * Batting card — live batting scorecard for one team's innings (crease batters only).
 */

import {
  battingTeamLabel,
  findInningsByKey,
  formatDismissalShort,
  formatStat,
  playerName,
  shortName,
} from './graphics-format';
import { concealGraphic, revealGraphic } from './graphic-visibility';
import type { BatterCard, InningsScorecard, ScorecardResponse } from './types';

import './batting-card.css';

export interface BattingCardController {
  host: HTMLElement;
  isOnAir: () => boolean;
  hide: () => void;
  show: (card: ScorecardResponse | null, inningsId: string | null) => boolean;
}

function warnGraphics(err: unknown): void {
  console.warn('[batting-card]', err);
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
    return '0.00';
  }
  if (Number.isFinite(batter.strikeRate)) {
    return formatStat(batter.strikeRate, 2);
  }
  return formatStat((batter.runs / batter.balls) * 100, 2);
}

function buildMarkup(): string {
  return `
    <div class="panel panel-batting-card">
      <div class="panel-accent"></div>
      <div class="bc-body">
        <p class="bc-eyebrow">Batting card</p>
        <div class="bc-head">
          <p data-bc-team class="bc-team">—</p>
          <p data-bc-total class="bc-total">0/0</p>
        </div>
        <div class="bc-table-wrap">
          <table class="bc-table" aria-label="Batting scorecard">
            <thead>
              <tr>
                <th class="bc-col-name">Batter</th>
                <th class="bc-col-how">How out</th>
                <th class="bc-col-num">R</th>
                <th class="bc-col-num">B</th>
                <th class="bc-col-num">4s</th>
                <th class="bc-col-num">6s</th>
                <th class="bc-col-num">SR</th>
              </tr>
            </thead>
            <tbody data-bc-body></tbody>
          </table>
        </div>
        <p data-bc-empty class="bc-empty" hidden>No batters yet</p>
      </div>
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

  const qs = <T extends HTMLElement>(selector: string): T | null =>
    host.querySelector(selector) as T | null;

  const ensureMarkup = (): void => {
    if (!host.querySelector('.panel-batting-card')) {
      host.innerHTML = buildMarkup();
    }
  };

  const hideNode = (): void => {
    onAir = false;
    concealGraphic(host);
  };

  const paint = (card: ScorecardResponse, innings: InningsScorecard): boolean => {
    ensureMarkup();
    const teamEl = qs<HTMLElement>('[data-bc-team]');
    const totalEl = qs<HTMLElement>('[data-bc-total]');
    const body = qs<HTMLElement>('[data-bc-body]');
    const empty = qs<HTMLElement>('[data-bc-empty]');
    if (!teamEl || !totalEl || !body || !empty) {
      return false;
    }

    teamEl.textContent = battingTeamLabel(card, innings);
    totalEl.textContent = `${innings.runs}/${innings.wickets}`;

    body.replaceChildren();
    const batters = innings.batters;
    empty.hidden = batters.length > 0;

    for (const batter of batters) {
      const atCrease =
        !batter.isOut &&
        (batter.playerId === innings.currentStrikerId ||
          batter.playerId === innings.currentNonStrikerId);
      const onStrike =
        !batter.isOut && batter.playerId === innings.currentStrikerId;

      const tr = document.createElement('tr');
      if (atCrease) {
        tr.classList.add('is-crease');
      }

      const nameTd = document.createElement('td');
      nameTd.className = 'bc-col-name';
      nameTd.textContent = `${nameOf(card, batter.playerId)}${onStrike ? ' *' : ''}`;

      const howTd = document.createElement('td');
      howTd.className = 'bc-col-how';
      howTd.textContent = howOutText(card, batter);

      const cells: Array<[string, string]> = [
        ['bc-col-num', String(batter.runs)],
        ['bc-col-num', String(batter.balls)],
        ['bc-col-num', String(batter.fours)],
        ['bc-col-num', String(batter.sixes)],
        ['bc-col-num', strikeRateText(batter)],
      ];

      tr.append(nameTd, howTd);
      for (const [cls, text] of cells) {
        const td = document.createElement('td');
        td.className = cls;
        td.textContent = text;
        tr.appendChild(td);
      }
      body.appendChild(tr);
    }

    return true;
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
    show(card, inningsId) {
      try {
        if (!card) {
          hideNode();
          return false;
        }
        const innings = resolveInnings(card, inningsId);
        if (!innings || !paint(card, innings)) {
          hideNode();
          return false;
        }
        onAir = true;
        revealGraphic(host);
        return true;
      } catch (err) {
        warnGraphics(err);
        hideNode();
        return false;
      }
    },
  };
}
