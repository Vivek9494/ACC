/** Jersey size options for equipment & gear. */
export const JerseySize = {
  XS: 'XS',
  S: 'S',
  M: 'M',
  L: 'L',
  XL: 'XL',
  XXL: 'XXL',
} as const;

export type JerseySize = (typeof JerseySize)[keyof typeof JerseySize];

export const JERSEY_SIZE_OPTIONS: readonly JerseySize[] = [
  JerseySize.XS,
  JerseySize.S,
  JerseySize.M,
  JerseySize.L,
  JerseySize.XL,
  JerseySize.XXL,
];

export function isJerseySize(value: string): value is JerseySize {
  return (JERSEY_SIZE_OPTIONS as readonly string[]).includes(value);
}
