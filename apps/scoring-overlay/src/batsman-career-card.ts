/**
 * Shared batsman career profile card for the root strip page and graphics.html.
 */

import './batsman-career-card.css';
import { fetchBroadcastPlayerStats } from './broadcast-fetch';
import {
  formatHighestScoreMeta,
  formatStat,
  hasBatsmanCareerStats,
  initialsFromName,
  isUuid,
} from './graphics-format';
import type { BallType, BroadcastPlayerStatsView } from './types';

const ANIM_MS = 280;

export interface BatsmanCareerShowOptions {
  apiBase: string;
  ballType: BallType;
  /** Optional display name while stats load (e.g. from scorecard). */
  placeholderName?: string;
}

export interface BatsmanCareerCardController {
  /** Animated host element (layer or graphic shell). */
  readonly host: HTMLElement;
  isOnAir(): boolean;
  hide(): void;
  /**
   * Fetch career stats and show the card. Returns false when there is nothing
   * useful to put on air (caller should clear on-air state).
   */
  show(playerId: string, opts: BatsmanCareerShowOptions): Promise<boolean>;
}

function qs<T extends HTMLElement>(root: ParentNode, selector: string): T {
  const node = root.querySelector(selector);
  if (!node) {
    throw new Error(`Missing ${selector} in batsman career card`);
  }
  return node as T;
}

function setText(root: ParentNode, selector: string, text: string): void {
  const node = qs<HTMLElement>(root, selector);
  if (node.textContent !== text) {
    node.textContent = text;
  }
}

function setAvatar(
  root: ParentNode,
  name: string,
  photoUrl: string | null,
): void {
  const initials = qs<HTMLSpanElement>(root, '[data-bc="initials"]');
  const img = qs<HTMLImageElement>(root, '[data-bc="img"]');
  initials.textContent = initialsFromName(name);
  if (photoUrl) {
    img.onload = () => {
      img.hidden = false;
      initials.hidden = true;
    };
    img.onerror = () => {
      img.hidden = true;
      initials.hidden = false;
      img.removeAttribute('src');
    };
    if (img.getAttribute('src') !== photoUrl) {
      img.hidden = true;
      initials.hidden = false;
      img.src = photoUrl;
    }
  } else {
    img.hidden = true;
    initials.hidden = false;
    img.removeAttribute('src');
  }
}

function buildCardMarkup(): string {
  return `
    <div class="panel panel-batsman-career">
      <div class="panel-accent"></div>
      <div class="bc-career-layout">
        <div class="bc-career-photo" aria-hidden="true">
          <span data-bc="initials" class="bc-career-initials">?</span>
          <img data-bc="img" class="bc-career-img" alt="" hidden />
        </div>
        <div class="bc-career-copy">
          <p data-bc="format" class="bc-career-format">—</p>
          <p class="bc-career-name">
            <span data-bc="given" class="bc-career-given"></span><span data-bc="family" class="bc-career-family">—</span>
          </p>
          <div class="bc-career-rows" role="table" aria-label="Batting career stats">
            <div class="bc-career-row" role="row">
              <span class="bc-career-label">Innings</span>
              <span data-bc="innings" class="bc-career-value">—</span>
            </div>
            <div class="bc-career-row" role="row">
              <span class="bc-career-label">Runs</span>
              <span data-bc="runs" class="bc-career-value">—</span>
            </div>
            <div class="bc-career-row" role="row">
              <span class="bc-career-label">Average</span>
              <span data-bc="avg" class="bc-career-value">—</span>
            </div>
            <div class="bc-career-row" role="row">
              <span class="bc-career-label">Strike Rate</span>
              <span data-bc="sr" class="bc-career-value">—</span>
            </div>
            <div class="bc-career-row" role="row">
              <span class="bc-career-label">30s</span>
              <span data-bc="thirties" class="bc-career-value">—</span>
            </div>
            <div class="bc-career-row" role="row">
              <span class="bc-career-label">50s</span>
              <span data-bc="fifties" class="bc-career-value">—</span>
            </div>
          </div>
          <div class="bc-career-hs">
            <p class="bc-career-hs-label">Highest Score</p>
            <p data-bc="hs" class="bc-career-hs-value">—</p>
            <p data-bc="hs-meta" class="bc-career-hs-meta" hidden></p>
          </div>
        </div>
      </div>
    </div>
  `.trim();
}

function splitName(full: string): { given: string; family: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { given: '', family: '—' };
  }
  if (parts.length === 1) {
    return { given: '', family: parts[0] ?? '—' };
  }
  return {
    given: `${parts.slice(0, -1).join(' ')} `,
    family: parts[parts.length - 1] ?? '—',
  };
}

