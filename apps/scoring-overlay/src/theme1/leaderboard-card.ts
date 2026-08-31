import './leaderboard-card.css';

const ANIM_MS = 280;
const TOP_N = 5;

export type LeaderboardCardMode = 'batting' | 'bowling';

export interface LeaderboardRowView {
  rank: number;
  name: string;
  teamName: string;
  stat: number;
}

export interface LeaderboardCardController {
  readonly host: HTMLElement;
  isOnAir(): boolean;
  hide(): void;
  show(mode: LeaderboardCardMode, rows: LeaderboardRowView[]): boolean;
}

function titleFor(mode: LeaderboardCardMode): string {
  return mode === 'batting' ? 'Most Runs' : 'Most Wickets';
}

function statLabel(mode: LeaderboardCardMode): string {
  return mode === 'batting' ? 'Runs' : 'Wickets';
}

function buildMarkup(): string {
  return `
    <div class="t1-lb-panel">
      <div class="t1-lb-accent"></div>
      <div class="t1-lb-head">
        <h2 class="t1-lb-title" data-lb-title>Most Runs</h2>
      </div>
      <ol class="t1-lb-list" data-lb-list aria-label="Tournament leaderboard"></ol>
      <p class="t1-lb-empty" data-lb-empty hidden>No records yet</p>
    </div>
  `.trim();
}

export function mountLeaderboardCard(host: HTMLElement): LeaderboardCardController {
  let onAir = false;

  const ensureMarkup = (): void => {
    if (!host.querySelector('.t1-lb-panel')) {
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

  const paint = (mode: LeaderboardCardMode, rows: LeaderboardRowView[]): boolean => {
    ensureMarkup();
    const title = host.querySelector('[data-lb-title]');
    const list = host.querySelector('[data-lb-list]');
    const empty = host.querySelector('[data-lb-empty]');
    if (!(title instanceof HTMLElement) || !(list instanceof HTMLElement)) {
      return false;
    }

    title.textContent = titleFor(mode);
    list.setAttribute('aria-label', statLabel(mode));

    const top = rows.slice(0, TOP_N);
    if (top.length === 0) {
      list.replaceChildren();
      if (empty instanceof HTMLElement) {
        empty.hidden = false;
      }
      return false;
    }

    if (empty instanceof HTMLElement) {
      empty.hidden = true;
    }

    list.replaceChildren();
    for (const row of top) {
      const li = document.createElement('li');
      li.className = 't1-lb-row';

      const rank = document.createElement('span');
      rank.className = 't1-lb-rank';
      rank.textContent = String(row.rank);

      const name = document.createElement('span');
      name.className = 't1-lb-name';
      name.textContent = row.name;

      const team = document.createElement('span');
      team.className = 't1-lb-team';
      team.textContent = row.teamName;

      const stat = document.createElement('span');
      stat.className = 't1-lb-stat';
      stat.textContent = String(row.stat);

      li.append(rank, name, team, stat);
      list.appendChild(li);
    }

    return true;
  };

  return {
    host,
    isOnAir: () => onAir,
    hide: hideNode,
    show(mode, rows) {
      if (!paint(mode, rows)) {
        hideNode();
        return false;
      }
      onAir = true;
      showNode();
      return true;
    },
  };
}
