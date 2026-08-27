/**
 * Desktop scoring keyboard bindings — single source of truth.
 * Rebind by editing this map; the hook and keypad hints both read it.
 *
 * Mockup keys (not the phone keypad): W = wide, P = wicket.
 * Number keys commit immediately (same `recordDelivery` as a click).
 * Undo (⌫) and End Ball (⏎) bind to the Scoring keypad only — not Play Control.
 */
export const SCORING_KEYBOARD_MAP = {
  runs: {
    '0': { runs: 0, isBoundary: false },
    '1': { runs: 1, isBoundary: false },
    '2': { runs: 2, isBoundary: false },
    '3': { runs: 3, isBoundary: false },
    '4': { runs: 4, isBoundary: true },
    '6': { runs: 6, isBoundary: true },
  },
  wide: ['w', 'W'],
  noBall: ['n', 'N'],
  bye: ['b', 'B'],
  legBye: ['l', 'L'],
  wicket: ['p', 'P'],
  undo: ['Backspace'],
  endBall: ['Enter'],
} as const;

export type ScoringKeyboardRunBinding =
  (typeof SCORING_KEYBOARD_MAP.runs)[keyof typeof SCORING_KEYBOARD_MAP.runs];

export function hintForRunsKey(runs: 0 | 1 | 2 | 3 | 4 | 6): string {
  return String(runs);
}

export const SCORING_KEY_HINTS = {
  wide: 'W',
  noBall: 'N',
  bye: 'B',
  legBye: 'L',
  wicket: 'P',
  undo: '⌫',
  endBall: '⏎',
} as const;
