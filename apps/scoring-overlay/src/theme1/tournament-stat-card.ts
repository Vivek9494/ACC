import './tournament-stat-card.css';

const ANIM_MS = 280;

export type TournamentStatKind = 'fours' | 'sixes';

export interface TournamentStatCardController {
  readonly host: HTMLElement;
  isOnAir(): boolean;
  hide(): void;
  show(kind: TournamentStatKind, total: number): boolean;
}

function labelsFor(kind: TournamentStatKind): { eyebrow: string; symbol: string } {
  if (kind === 'fours') {
    return { eyebrow: 'Tournament Fours', symbol: '4' };
  }
  return { eyebrow: 'Tournament Sixes', symbol: '6' };
}

function buildMarkup(): string {
  return `
    <div class="t1-stat-panel t1-checker">
      <div class="t1-stat-accent"></div>
      <div class="t1-stat-body">
        <p class="t1-stat-eyebrow" data-stat-eyebrow>Tournament Fours</p>
        <p class="t1-stat-kind" data-stat-kind aria-hidden="true">4</p>
        <p class="t1-stat-value" data-stat-value>0</p>
      </div>
    </div>
  `.trim();
}

export function mountTournamentStatCard(host: HTMLElement): TournamentStatCardController {
  let onAir = false;

  const ensureMarkup = (): void => {
    if (!host.querySelector('.t1-stat-panel')) {
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

  const paint = (kind: TournamentStatKind, total: number): boolean => {
    ensureMarkup();
    const { eyebrow, symbol } = labelsFor(kind);
    const eyebrowEl = host.querySelector('[data-stat-eyebrow]');
    const kindEl = host.querySelector('[data-stat-kind]');
    const valueEl = host.querySelector('[data-stat-value]');
    if (
      !(eyebrowEl instanceof HTMLElement) ||
      !(kindEl instanceof HTMLElement) ||
      !(valueEl instanceof HTMLElement)
    ) {
      return false;
    }
    eyebrowEl.textContent = eyebrow;
    kindEl.textContent = symbol;
    valueEl.textContent = String(total);
    return true;
  };

  return {
    host,
    isOnAir: () => onAir,
    hide: hideNode,
    show(kind, total) {
      if (!paint(kind, total)) {
        hideNode();
        return false;
      }
      onAir = true;
      showNode();
      return true;
    },
  };
}
