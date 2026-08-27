import { useEffect } from 'react';
import { Platform } from 'react-native';

import { SCORING_KEYBOARD_MAP } from '../lib/scoring-keyboard-map';

export interface ScoringKeyboardShortcutHandlers {
  enabled: boolean;
  onRuns: (runs: number, isBoundary: boolean) => void;
  onWicket: () => void;
  onWide: () => void;
  onNoBall: () => void;
  onLegBye: () => void;
  onBye: () => void;
  onUndo: () => void;
  /** Bound to Enter on the Scoring keypad End Ball label only (no-op). Omit for no binding. */
  onEndBall?: () => void;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    return true;
  }
  return target.isContentEditable;
}

function keyMatches(key: string, bindings: readonly string[]): boolean {
  return bindings.some((binding) => binding === key);
}

/** Desktop keyboard scoring (web only). Bindings live in `SCORING_KEYBOARD_MAP`. */
export function useScoringKeyboardShortcuts({
  enabled,
  onRuns,
  onWicket,
  onWide,
  onNoBall,
  onLegBye,
  onBye,
  onUndo,
  onEndBall,
}: ScoringKeyboardShortcutHandlers): void {
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) {
      return;
    }

    function onKeyDown(event: KeyboardEvent): void {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (isEditableTarget(event.target)) {
        return;
      }

      const run = SCORING_KEYBOARD_MAP.runs[event.key as keyof typeof SCORING_KEYBOARD_MAP.runs];
      if (run) {
        event.preventDefault();
        onRuns(run.runs, run.isBoundary);
        return;
      }
      if (keyMatches(event.key, SCORING_KEYBOARD_MAP.wide)) {
        event.preventDefault();
        onWide();
        return;
      }
      if (keyMatches(event.key, SCORING_KEYBOARD_MAP.noBall)) {
        event.preventDefault();
        onNoBall();
        return;
      }
      if (keyMatches(event.key, SCORING_KEYBOARD_MAP.bye)) {
        event.preventDefault();
        onBye();
        return;
      }
      if (keyMatches(event.key, SCORING_KEYBOARD_MAP.legBye)) {
        event.preventDefault();
        onLegBye();
        return;
      }
      if (keyMatches(event.key, SCORING_KEYBOARD_MAP.wicket)) {
        event.preventDefault();
        onWicket();
        return;
      }
      if (keyMatches(event.key, SCORING_KEYBOARD_MAP.undo)) {
        if (!onUndo) {
          return;
        }
        event.preventDefault();
        onUndo();
        return;
      }
      if (onEndBall && keyMatches(event.key, SCORING_KEYBOARD_MAP.endBall)) {
        event.preventDefault();
        onEndBall();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, onRuns, onWicket, onWide, onNoBall, onLegBye, onBye, onUndo, onEndBall]);
}
