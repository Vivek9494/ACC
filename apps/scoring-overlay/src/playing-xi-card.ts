/**
 * Centered PLAYING XI card — both squads side by side (home left / away right).
 * Match-level; independent of innings. Isolation: show/hide are try/catch'd.
 */

import './playing-xi-card.css';
import type { MatchContext, MatchSquadContext, MatchSquadPlayer } from './types';
import { teamInitials } from './view-model';

const ANIM_MS = 280;
const EMPTY_NOTE = 'Squad not available';

export interface PlayingXiSide {
  name: string;
  logoUrl: string | null;
  initials: string;
  players: string[];
}

export interface PlayingXiCardController {
  readonly host: HTMLElement;
  isOnAir(): boolean;
  hide(): void;
  /** Returns false when match context has no team names. */
  show(ctx: MatchContext | null): boolean;
}

function warnGraphics(err: unknown): void {
  console.warn('[playing-xi]', err);
}

function qs<T extends HTMLElement>(
  root: ParentNode,
  selector: string,
): T | null {
  return root.querySelector(selector) as T | null;
}

function fullName(player: MatchSquadPlayer): string {
  return `${player.firstName} ${player.lastName}`.trim();
}

function squadXi(squad: MatchSquadContext | null | undefined): string[] {
  if (!squad) {
    return [];
  }
  return [...squad.players]
    .filter((p) => p.role === 'PLAYING_XI')
    .sort((a, b) => {
      const ao = a.battingOrder;
      const bo = b.battingOrder;
      if (ao != null && bo != null && ao !== bo) {
        return ao - bo;
      }
      if (ao != null && bo == null) {
        return -1;
      }
      if (ao == null && bo != null) {
        return 1;
      }
      return 0;
    })
    .map((p) => fullName(p))
    .filter((name) => name.length > 0);
}

function externalXi(ctx: MatchContext): string[] {
  return [...ctx.externalPlayers]
    .sort((a, b) => a.slot - b.slot)
    .map((p) => p.name.trim())
    .filter((name) => name.length > 0);
}

function pickSquad(
  ctx: MatchContext,
  teamId: string | null,
  used: Set<string>,
): MatchSquadContext | null {
  if (teamId) {
    const hit = ctx.squads.find((s) => s.teamId === teamId);
    if (hit) {
      return hit;
    }
  }
  return ctx.squads.find((s) => !used.has(s.teamId)) ?? null;
}

export function resolvePlayingXiSides(ctx: MatchContext): {
  a: PlayingXiSide;
  b: PlayingXiSide;
} {
  const nameA = ctx.homeTeamName?.trim() || 'Home';
  const logoA =
    ctx.homeTeamId && ctx.logosByTeamId[ctx.homeTeamId]
      ? ctx.logosByTeamId[ctx.homeTeamId]
      : null;
  const nameB =
    ctx.awayTeamName?.trim() ||
    ctx.externalOpponentName?.trim() ||
    'Away';
  const logoB =
    ctx.awayTeamId && ctx.logosByTeamId[ctx.awayTeamId]
      ? ctx.logosByTeamId[ctx.awayTeamId]
      : null;

  const used = new Set<string>();
  const squadA = pickSquad(ctx, ctx.homeTeamId, used);
  if (squadA) {
    used.add(squadA.teamId);
  }

  let playersB: string[];
  if (ctx.awayTeamId) {
    const squadB = pickSquad(ctx, ctx.awayTeamId, used);
    playersB = squadXi(squadB);
  } else {
    const ext = externalXi(ctx);
    playersB = ext.length > 0 ? ext : [];
  }

  return {
    a: {
      name: nameA,
      logoUrl: logoA,
      initials: teamInitials(nameA),
      players: squadXi(squadA),
    },
    b: {
      name: nameB,
      logoUrl: logoB,
      initials: teamInitials(nameB),
      players: playersB,
    },
  };
}

export function formatPlayingXiPreview(ctx: MatchContext | null): string | null {
  if (!ctx) {
    return null;
  }
  const a = ctx.homeTeamName?.trim();
  const b = ctx.awayTeamName?.trim() || ctx.externalOpponentName?.trim();
  if (!a && !b) {
    return null;
  }
  return `${a || 'Home'} vs ${b || 'Away'}`;
}

