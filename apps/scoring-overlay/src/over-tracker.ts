/**
 * Derive this-over ball markers from recentOvers / timeline.
 * Same rule as cockpit Play Control "This Over":
 * - Show every delivery in the current over in order (legal + wd/nb interleaved).
 * - Wides/no-balls add a circle but do not count toward the 6 legal balls
 *   (oversText / legalBalls advance separately on the scorecard).
 * Not padded to a fixed 6 slots.
 */

import type { InningsScorecard } from './types';

export type OverBallSlot = {
  /** Display glyph: W, ●, 1–6, 2wd, nb, b1, lb2, etc. */
  label: string;
  isWicket: boolean;
  isBoundary: boolean;
  isExtra: boolean;
};

export interface CurrentOverTracker {
  /** Every delivery this over, in order — variable length. */
  slots: OverBallSlot[];
}

function isWicketCode(code: string): boolean {
  const c = code.trim();
  return c === 'W' || c.endsWith('+W');
}

function isExtraCode(code: string): boolean {
  const c = code.trim();
  if (isWicketCode(c)) return false;
  return (
    c === 'Wd' ||
    c.startsWith('Wd') ||
    c === 'Nb' ||
    c.startsWith('Nb') ||
    c.includes('+Nb') ||
    c.endsWith('Nb') ||
    /^B\d+$/i.test(c) ||
    /^Lb\d+$/i.test(c)
  );
}

function isMetadataCode(code: string): boolean {
  const c = code.trim();
  return (
    c === 'RH' ||
    c === 'Drop' ||
    c === 'IMP' ||
    c === 'End' ||
    c === 'Mk' ||
    c.startsWith('pen')
  );
}

function legalDisplay(code: string): Omit<OverBallSlot, 'isExtra'> {
  const c = code.trim();
  if (isWicketCode(c)) {
    return { label: c, isWicket: true, isBoundary: false };
  }
  if (c === '·' || c === '.' || c === '0') {
    return { label: '●', isWicket: false, isBoundary: false };
  }
  if (c === '4' || c === '6') {
    return { label: c, isWicket: false, isBoundary: true };
  }
  if (/^[1-6]$/.test(c)) {
    return { label: c, isWicket: false, isBoundary: c === '4' || c === '6' };
  }
  return { label: c.slice(0, 3) || '●', isWicket: false, isBoundary: false };
}

function extraDisplay(code: string): OverBallSlot {
  const c = code.trim();

  const bye = /^B(\d+)$/i.exec(c);
  if (bye) {
    const n = bye[1] ?? '0';
    return {
      label: n === '0' || n === '1' ? 'b' : `b${n}`,
      isWicket: false,
      isBoundary: false,
      isExtra: true,
    };
  }

  const lb = /^Lb(\d+)$/i.exec(c);
  if (lb) {
    const n = lb[1] ?? '0';
    return {
      label: n === '0' || n === '1' ? 'lb' : `lb${n}`,
      isWicket: false,
      isBoundary: false,
      isExtra: true,
    };
  }

  // Wd / Wd+2 / 2Wd-style — preserve counted extras when present.
  if (c === 'Wd' || c.startsWith('Wd')) {
    const plus = /^Wd\+(\d+)$/i.exec(c);
    if (plus && plus[1] && plus[1] !== '0') {
      return {
        label: `${plus[1]}wd`,
        isWicket: false,
        isBoundary: false,
        isExtra: true,
      };
    }
    return { label: 'wd', isWicket: false, isBoundary: false, isExtra: true };
  }

  if (c.includes('Nb') || c.startsWith('Nb')) {
    const leading = /^(\d+)[Bb]?\+?Nb/i.exec(c);
    const plus = /^Nb\+(\d+)$/i.exec(c);
    if (leading && leading[1] && leading[1] !== '0') {
      return {
        label: `${leading[1]}nb`,
        isWicket: false,
        isBoundary: false,
        isExtra: true,
      };
    }
    if (plus && plus[1] && plus[1] !== '0') {
      return {
        label: `${plus[1]}nb`,
        isWicket: false,
        isBoundary: false,
        isExtra: true,
      };
    }
    return { label: 'nb', isWicket: false, isBoundary: false, isExtra: true };
  }

  return {
    label: c.slice(0, 3).toLowerCase() || 'ex',
    isWicket: false,
    isBoundary: false,
    isExtra: true,
  };
}

function currentOverCodes(innings: InningsScorecard): string[] {
  const recent = innings.recentOvers;
  if (recent && recent.length > 0) {
    return recent[recent.length - 1]?.balls ?? [];
  }
  const timeline = innings.timeline ?? [];
  if (timeline.length === 0) {
    return [];
  }
  let maxOver: number | null = null;
  for (const entry of timeline) {
    if (entry.overNumber != null) {
      maxOver = maxOver == null ? entry.overNumber : Math.max(maxOver, entry.overNumber);
    }
  }
  if (maxOver == null) {
    return [];
  }
  return timeline
    .filter((e) => e.overNumber === maxOver)
    .map((e) => e.code);
}

export function buildCurrentOverTracker(
  innings: InningsScorecard,
): CurrentOverTracker {
  const codes = currentOverCodes(innings);
  const slots: OverBallSlot[] = [];

  for (const code of codes) {
    if (!code || isMetadataCode(code)) {
      continue;
    }
    if (isExtraCode(code)) {
      slots.push(extraDisplay(code));
      continue;
    }
    const { label, isWicket, isBoundary } = legalDisplay(code);
    slots.push({ label, isWicket, isBoundary, isExtra: false });
  }

  return { slots };
}
