/** Sanitizes a currency text field — digits and one decimal point, max 2 fractional digits. */
export function sanitizeTournamentFeeInput(raw: string): string {
  let cleaned = raw.replace(/[^\d.]/g, '');
  const dotIndex = cleaned.indexOf('.');
  if (dotIndex === -1) {
    return cleaned;
  }
  const before = cleaned.slice(0, dotIndex + 1);
  const after = cleaned.slice(dotIndex + 1).replace(/\./g, '').slice(0, 2);
  return before + after;
}

/** Parses optional tournament fee input to a dollar amount, or null when empty. */
export function parseOptionalTournamentFee(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return Math.round(parsed * 100) / 100;
}

/** Formats a stored tournament fee for display (e.g. 250 → "$250.00"). Null when unset. */
export function formatTournamentFeeCad(amount: number | null | undefined): string | null {
  if (amount == null) {
    return null;
  }
  return `$${amount.toFixed(2)}`;
}

/** Maps a stored fee amount to form input text. */
export function tournamentFeeToInputString(amount: number | null | undefined): string {
  if (amount == null) {
    return '';
  }
  return amount % 1 === 0 ? String(amount) : amount.toFixed(2);
}