function setLogo(
  root: ParentNode,
  side: 'a' | 'b',
  logoUrl: string | null,
  initials: string,
): void {
  const initialsEl = qs<HTMLSpanElement>(root, `[data-pxi-initials="${side}"]`);
  const img = qs<HTMLImageElement>(root, `[data-pxi-logo="${side}"]`);
  if (!initialsEl || !img) {
    return;
  }
  initialsEl.textContent = initials;
  if (logoUrl) {
    img.onload = () => {
      img.hidden = false;
      initialsEl.hidden = true;
    };
    img.onerror = () => {
      img.hidden = true;
      initialsEl.hidden = false;
      img.removeAttribute('src');
    };
    if (img.getAttribute('src') !== logoUrl) {
      img.hidden = true;
      initialsEl.hidden = false;
      img.src = logoUrl;
    }
  } else {
    img.hidden = true;
    initialsEl.hidden = false;
    img.removeAttribute('src');
  }
}

function paintList(host: HTMLElement, side: 'a' | 'b', players: string[]): void {
  const list = qs<HTMLOListElement>(host, `[data-pxi-list="${side}"]`);
  const empty = qs<HTMLParagraphElement>(host, `[data-pxi-empty="${side}"]`);
  if (!list || !empty) {
    return;
  }
  list.replaceChildren();
  if (players.length === 0) {
    list.hidden = true;
    empty.hidden = false;
    empty.textContent = EMPTY_NOTE;
    return;
  }
  empty.hidden = true;
  list.hidden = false;
  for (let i = 0; i < players.length; i += 1) {
    const li = document.createElement('li');
    li.className = 'pxi-row';
    const num = document.createElement('span');
    num.className = 'pxi-num';
    num.textContent = String(i + 1);
    const name = document.createElement('span');
    name.className = 'pxi-name';
    name.textContent = players[i] ?? '';
    li.append(num, name);
    list.appendChild(li);
  }
}

function buildCardMarkup(): string {
  return `
    <div class="panel panel-playing-xi">
      <div class="panel-accent"></div>
      <div class="pxi-body">
        <p class="pxi-eyebrow">Playing XI</p>
        <div class="pxi-cols">
          <section class="pxi-col" aria-label="Team A">
            <div class="pxi-head">
              <div class="pxi-logo" aria-hidden="true">
                <span data-pxi-initials="a" class="pxi-initials">—</span>
                <img data-pxi-logo="a" class="pxi-logo-img" alt="" hidden />
              </div>
              <p data-pxi-team="a" class="pxi-team">—</p>
            </div>
            <ol data-pxi-list="a" class="pxi-list"></ol>
            <p data-pxi-empty="a" class="pxi-empty" hidden>${EMPTY_NOTE}</p>
          </section>
          <section class="pxi-col" aria-label="Team B">
            <div class="pxi-head">
              <div class="pxi-logo" aria-hidden="true">
                <span data-pxi-initials="b" class="pxi-initials">—</span>
                <img data-pxi-logo="b" class="pxi-logo-img" alt="" hidden />
              </div>
              <p data-pxi-team="b" class="pxi-team">—</p>
            </div>
            <ol data-pxi-list="b" class="pxi-list"></ol>
            <p data-pxi-empty="b" class="pxi-empty" hidden>${EMPTY_NOTE}</p>
          </section>
        </div>
      </div>
    </div>
  `.trim();
}

export function mountPlayingXiCard(host: HTMLElement): PlayingXiCardController {
  let onAir = false;

  const ensureMarkup = (): void => {
    if (!host.querySelector('.panel-playing-xi')) {
      host.innerHTML = buildCardMarkup();
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

  const paint = (ctx: MatchContext): boolean => {
    ensureMarkup();
    if (!formatPlayingXiPreview(ctx)) {
      return false;
    }
    const sides = resolvePlayingXiSides(ctx);
    const nameA = qs<HTMLElement>(host, '[data-pxi-team="a"]');
    const nameB = qs<HTMLElement>(host, '[data-pxi-team="b"]');
    if (!nameA || !nameB) {
      return false;
    }
    nameA.textContent = sides.a.name;
    nameB.textContent = sides.b.name;
    setLogo(host, 'a', sides.a.logoUrl, sides.a.initials);
    setLogo(host, 'b', sides.b.logoUrl, sides.b.initials);
    paintList(host, 'a', sides.a.players);
    paintList(host, 'b', sides.b.players);
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
    show(ctx) {
      try {
        if (!ctx || !paint(ctx)) {
          hideNode();
          return false;
        }
        onAir = true;
        showNode();
        return true;
      } catch (err) {
        warnGraphics(err);
        hideNode();
        return false;
      }
    },
  };
}
