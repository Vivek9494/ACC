import { TournamentType } from './rbac';
import { MatchSchedulingFormat } from './match-scheduling-format';

/** Inputs for deciding whether a tournament may have fixture groups. */
export interface TournamentGroupsEligibility {
  type: TournamentType;
  matchSchedulingFormat: MatchSchedulingFormat | null;
  groupCount?: number;
}

/**
 * Single source of truth — used by group CRUD, Groups tab visibility, etc.
 * APL always supports groups (knockout pipeline). Other tennis formats when
 * Group Stage + Knockout is selected, or when groups already exist.
 */
export function tournamentSupportsGroups(input: TournamentGroupsEligibility): boolean {
  if (input.type === TournamentType.ACC) {
    return (input.groupCount ?? 0) > 0;
  }
  if (input.type === TournamentType.APL) {
    return true;
  }
  if (input.matchSchedulingFormat === MatchSchedulingFormat.GroupStageKnockout) {
    return true;
  }
  return (input.groupCount ?? 0) > 0;
}
