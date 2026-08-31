import {
  combineCareerBowlingWithLive,
  formatStat,
} from '../../graphics-format';
import type {
  BroadcastPlayerStatsView,
  ScorecardResponse,
} from '../../types';
import {
  buildStripViewModel,
  formatRunsToWinLine,
  formatTossLine,
  type StripViewModel,
} from '../../view-model';
import type { ScoreStripHost, ScoreStripRenderParams } from '../types';

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) {
    throw new Error(`Missing #${id}`);
  }
  return node as T;
}

function setText(id: string, text: string): void {
  const node = el(id);
  if (node.textContent !== text) {
    node.textContent = text;
  }
}

function setLogoPuck(
  imgId: string,
  fallbackId: string,
  fallbackText: string,
  logoUrl: string | null,
): void {
  const fallback = el<HTMLSpanElement>(fallbackId);
  const img = el<HTMLImageElement>(imgId);
  fallback.textContent = fallbackText;
  if (logoUrl) {
    img.onload = () => {
      img.hidden = false;
      fallback.hidden = true;
    };
    img.onerror = () => {
      img.hidden = true;
      fallback.hidden = false;
      img.removeAttribute('src');
    };
    if (img.getAttribute('src') !== logoUrl) {
      img.hidden = true;
      fallback.hidden = false;
      img.src = logoUrl;
    }
  } else {
    img.hidden = true;
    fallback.hidden = false;
    img.removeAttribute('src');
  }
}

function paintAscCrest(): void {
  const params = new URLSearchParams(window.location.search);
  const ascLogo = params.get('ascLogo')?.trim() || null;
  setLogoPuck('asc-logo', 'asc-fallback', 'ASC', ascLogo);
}

function renderOverTracker(vm: StripViewModel): void {
  const tracker = el<HTMLDivElement>('over-tracker');
  const signature = vm.overTracker.slots
    .map((s) => `${s.label}:${s.isExtra ? 'e' : s.isWicket ? 'w' : 'r'}`)
    .join('|');
  if (tracker.dataset.sig === signature) {
    return;
  }
  tracker.dataset.sig = signature;

  tracker.replaceChildren();
  for (const slot of vm.overTracker.slots) {
    const node = document.createElement('span');
    node.className = 'ob';
    if (slot.isExtra) {
      node.classList.add('extra');
      node.textContent = slot.label;
    } else if (slot.isWicket) {
      node.classList.add('wicket');
      node.textContent = slot.label;
    } else if (slot.label === '●' || slot.label === '•') {
      node.textContent = '•';
    } else {
      node.classList.add('run');
      node.textContent = slot.label;
    }
    tracker.appendChild(node);
  }
}

function renderBatters(vm: StripViewModel): void {
  for (let i = 0; i < 2; i += 1) {
    const batter = vm.batsmen[i] ?? {
      name: '—',
      runs: '0',
      balls: '0',
      onStrike: false,
    };
    const strike = el<HTMLSpanElement>(`batter-${i}-strike`);
    strike.hidden = !batter.onStrike;
    setText(`batter-${i}-name`, batter.name);
    setText(`batter-${i}-runs`, batter.runs || '0');
    setText(`batter-${i}-balls`, batter.balls || '0');
  }
}

function renderSubLine(
  vm: StripViewModel,
  card: ScorecardResponse,
  crrMode: ScoreStripRenderParams['crrMode'],
): void {
  const sub = el<HTMLDivElement>('sub-line');
  let text: string | null = null;

  if (crrMode === 'chase') {
    text = formatRunsToWinLine(card) ?? vm.needOffLine;
  } else if (crrMode === 'boundaries') {
    text = vm.boundariesLine;
  } else {
    text = vm.autoSubLine;
  }

  if (text) {
    sub.hidden = false;
    if (sub.textContent !== text) {
      sub.textContent = text;
    }
  } else {
    sub.hidden = true;
    sub.textContent = '';
  }
}

