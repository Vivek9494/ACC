import {
  combineCareerBowlingWithLive,
  formatStat,
  matchBoundaryTotals,
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
const BOWLER_SLOT_FLIP_MS = 400;
const warnedMissing = new Set<string>();

type BowlerSlotMode = 'bowler' | 'toss' | 'chase' | 'boundaries';

let bowlerSlotMode: BowlerSlotMode = 'bowler';
let bowlerFlipGen = 0;
let bowlerFlipTimer: number | null = null;

const FACE_CLASS: Record<BowlerSlotMode, string> = {
  bowler: 'is-face-bowler',
  toss: 'is-face-toss',
  chase: 'is-face-chase',
  boundaries: 'is-face-boundaries',
};

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
    const empty = !batter.name.trim() || batter.name.trim() === '—';
    setText(`batter-${i}-name`, batter.name || '—');
    setText(`batter-${i}-runs`, empty ? '—' : batter.runs || '0');
    setText(`batter-${i}-balls`, empty ? '—' : batter.balls || '0');
  }
}

function renderSubLine(
  vm: StripViewModel,
  crrMode: ScoreStripRenderParams['crrMode'],
): void {
  const sub = el<HTMLDivElement>('sub-line');
  if (!sub) {
    return;
  }
  // Operator toss / chase / boundaries live in the bowler-slot flip — not the sub-line.
  const text =
    crrMode === 'chase' || crrMode === 'toss' || crrMode === 'boundaries'
      ? null
      : vm.needOffLine;

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

function clearBowlerFlipTimer(): void {
  if (bowlerFlipTimer != null) {
    window.clearTimeout(bowlerFlipTimer);
    bowlerFlipTimer = null;
  }
}

function bowlerFlipEl(): HTMLElement | null {
  return el<HTMLElement>('bowler-flip');
}

function setFlipFaceClass(flip: HTMLElement, mode: BowlerSlotMode): void {
  flip.classList.remove(
    'is-face-bowler',
    'is-face-toss',
    'is-face-chase',
    'is-face-boundaries',
  );
  flip.classList.add(FACE_CLASS[mode]);
}

function applyStackModeClass(stack: HTMLElement, mode: BowlerSlotMode): void {
  stack.classList.toggle('is-toss', mode === 'toss');
  stack.classList.toggle('is-chase', mode === 'chase');
  stack.classList.toggle('is-boundaries', mode === 'boundaries');
}

/** Snap to a face with no animation (settle / reduced-motion / cancel). */
function settleBowlerSlot(
  mode: BowlerSlotMode,
  stack: HTMLElement,
  normal: HTMLElement,
  tossLine: HTMLElement,
  chaseLine: HTMLElement,
  boundariesFace: HTMLElement,
): void {
  const flip = bowlerFlipEl();
  stack.classList.remove('is-flipping');
  applyStackModeClass(stack, mode);
  if (flip) {
    flip.style.transition = 'none';
    setFlipFaceClass(flip, mode);
    void flip.offsetWidth;
    flip.style.transition = '';
  }

  normal.hidden = false;
  normal.setAttribute('aria-hidden', mode === 'bowler' ? 'false' : 'true');

  if (mode === 'toss') {
    tossLine.hidden = false;
    tossLine.setAttribute('aria-hidden', 'false');
    chaseLine.hidden = true;
    chaseLine.setAttribute('aria-hidden', 'true');
    chaseLine.textContent = '';
    boundariesFace.hidden = true;
    boundariesFace.setAttribute('aria-hidden', 'true');
  } else if (mode === 'chase') {
    chaseLine.hidden = false;
    chaseLine.setAttribute('aria-hidden', 'false');
    tossLine.hidden = true;
    tossLine.setAttribute('aria-hidden', 'true');
    tossLine.textContent = '';
    boundariesFace.hidden = true;
    boundariesFace.setAttribute('aria-hidden', 'true');
  } else if (mode === 'boundaries') {
    boundariesFace.hidden = false;
    boundariesFace.setAttribute('aria-hidden', 'false');
    tossLine.hidden = true;
    tossLine.setAttribute('aria-hidden', 'true');
    tossLine.textContent = '';
    chaseLine.hidden = true;
    chaseLine.setAttribute('aria-hidden', 'true');
    chaseLine.textContent = '';
  } else {
    tossLine.hidden = true;
    tossLine.setAttribute('aria-hidden', 'true');
    tossLine.textContent = '';
    chaseLine.hidden = true;
    chaseLine.setAttribute('aria-hidden', 'true');
    chaseLine.textContent = '';
    boundariesFace.hidden = true;
    boundariesFace.setAttribute('aria-hidden', 'true');
  }
  bowlerSlotMode = mode;
}

/**
 * Vertical rotateX flip among bowler / toss / chase / boundaries.
 * One state machine — direct overlay↔overlay; gen cancels rapid toggles.
 */
function flipBowlerSlot(
  target: BowlerSlotMode,
  stack: HTMLElement,
  normal: HTMLElement,
  tossLine: HTMLElement,
  chaseLine: HTMLElement,
  boundariesFace: HTMLElement,
): void {
  const flip = bowlerFlipEl();
  if (!flip) {
    settleBowlerSlot(target, stack, normal, tossLine, chaseLine, boundariesFace);
    return;
  }

  if (prefersReducedMotion()) {
    bowlerFlipGen += 1;
    clearBowlerFlipTimer();
    settleBowlerSlot(target, stack, normal, tossLine, chaseLine, boundariesFace);
    return;
  }

  bowlerFlipGen += 1;
  const gen = bowlerFlipGen;
  clearBowlerFlipTimer();
  bowlerSlotMode = target;

  // All faces in the tree mid-flip for backface-visibility.
  normal.hidden = false;
  tossLine.hidden = false;
  chaseLine.hidden = false;
  boundariesFace.hidden = false;
  stack.classList.add('is-flipping');
  applyStackModeClass(stack, target);

  flip.style.transition = '';
  void flip.offsetWidth;
  setFlipFaceClass(flip, target);

  normal.setAttribute('aria-hidden', target === 'bowler' ? 'false' : 'true');
  tossLine.setAttribute('aria-hidden', target === 'toss' ? 'false' : 'true');
  chaseLine.setAttribute('aria-hidden', target === 'chase' ? 'false' : 'true');
  boundariesFace.setAttribute(
    'aria-hidden',
    target === 'boundaries' ? 'false' : 'true',
  );

  bowlerFlipTimer = window.setTimeout(() => {
    if (gen !== bowlerFlipGen) {
      return;
    }
    bowlerFlipTimer = null;
    settleBowlerSlot(target, stack, normal, tossLine, chaseLine, boundariesFace);
  }, BOWLER_SLOT_FLIP_MS);
}

function paintBowlerFigures(vm: StripViewModel): void {
  setText('bowler-name', vm.bowlerName);
  setText('bowler-figs', vm.bowlerFigs);
  setText('bowler-overs', `(${vm.bowlerOvers} ov)`);
  renderOverTracker(vm);
}

function paintBoundariesFace(
  totals: { fours: number; sixes: number } | null | undefined,
): void {
  setText('bowler-bound-fours', String(Math.max(0, totals?.fours ?? 0)));
  setText('bowler-bound-sixes', String(Math.max(0, totals?.sixes ?? 0)));
}

function resolveBowlerSlotTarget(
  crrMode: ScoreStripRenderParams['crrMode'],
  ctx: ScoreStripRenderParams['ctx'],
  card: ScorecardResponse,
): {
  target: BowlerSlotMode;
  tossText: string | null;
  chaseText: string | null;
} {
  if (crrMode === 'toss') {
    const tossText = formatTossLine(ctx);
    if (tossText) {
      return { target: 'toss', tossText, chaseText: null };
    }
  }
  if (crrMode === 'chase') {
    const chaseText = formatRunsToWinLine(card) ?? null;
    if (chaseText) {
      return { target: 'chase', tossText: null, chaseText };
    }
  }
  if (crrMode === 'boundaries') {
    return { target: 'boundaries', tossText: null, chaseText: null };
  }
  return { target: 'bowler', tossText: null, chaseText: null };
}

function renderBowlerPanel(
  vm: StripViewModel,
  ctx: ScoreStripRenderParams['ctx'],
  card: ScorecardResponse,
  crrMode: ScoreStripRenderParams['crrMode'],
): void {
  const stack = el<HTMLDivElement>('bowler-stack');
  const normal = el<HTMLDivElement>('bowler-normal');
  const tossLine = el<HTMLParagraphElement>('bowler-toss-line');
  const chaseLine = el<HTMLParagraphElement>('bowler-chase-line');
  const boundariesFace = el<HTMLDivElement>('bowler-boundaries');
  if (!stack || !normal || !tossLine || !chaseLine || !boundariesFace) {
    return;
  }

  const { target, tossText, chaseText } = resolveBowlerSlotTarget(
    crrMode,
    ctx,
    card,
  );

  paintBowlerFigures(vm);
  paintBoundariesFace(matchBoundaryTotals(card));
  if (tossText && tossLine.textContent !== tossText) {
    tossLine.textContent = tossText;
  }
  if (chaseText && chaseLine.textContent !== chaseText) {
    chaseLine.textContent = chaseText;
  }

  if (target === bowlerSlotMode) {
    if (bowlerFlipTimer == null) {
      if (target === 'toss' && tossText) {
        tossLine.textContent = tossText;
      }
      if (target === 'chase' && chaseText) {
        chaseLine.textContent = chaseText;
      }
    }
    return;
  }

  flipBowlerSlot(target, stack, normal, tossLine, chaseLine, boundariesFace);
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
      renderSubLine(vm, crrMode);
      renderBowlerPanel(vm, ctx, card, crrMode);

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
