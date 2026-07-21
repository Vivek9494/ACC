import type { BallType } from './rbac';

/** Stable catalog code for the Ontario APL type definition. */
export const APL_TOURNAMENT_TYPE_CODE = 'APL';

/** Summary row for Admin Geography / type list. */
export interface TournamentTypeDefinitionSummary {
  id: string;
  code: string;
  name: string;
  provinceId: string;
  provinceName: string;
  ballType: BallType;
  centerCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Full Admin detail including participating centers. */
export interface TournamentTypeDefinitionDetail extends TournamentTypeDefinitionSummary {
  centerIds: string[];
  centerNames: string[];
  /** Reserved future format/bracket config — unused for now. */
  formatConfig: unknown | null;
}

/**
 * Create-tournament catalog row — types for a province (with center ids for
 * linking). Readable by any authenticated tournament creator.
 */
export interface TournamentTypeDefinitionCatalogEntry {
  id: string;
  code: string;
  name: string;
  provinceId: string;
  ballType: BallType;
  centerIds: string[];
}

export interface CreateTournamentTypeDefinitionRequest {
  name: string;
  /** Optional; defaults to a slug of `name` (e.g. "APL" → "APL"). */
  code?: string;
  provinceId: string;
  ballType: BallType;
  centerIds: string[];
  formatConfig?: unknown | null;
}

export interface UpdateTournamentTypeDefinitionRequest {
  name?: string;
  provinceId?: string;
  ballType?: BallType;
  centerIds?: string[];
  formatConfig?: unknown | null;
}

/** Normalize a display name into a stable uppercase code. */
export function tournamentTypeDefinitionCodeFromName(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