function formatLabel(ballType: BallType): string {
  return ballType === 'LEATHER' ? 'LEATHER CAREER' : 'TENNIS CAREER';
}

function fillPlaceholder(
  root: ParentNode,
  ballType: BallType,
  displayName: string,
): void {
  const { given, family } = splitName(displayName);
  qs<HTMLSpanElement>(root, '[data-bc="given"]').textContent = given;
  qs<HTMLSpanElement>(root, '[data-bc="family"]').textContent = family;
  setText(root, '[data-bc="format"]', formatLabel(ballType));
  setText(root, '[data-bc="innings"]', '—');
  setText(root, '[data-bc="runs"]', '—');
  setText(root, '[data-bc="avg"]', '—');
  setText(root, '[data-bc="sr"]', '—');
  setText(root, '[data-bc="thirties"]', '—');
  setText(root, '[data-bc="fifties"]', '—');
  setText(root, '[data-bc="hs"]', '—');
  const meta = qs<HTMLParagraphElement>(root, '[data-bc="hs-meta"]');
  meta.hidden = true;
  meta.textContent = '';
  setAvatar(root, displayName || '—', null);
}

function applyStats(root: ParentNode, stats: BroadcastPlayerStatsView): void {
  const given = stats.firstName?.trim() ? `${stats.firstName.trim()} ` : '';
  const family = stats.lastName?.trim() || '—';
  qs<HTMLSpanElement>(root, '[data-bc="given"]').textContent = given;
  qs<HTMLSpanElement>(root, '[data-bc="family"]').textContent = family;
  setText(root, '[data-bc="format"]', formatLabel(stats.ballType));
  setText(root, '[data-bc="innings"]', String(stats.battingInnings));
  setText(root, '[data-bc="runs"]', String(stats.runs));
  setText(root, '[data-bc="avg"]', formatStat(stats.average, 2));
  setText(root, '[data-bc="sr"]', formatStat(stats.strikeRate, 1));
  setText(root, '[data-bc="thirties"]', String(stats.thirties));
  setText(root, '[data-bc="fifties"]', String(stats.fifties));
  setText(root, '[data-bc="hs"]', stats.highestScore?.trim() || '—');
  const metaLine = formatHighestScoreMeta(stats);
  const meta = qs<HTMLParagraphElement>(root, '[data-bc="hs-meta"]');
  if (metaLine) {
    meta.hidden = false;
    meta.textContent = metaLine;
  } else {
    meta.hidden = true;
    meta.textContent = '';
  }
  const full = `${stats.firstName} ${stats.lastName}`.trim() || '—';
  setAvatar(root, full, stats.profilePhotoUrl);
}

/**
 * Mount the batsman career card into `host` (clears existing children).
 * Root strip: host should use `.batsman-career-layer`.
 * graphics.html: host should use `.graphic.batsman-career-graphic`.
 */
export function mountBatsmanCareerCard(
  host: HTMLElement,
): BatsmanCareerCardController {
  host.innerHTML = buildCardMarkup();
  host.setAttribute('aria-live', 'polite');

  let onAir = false;
  let token = 0;
  const cache = new Map<string, BroadcastPlayerStatsView | null>();

  const showHost = (): void => {
    host.hidden = false;
    requestAnimationFrame(() => host.classList.add('is-visible'));
    onAir = true;
  };

  const hideHost = (): void => {
    onAir = false;
    host.classList.remove('is-visible');
    window.setTimeout(() => {
      if (!onAir) {
        host.hidden = true;
      }
    }, ANIM_MS);
  };

  return {
    host,
    isOnAir: () => onAir,
    hide: () => {
      token += 1;
      hideHost();
    },
    async show(playerId, opts) {
      if (!isUuid(playerId)) {
        hideHost();
        return false;
      }

      const displayName = opts.placeholderName?.trim() || '—';
      fillPlaceholder(host, opts.ballType, displayName);
      showHost();

      const request = ++token;
      const key = `${playerId}:${opts.ballType}`;
      let stats: BroadcastPlayerStatsView | null;
      if (cache.has(key)) {
        stats = cache.get(key) ?? null;
      } else {
        stats = await fetchBroadcastPlayerStats(
          opts.apiBase,
          playerId,
          opts.ballType,
        );
        cache.set(key, stats);
      }

      if (request !== token) {
        return false;
      }
      if (!stats || !hasBatsmanCareerStats(stats)) {
        hideHost();
        return false;
      }
      applyStats(host, stats);
      onAir = true;
      return true;
    },
  };
}
