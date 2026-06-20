/** Shared keypad + recent-ball chip colors (Live Scoring Assistant) — brand tokens only. */
export const SCORING_KEYPAD_GREY_BG = 'bg-stone-200';
export const SCORING_KEYPAD_GREY_TEXT = 'text-stone-700';

export const SCORING_KEYPAD_RUNS_BG = 'bg-surface-muted';
export const SCORING_KEYPAD_RUNS_TEXT = 'text-text';

export const SCORING_KEYPAD_FOUR_BG = 'bg-secondary';
export const SCORING_KEYPAD_FOUR_TEXT = 'text-text-inverse';

export const SCORING_KEYPAD_SIX_BG = 'bg-primary';
export const SCORING_KEYPAD_SIX_TEXT = 'text-text-inverse';

export const SCORING_KEYPAD_WICKET_BG = 'bg-secondary-900';
export const SCORING_KEYPAD_WICKET_TEXT = 'text-text-inverse';

export type RecentBallChipVariant = 'grey' | 'runs' | 'four' | 'six' | 'wicket';

export interface RecentBallChipStyle {
  label: string;
  variant: RecentBallChipVariant;
  bgClass: string;
  textClass: string;
}

const VARIANT_STYLES: Record<
  RecentBallChipVariant,
  Pick<RecentBallChipStyle, 'bgClass' | 'textClass'>
> = {
  grey: { bgClass: SCORING_KEYPAD_GREY_BG, textClass: SCORING_KEYPAD_GREY_TEXT },
  runs: { bgClass: SCORING_KEYPAD_RUNS_BG, textClass: SCORING_KEYPAD_RUNS_TEXT },
  four: { bgClass: SCORING_KEYPAD_FOUR_BG, textClass: SCORING_KEYPAD_FOUR_TEXT },
  six: { bgClass: SCORING_KEYPAD_SIX_BG, textClass: SCORING_KEYPAD_SIX_TEXT },
  wicket: { bgClass: SCORING_KEYPAD_WICKET_BG, textClass: SCORING_KEYPAD_WICKET_TEXT },
};

/** Maps an engine timeline code to a compact chip label + keypad-matched colors. */
export function recentBallChipStyle(code: string, isWicket: boolean): RecentBallChipStyle {
  if (isWicket || code === 'W') {
    return { label: 'W', variant: 'wicket', ...VARIANT_STYLES.wicket };
  }
  if (code === '·' || code === '0') {
    return { label: '.', variant: 'grey', ...VARIANT_STYLES.grey };
  }
  if (code === '4') {
    return { label: '4', variant: 'four', ...VARIANT_STYLES.four };
  }
  if (code === '6') {
    return { label: '6', variant: 'six', ...VARIANT_STYLES.six };
  }
  if (code === '1' || code === '2' || code === '3') {
    return { label: code, variant: 'runs', ...VARIANT_STYLES.runs };
  }
  if (code.startsWith('Wd')) {
    return { label: code.replace(/^Wd/, 'wd'), variant: 'grey', ...VARIANT_STYLES.grey };
  }
  if (code.startsWith('Nb')) {
    return { label: code.replace(/^Nb/, 'nb'), variant: 'grey', ...VARIANT_STYLES.grey };
  }
  if (code.startsWith('Lb')) {
    const runs = code.slice(2);
    const label = runs === '' || runs === '1' ? 'lb' : `lb+${runs}`;
    return { label, variant: 'grey', ...VARIANT_STYLES.grey };
  }
  if (/^B\d+$/.test(code)) {
    const runs = code.slice(1);
    const label = runs === '1' ? 'b' : `b+${runs}`;
    return { label, variant: 'grey', ...VARIANT_STYLES.grey };
  }
  if (code.startsWith('Pen+')) {
    return { label: code.toLowerCase(), variant: 'grey', ...VARIANT_STYLES.grey };
  }
  if (code.startsWith('Pen-')) {
    return { label: code.toLowerCase(), variant: 'grey', ...VARIANT_STYLES.grey };
  }
  if (code === 'Drop') {
    return { label: 'drop', variant: 'grey', ...VARIANT_STYLES.grey };
  }

  return { label: code, variant: 'grey', ...VARIANT_STYLES.grey };
}