function renderBowlerPanel(
  vm: StripViewModel,
  ctx: ScoreStripRenderParams['ctx'],
  crrMode: ScoreStripRenderParams['crrMode'],
): void {
  const stack = el<HTMLDivElement>('bowler-stack');
  const normal = el<HTMLDivElement>('bowler-normal');
  const tossLine = el<HTMLParagraphElement>('bowler-toss-line');

  if (crrMode === 'toss') {
    const text = formatTossLine(ctx);
    if (text) {
      stack.classList.add('is-toss');
      normal.hidden = true;
      tossLine.hidden = false;
      if (tossLine.textContent !== text) {
        tossLine.textContent = text;
      }
      return;
    }
  }

  stack.classList.remove('is-toss');
  normal.hidden = false;
  tossLine.hidden = true;
  tossLine.textContent = '';
  setText('bowler-name', vm.bowlerName);
  setText('bowler-figs', vm.bowlerFigs);
  setText('bowler-overs', vm.bowlerOvers);
  renderOverTracker(vm);
}

/** Theme 1 lower-third score strip controller. */
export function createTheme1ScoreStripHost(): ScoreStripHost {
  return {
    render({
      card,
      ctx,
      status,
      missingMatchId,
      crrMode,
      hideStrip = false,
    }: ScoreStripRenderParams): void {
      const wrap = el<HTMLDivElement>('strip-wrap');
      const idle = el<HTMLDivElement>('idle');
      const conn = el<HTMLDivElement>('conn');

      if (missingMatchId) {
        wrap.hidden = true;
        idle.hidden = false;
        idle.textContent = 'Add ?matchId=… to the overlay URL';
        return;
      }

      conn.hidden = status !== 'offline' && status !== 'connecting';
      conn.textContent = status === 'connecting' ? 'Connecting…' : 'Reconnecting…';

      if (!card) {
        if (wrap.hidden) {
          idle.hidden = false;
          idle.textContent = status === 'live' ? 'Waiting for live score…' : 'Connecting…';
        }
        return;
      }

      const vm = buildStripViewModel(card, ctx);
      if (!vm) {
        if (wrap.hidden) {
          idle.hidden = false;
          idle.textContent = 'Match ready — waiting for innings…';
        }
        return;
      }

      idle.hidden = true;
      wrap.hidden = hideStrip;

      paintAscCrest();
      setLogoPuck('bowl-logo', 'bowl-initials', vm.bowling.initials, vm.bowling.logoUrl);
      renderBatters(vm);
      setText('team-line', vm.teamShort);
      setText('score-line', vm.scoreLine);
      setText('overs-line', vm.oversLine);
      renderSubLine(vm, card, crrMode);
      renderBowlerPanel(vm, ctx, crrMode);
    },

    fillCareerCard(
      playerId: string,
      card: ScorecardResponse | null,
      career: BroadcastPlayerStatsView,
    ): void {
      const full =
        card?.display.players[playerId]?.trim() ||
        `${career.firstName} ${career.lastName}`.trim() ||
        '—';
      const displayName = full === '—' ? '—' : full.toUpperCase();
      const initialEl = el<HTMLSpanElement>('bc-name-initial');
      const surnameEl = el<HTMLSpanElement>('bc-name-surname');
      const nameRoot = el<HTMLParagraphElement>('bc-name');

      initialEl.textContent = '';
      surnameEl.textContent = displayName;
      nameRoot.setAttribute('aria-label', displayName);

      const combined = combineCareerBowlingWithLive(career, card, playerId);
      setText('bc-matches', String(combined.matches));
      setText('bc-wickets', String(combined.wickets));
      setText('bc-avg', formatStat(combined.average, 2));
      setText('bc-econ', formatStat(combined.economy, 2));
      setText('bc-best', combined.best);
    },

    careerWrapElement(): HTMLDivElement {
      return el<HTMLDivElement>('career-wrap');
    },

    revealCareerCard(): void {
      const node = el<HTMLDivElement>('career-wrap');
      node.hidden = false;
      requestAnimationFrame(() => node.classList.add('is-visible'));
    },

    hideCareerCard(onHidden: () => void, animMs: number): void {
      const node = el<HTMLDivElement>('career-wrap');
      node.classList.remove('is-visible');
      window.setTimeout(onHidden, animMs);
    },
  };
}
