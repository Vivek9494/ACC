/**
 * Centered TOSS RESULT card for root strip page + graphics.html.
 *
 * Isolation: show/hide paths are try/catch'd so a toss-card error never
 * blanks the score strip or other graphics.
 */

import './toss-result-card.css';
import type { MatchContext } from './types';
import { formatTossLine, teamInitials } from './view-model';

const ANIM_MS = 280;

export interface TossResultCardController {
  readonly host: HTMLElement;
  isOnAir(): boolean;
  hide(): void;
  /** Returns false when toss is not recorded (caller clears on-air state). */
  show(ctx: MatchContext | null): boolean;
}

function warnGraphics(err: unknown): void {
  console.warn('[toss-result]', err);
}

function qs<T extends HTMLElement>(
  root: ParentNode,
  selector: string,
): T | null {
  return root.querySelector(selector) as T | null;
}

function teamSide(
  ctx: MatchContext,
  side: 'A' | 'B',
): { name: string; logoUrl: string | null; initials: string } {
  if (side === 'A') {
    const name = ctx.homeTeamName?.trim() || 'Home';
    const logoUrl =
      ctx.homeTeamId && ctx.logosByTeamId[ctx.homeTeamId]
        ? ctx.logosByTeamId[ctx.homeTeamId]
        : null;
    return { name, logoUrl, initials: teamInitials(name) };
  }
  const name =
    ctx.awayTeamName?.trim() ||
    ctx.externalOpponentName?.trim() ||
    'Away';
  const logoUrl =
    ctx.awayTeamId && ctx.logosByTeamId[ctx.awayTeamId]
      ? ctx.logosByTeamId[ctx.awayTeamId]
      : null;
  return { name, logoUrl, initials: teamInitials(name) };
}

function setLogo(
  root: ParentNode,
  side: 'a' | 'b',
  logoUrl: string | null,
  initials: string,
): void {
  const initialsEl = qs<HTMLSpanElement>(root, `[data-tr-initials="${side}"]`);
  const img = qs<HTMLImageElement>(root, `[data-tr-logo="${side}"]`);
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

function buildCardMarkup(): string {
  return `
    <div class="panel panel-toss-result">
      <div class="panel-accent"></div>
      <div class="tr-body">
        <p class="tr-eyebrow">Toss result</p>
        <div class="tr-teams" aria-label="Match teams">
          <div class="tr-team tr-team-a">
            <div class="tr-logo" aria-hidden="true">
              <span data-tr-initials="a" class="tr-initials">—</span>
              <img data-tr-logo="a" class="tr-logo-img" alt="" hidden />
            </div>
            <p data-tr-name="a" class="tr-name">—</p>
          </div>
          <p class="tr-vs" aria-hidden="true">vs</p>
          <div class="tr-team tr-team-b">
            <p data-tr-name="b" class="tr-name">—</p>
            <div class="tr-logo" aria-hidden="true">
              <span data-tr-initials="b" class="tr-initials">—</span>
              <img data-tr-logo="b" class="tr-logo-img" alt="" hidden />
            </div>
          </div>
        </div>
        <p data-tr-line class="tr-result"></p>
      </div>
    </div>
  `.trim();
}

/**
 * Broadcast line with BAT/BOWL emphasized (uppercase). Null until toss recorded.
 */
export function formatTossResultLine(ctx: MatchContext | null): string | null {
  const base = formatTossLine(ctx);
  if (!base || !ctx?.tossDecision) {
    return null;
  }
  const choice = ctx.tossDecision === 'BAT' ? 'BAT' : 'BOWL';
  return base.replace(/chose to (bat|bowl)$/i, `chose to ${choice}`);
}

export function mountTossResultCard(
  host: HTMLElement,
): TossResultCardController {
  let onAir = false;

  const ensureMarkup = (): void => {
    if (!host.querySelector('.panel-toss-result')) {
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
    const line = formatTossResultLine(ctx);
    if (!line) {
      return false;
    }

    const a = teamSide(ctx, 'A');
    const b = teamSide(ctx, 'B');
    const nameA = qs<HTMLElement>(host, '[data-tr-name="a"]');
    const nameB = qs<HTMLElement>(host, '[data-tr-name="b"]');
    const lineEl = qs<HTMLElement>(host, '[data-tr-line]');
    if (!nameA || !nameB || !lineEl) {
      return false;
    }

    nameA.textContent = a.name;
    nameB.textContent = b.name;
    setLogo(host, 'a', a.logoUrl, a.initials);
    setLogo(host, 'b', b.logoUrl, b.initials);

    const winnerName =
      ctx.tossWinner === 'TEAM_A'
        ? a.name
        : b.name;
    const choice = ctx.tossDecision === 'BAT' ? 'BAT' : 'BOWL';
    lineEl.replaceChildren();
    const winSpan = document.createElement('span');
    winSpan.className = 'tr-winner';
    winSpan.textContent = winnerName;
    const mid = document.createTextNode(' won the toss and chose to ');
    const choiceSpan = document.createElement('span');
    choiceSpan.className = 'tr-choice';
    choiceSpan.textContent = choice;
    lineEl.append(winSpan, mid, choiceSpan);

    return true;
  };

  return {
    host,
    isOnAir: () => onAir,
    hide(): void {
      try {
        hideNode();
      } catch (err) {
        warnGraphics(err);
      }
    },
    show(ctx): boolean {
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
