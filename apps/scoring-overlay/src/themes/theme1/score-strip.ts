import {
  combineCareerBowlingWithLive,
  formatStat,
} from '../../graphics-format';
import { concealGraphic, revealGraphic } from '../../graphic-visibility';
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

const ENTRANCE_STAGGER_MS = 48;
const BOWLER_SLOT_SWAP_MS = 360;
const warnedMissing = new Set<string>();

type BowlerSlotMode = 'bowler' | 'toss';

let bowlerSlotMode: BowlerSlotMode = 'bowler';
let bowlerSwapGen = 0;
let bowlerSwapTimer: number | null = null;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Soft lookup — always-on strip must not throw on a missing node. */
function el<T extends HTMLElement>(id: string): T | null {
  const node = document.getElementById(id);
  if (!node) {
    if (!warnedMissing.has(id)) {
      warnedMissing.add(id);
      console.warn(`[strip] Missing #${id} — paint skipped for that node`);
    }
    return null;
  }
  return node as T;
}

function setText(id: string, text: string): void {
  const node = el(id);
  if (!node) {
    return;
  }
  if (node.textContent !== text) {
    node.textContent = text;
  }
}

function renderOverTracker(vm: StripViewModel): void {
  const tracker = el<HTMLDivElement>('over-tracker');
  const empty = el<HTMLElement>('over-empty');
  if (!tracker) {
    return;
  }

  const slots = vm.overTracker.slots;
  const signature = slots
    .map(
      (s) =>
        `${s.label}:${s.isExtra ? 'e' : s.isWicket ? 'w' : s.isBoundary ? 'b' : 'r'}`,
    )
    .join('|');
  if (tracker.dataset.sig === signature) {
    if (empty) {
      empty.hidden = slots.length > 0;
    }
    return;
  }
  tracker.dataset.sig = signature;

  tracker.replaceChildren();
  if (empty) {
    empty.hidden = slots.length > 0;
  }

  slots.forEach((slot, index) => {
    const node = document.createElement('span');
    node.className = 't1-ob';
    if (slot.isExtra) {
      node.classList.add('is-extra');
    } else if (slot.isWicket) {
      node.classList.add('is-wicket');
    } else if (slot.isBoundary) {
      node.classList.add('is-boundary');
    } else if (slot.label === '●' || slot.label === '•') {
      node.classList.add('is-dot');
    } else {
      node.classList.add('is-run');
    }
    if (index === slots.length - 1) {
      node.classList.add('is-latest');
    }
    node.textContent =
      slot.label === '●' || slot.label === '•' ? '•' : slot.label;
    tracker.appendChild(node);
  });
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
    if (strike) {
      // Faint diamond immediately LEFT of runs — striker only.
      strike.hidden = !batter.onStrike;
    }
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
  if (!sub) {
    return;
  }
  let text: string | null = null;

  if (crrMode === 'chase') {
    text = formatRunsToWinLine(card) ?? vm.needOffLine;
  } else if (crrMode === 'boundaries') {
    text = vm.boundariesLine;
  } else {
    text = vm.needOffLine;
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

function clearBowlerSwapTimer(): void {
  if (bowlerSwapTimer != null) {
    window.clearTimeout(bowlerSwapTimer);
    bowlerSwapTimer = null;
  }
}

function clearBowlerLayerMotion(layer: HTMLElement): void {
  layer.classList.remove('is-slot-exit-left', 'is-slot-prep-right', 'is-slot-in');
  layer.style.transition = '';
  layer.style.opacity = '';
  layer.style.transform = '';
}

function settleBowlerSlot(
  mode: BowlerSlotMode,
  stack: HTMLElement,
  normal: HTMLElement,
  tossLine: HTMLElement,
): void {
  clearBowlerLayerMotion(normal);
  clearBowlerLayerMotion(tossLine);
  stack.classList.remove('is-swapping');

  if (mode === 'toss') {
    stack.classList.add('is-toss');
    normal.hidden = true;
    normal.setAttribute('aria-hidden', 'true');
    tossLine.hidden = false;
    tossLine.setAttribute('aria-hidden', 'false');
  } else {
    stack.classList.remove('is-toss');
    normal.hidden = false;
    normal.setAttribute('aria-hidden', 'false');
    tossLine.hidden = true;
    tossLine.setAttribute('aria-hidden', 'true');
    tossLine.textContent = '';
  }
  bowlerSlotMode = mode;
}

/**
 * Local slide+fade swap inside the bowler slot only.
 * Out ← / in → ; rapid calls cancel prior transition via bowlerSwapGen.
 */
function swapBowlerSlot(
  target: BowlerSlotMode,
  stack: HTMLElement,
  normal: HTMLElement,
  tossLine: HTMLElement,
): void {
  if (prefersReducedMotion()) {
    bowlerSwapGen += 1;
    clearBowlerSwapTimer();
    settleBowlerSlot(target, stack, normal, tossLine);
    return;
  }

  const from = bowlerSlotMode;
  bowlerSwapGen += 1;
  const gen = bowlerSwapGen;
  clearBowlerSwapTimer();
  bowlerSlotMode = target;

  const outgoing = from === 'toss' ? tossLine : normal;
  const incoming = target === 'toss' ? tossLine : normal;

  normal.hidden = false;
  tossLine.hidden = false;
  stack.classList.add('is-swapping');
  if (target === 'toss') {
    stack.classList.add('is-toss');
  } else {
    stack.classList.remove('is-toss');
  }

  clearBowlerLayerMotion(normal);
  clearBowlerLayerMotion(tossLine);

  // Prep: incoming off-canvas right (no transition), outgoing visible.
  incoming.style.transition = 'none';
  incoming.style.opacity = '0';
  incoming.style.transform = 'translateX(14px)';
  incoming.classList.add('is-slot-prep-right');
  outgoing.style.opacity = '1';
  outgoing.style.transform = 'translateX(0)';
  void stack.offsetWidth;

  incoming.style.transition = '';
  outgoing.style.transition = '';
  void stack.offsetWidth;

  // Animate: outgoing exits left; incoming settles in place.
  outgoing.classList.add('is-slot-exit-left');
  incoming.classList.remove('is-slot-prep-right');
  incoming.classList.add('is-slot-in');
  incoming.style.opacity = '';
  incoming.style.transform = '';
  incoming.setAttribute('aria-hidden', 'false');
  outgoing.setAttribute('aria-hidden', 'true');

  bowlerSwapTimer = window.setTimeout(() => {
    if (gen !== bowlerSwapGen) {
      return;
    }
    bowlerSwapTimer = null;
    settleBowlerSlot(target, stack, normal, tossLine);
  }, BOWLER_SLOT_SWAP_MS);
}

function paintBowlerFigures(vm: StripViewModel): void {
  setText('bowler-name', vm.bowlerName);
  setText('bowler-figs', vm.bowlerFigs);
  setText('bowler-overs', `(${vm.bowlerOvers} ov)`);
  renderOverTracker(vm);
}

function renderBowlerPanel(
  vm: StripViewModel,
  ctx: ScoreStripRenderParams['ctx'],
  crrMode: ScoreStripRenderParams['crrMode'],
): void {
  const stack = el<HTMLDivElement>('bowler-stack');
  const normal = el<HTMLDivElement>('bowler-normal');
  const tossLine = el<HTMLParagraphElement>('bowler-toss-line');
  if (!stack || !normal || !tossLine) {
    return;
  }

  const wantToss = crrMode === 'toss';
  const tossText = wantToss ? formatTossLine(ctx) : null;
  const target: BowlerSlotMode = wantToss && tossText ? 'toss' : 'bowler';

  paintBowlerFigures(vm);
  if (target === 'toss' && tossText && tossLine.textContent !== tossText) {
    tossLine.textContent = tossText;
  }

  // Same mode: refresh content only — never restart mid-swap or settled state.
  if (target === bowlerSlotMode) {
    if (bowlerSwapTimer == null) {
      settleBowlerSlot(target, stack, normal, tossLine);
      if (target === 'toss' && tossText) {
        tossLine.textContent = tossText;
      }
    }
    return;
  }

  if (target === 'toss' && tossText) {
    tossLine.textContent = tossText;
  }
  swapBowlerSlot(target, stack, normal, tossLine);
}

function runEntranceOnce(strip: HTMLElement): void {
  if (strip.dataset.entered === '1') {
    return;
  }
  strip.dataset.entered = '1';

  const sections = [
    ...strip.querySelectorAll<HTMLElement>('[data-strip-section]'),
  ];
  if (prefersReducedMotion() || sections.length === 0) {
    for (const s of sections) {
      s.classList.add('is-visible');
    }
    return;
  }

  strip.classList.add('is-entering');
  for (const s of sections) {
    s.classList.remove('is-visible');
  }
  sections.forEach((section, index) => {
    window.setTimeout(() => {
      section.classList.add('is-visible');
      if (index === sections.length - 1) {
        window.setTimeout(() => {
          strip.classList.remove('is-entering');
        }, 520);
      }
    }, index * ENTRANCE_STAGGER_MS);
  });
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
      const strip = el<HTMLElement>('strip');
      if (!wrap || !idle) {
        return;
      }

      if (missingMatchId) {
        wrap.hidden = true;
        idle.hidden = false;
        idle.textContent = 'Add ?matchId=… to the overlay URL';
        return;
      }

      if (conn) {
        conn.hidden = status !== 'offline' && status !== 'connecting';
        conn.textContent =
          status === 'connecting' ? 'Connecting…' : 'Reconnecting…';
      }

      if (!card) {
        if (wrap.hidden) {
          idle.hidden = false;
          idle.textContent =
            status === 'live' ? 'Waiting for live score…' : 'Connecting…';
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

      const wasHidden = wrap.hidden || hideStrip;
      idle.hidden = true;
      wrap.hidden = hideStrip;

      // Monogram shields only (reference) — batting LEFT, bowling RIGHT.
      setText('bat-initials', vm.batting.initials);
      setText('bowl-initials', vm.bowling.initials);

      setText('strip-banner', vm.inningsBanner);
      setText(
        'strip-matchup',
        `${vm.batting.name} v ${vm.bowling.name}`.toUpperCase(),
      );
      setText('team-line', vm.batting.initials);
      setText('score-line', vm.scoreLine);
      setText('overs-line', vm.oversCurrent);
      setText('rr-line', `RR ${vm.rrValue}`);

      renderBatters(vm);
      renderSubLine(vm, card, crrMode);
      renderBowlerPanel(vm, ctx, crrMode);

      if (!hideStrip && strip && (wasHidden || strip.dataset.entered !== '1')) {
        runEntranceOnce(strip);
      }
      if (hideStrip && strip) {
        strip.dataset.entered = '';
        strip.classList.remove('is-entering');
        for (const s of strip.querySelectorAll('.t1-strip-section')) {
          s.classList.remove('is-visible');
        }
      }
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
      if (!initialEl || !surnameEl || !nameRoot) {
        return;
      }

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
      const node = el<HTMLDivElement>('career-wrap');
      if (!node) {
        throw new Error('Missing #career-wrap');
      }
      return node;
    },

    revealCareerCard(): void {
      revealGraphic(el<HTMLDivElement>('career-wrap'));
    },

    hideCareerCard(onHidden: () => void, _animMs: number): void {
      concealGraphic(el<HTMLDivElement>('career-wrap'), onHidden);
    },
  };
}
