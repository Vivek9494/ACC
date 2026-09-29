import { BALL_TYPE_LABELS, BallType } from '@acc/types';

/** Tennis first, matching the mobile form. */
export const BALL_TYPE_OPTIONS = [BallType.Tennis, BallType.Leather].map((value) => ({
  value,
  label: `${BALL_TYPE_LABELS[value]} ball`,
}));

export const GEOGRAPHY_NAME_MAX = 120;
export const TOURNAMENT_TYPE_NAME_MAX = 80;

export interface TournamentTypeFormValues {
  ballType: BallType;
  name: string;
  provinceId: string | null;
  centerIds: string[];
}

export type TournamentTypeFormErrors = Partial<Record<'name' | 'provinceId' | 'centerIds', string>>;

/** Same rules as the API DTO / mobile form: name, an active province, at least one center. */
export function validateTournamentTypeForm(
  values: TournamentTypeFormValues,
): TournamentTypeFormErrors {
  const errors: TournamentTypeFormErrors = {};
  const name = values.name.trim();
  if (!name) errors.name = 'Name is required';
  else if (name.length > TOURNAMENT_TYPE_NAME_MAX)
    errors.name = `Name must be at most ${TOURNAMENT_TYPE_NAME_MAX} characters`;
  if (!values.provinceId) errors.provinceId = 'Select a province';
  if (values.centerIds.length === 0) errors.centerIds = 'Select at least one participating center';
  return errors;
}

export function validateGeographyName(name: string, label: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return `${label} name is required`;
  if (trimmed.length > GEOGRAPHY_NAME_MAX)
    return `${label} name must be at most ${GEOGRAPHY_NAME_MAX} characters`;
  return null;
}

export function toggleId(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

/** Active rows first, then by name. */
export function sortByActiveThenName<T extends { name: string; isActive: boolean }>(
  rows: readonly T[],
): T[] {
  return [...rows].sort(
    (a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name),
  );
}
