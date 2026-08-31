import './points-table-card.css';
import type { TeamStandingRowView, TournamentStandingsView } from '../types';

const ANIM_MS = 280;

function formatNrr(nrr: number): string {
  const rounded = Math.round(nrr * 1000) / 1000;
  const sign = rounded >= 0 ? '+' : '';
  return `${sign}${rounded.toFixed(3)}`;
}

function mergedTeams(standings: TournamentStandingsView): TeamStandingRowView[] {
  const teams = standings.tables.flatMap((table) => table.teams);
  return [...teams].sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points;
    }
    if (b.netRunRate !== a.netRunRate) {
      return b.netRunRate - a.netRunRate;
    }
    return a.teamName.localeCompare(b.teamName);
  });
}

export interface PointsTableCardController {
  readonly host: HTMLElement;
  isOnAir(): boolean;
  hide(): void;
  show(standings: TournamentStandingsView | null): boolean;
}

function buildMarkup(): string {
  return `
    <div class="t1-pt-panel">
      <div class="t1-pt-accent"></div>
      <div class="t1-pt-head">
        <h2 class="t1-pt-title">Points Table</h2>
      </div>
      <div class="t1-pt-table-wrap">
        <table class="t1-pt-table" aria-label="Tournament points table">
          <thead>
            <tr>
              <th scope="col">Team</th>
              <th scope="col">M</th>
              <th scope="col">W</th>
              <th scope="col">L</th>
              <th scope="col">T</th>
              <th scope="col">NR</th>
              <th scope="col" data-pt-nrr-col>NRR</th>
              <th scope="col">Pts</th>
            </tr>
          </thead>
          <tbody data-pt-body></tbody>
        </table>
        <p class="t1-pt-empty" data-pt-empty hidden>No standings yet</p>
      </div>
    </div>
  `.trim();
}

export function mountPointsTableCard(host: HTMLElement): PointsTableCardController {
  let onAir = false;

  const ensureMarkup = (): void => {
    if (!host.querySelector('.t1-pt-panel')) {
      host.innerHTML = buildMarkup();
    }
  };

  const hideNode = (): void => {
    onAir = false;
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

  const paint = (standings: TournamentStandingsView): boolean => {
    ensureMarkup();
    const body = host.querySelector('[data-pt-body]');
    const empty = host.querySelector('[data-pt-empty]');
    const nrrCol = host.querySelector('[data-pt-nrr-col]');
    if (!(body instanceof HTMLElement) || !(empty instanceof HTMLElement)) {
      return false;
    }

    const teams = mergedTeams(standings);
    if (teams.length === 0) {
      body.replaceChildren();
      empty.hidden = false;
      return false;
    }

    empty.hidden = true;
    if (nrrCol instanceof HTMLElement) {
      nrrCol.hidden = !standings.showNetRunRate;
    }

    body.replaceChildren();
    for (let i = 0; i < teams.length; i += 1) {
      const row = teams[i];
      const tr = document.createElement('tr');
      if (i === 0 && row.points > 0) {
        tr.classList.add('is-leader');
      }

      const teamTd = document.createElement('td');
      teamTd.className = 'col-team';
      teamTd.textContent = row.teamName;

      const statCells: Array<[string, string]> = [
        ['', String(row.matches)],
        ['', String(row.wins)],
        ['', String(row.losses)],
        ['', '0'],
        ['', String(row.noResults)],
      ];

      if (standings.showNetRunRate) {
        const nrrClass =
          row.netRunRate >= 0 ? 'col-nrr positive' : 'col-nrr negative';
        statCells.push([nrrClass, formatNrr(row.netRunRate)]);
      }

      statCells.push(['', String(row.points)]);

      tr.appendChild(teamTd);
      for (const [className, text] of statCells) {
        const td = document.createElement('td');
        if (className) {
          td.className = className;
        }
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
    hide: hideNode,
    show(standings) {
      if (!standings || !paint(standings)) {
        hideNode();
        return false;
      }
      onAir = true;
      showNode();
      return true;
    },
  };
}
