/** Canadian postal code: A1A 1A1 (optional space). */
export const CANADIAN_POSTAL_CODE_REGEX = /^[A-Za-z]\d[A-Za-z][ ]?\d[A-Za-z]\d$/;

export const INVALID_POSTAL_CODE_MESSAGE = 'Enter a valid postal code';

/** Max alphanumeric characters (space is presentational only). */
export const CANADIAN_POSTAL_CODE_MAX_RAW_LENGTH = 6;

/** Max displayed characters including the single space after the third character. */
export const CANADIAN_POSTAL_CODE_DISPLAY_MAX_LENGTH = 7;

export function isValidCanadianPostalCode(value: string): boolean {
  return CANADIAN_POSTAL_CODE_REGEX.test(value.trim());
}

/** Strip non-alphanumerics, uppercase, cap at six characters. */
export function extractCanadianPostalCodeRaw(input: string): string {
  return input
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
    .slice(0, CANADIAN_POSTAL_CODE_MAX_RAW_LENGTH);
}

/** Format raw alphanumeric input for display (e.g. "K1A0B1" -> "K1A 0B1"). */
export function formatCanadianPostalCodeDisplay(raw: string): string {
  const compact = extractCanadianPostalCodeRaw(raw);
  if (compact.length <= 3) {
    return compact;
  }
  return `${compact.slice(0, 3)} ${compact.slice(3)}`;
}

/** Live input handler: re-derive display from raw alphanumerics on every change. */
export function formatCanadianPostalCodeInput(input: string): string {
  return formatCanadianPostalCodeDisplay(input);
}

/** Uppercase with a single space after the third character (e.g. "k1a0b1" -> "K1A 0B1"). */
export function normalizeCanadianPostalCode(value: string): string {
  return formatCanadianPostalCodeDisplay(value);
}
