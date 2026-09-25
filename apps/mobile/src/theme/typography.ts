/**
 * ACC mobile type scale — single source of truth for font sizes.
 *
 * Tailwind mirrors these via `fontSize` in `tailwind.config.js`
 * (`text-caption`, `text-body`, `text-button`, `text-card-title`,
 * `text-section`, `text-screen`, `text-input`). Keep `text-xs`/`sm`/`base`/`lg`
 * aligned with caption / secondary / body / cardTitle.
 *
 * Floor: nothing readable below {@link TYPE.caption} (12), except documented
 * density exceptions in `tools/eslint-plugin-acc-typography/allowlist.mjs`.
 * Inputs: always ≥ {@link TYPE.input} (16) — avoids iOS focus auto-zoom.
 * Do **not** point input styles at {@link TYPE.body} (15).
 *
 * Guardrails: `tools/eslint-plugin-acc-typography` (sub-12 = error outside allowlist).
 */

export const TYPE = {
  /** Meta labels, chips, table headers — floor. */
  caption: 12,
  /** Supporting / secondary copy. */
  secondary: 14,
  /** Default body copy. */
  body: 15,
  /** Button labels (medium/semibold). */
  button: 15,
  /**
   * Native text-field value size. Must stay ≥16 (iOS focus auto-zoom).
   * Independent of {@link TYPE.body} / {@link TYPE.button} — never inherit 15.
   */
  input: 16,
  /** Card / list-row titles. */
  cardTitle: 16,
  /** In-screen section headings. */
  section: 18,
  /** Stack screen titles ({@link ScreenHeader}). */
  screenTitle: 20,
} as const;

export type TypeToken = keyof typeof TYPE;

/** NativeWind size utilities for each product token (not color utilities). */
export const TYPE_CLASS = {
  caption: 'text-caption',
  secondary: 'text-sm',
  body: 'text-body',
  button: 'text-button',
  input: 'text-input',
  cardTitle: 'text-card-title',
  section: 'text-section',
  screenTitle: 'text-screen',
} as const satisfies Record<TypeToken, string>;

/** StyleSheet-friendly sizes (inputs, SVG labels, etc.). */
export const TYPE_STYLE = {
  caption: { fontSize: TYPE.caption },
  secondary: { fontSize: TYPE.secondary },
  body: { fontSize: TYPE.body },
  button: { fontSize: TYPE.button },
  input: { fontSize: TYPE.input },
  cardTitle: { fontSize: TYPE.cardTitle },
  section: { fontSize: TYPE.section },
  screenTitle: { fontSize: TYPE.screenTitle },
} as const satisfies Record<TypeToken, { fontSize: number }>;
