import { BallType, TournamentType } from './rbac';
import { MatchSchedulingFormat } from './match-scheduling-format';

/** Inputs for deciding whether a tournament may have fixture groups. */
export interface TournamentGroupsEligibility {
  type: TournamentType;
  matchSchedulingFormat: MatchSchedulingFormat | null;
  groupCount?: number;
}

/**
 * Single source of truth for an active group stage — used by group CRUD, group pickers and
 * filters. True for Group Stage + Knockout (tennis), or whenever groups already exist.
 */
export function tournamentSupportsGroups(input: TournamentGroupsEligibility): boolean {
  if ((input.groupCount ?? 0) > 0) {
    return true;
  }
  if (input.type === TournamentType.ACC) {
    return false;
  }
  return input.matchSchedulingFormat === MatchSchedulingFormat.GroupStageKnockout;
}

/**
 * Groups tab: an active group stage, or a tennis tournament whose format is not finalized yet —
 * creating the first group there finalizes Group Stage + Knockout. Never Leather.
 */
export function shouldShowGroupsTab(
  input: TournamentGroupsEligibility & { ballType: BallType },
): boolean {
  if (input.ballType !== BallType.Tennis) {
    return false;
  }
  return tournamentSupportsGroups(input) || input.matchSchedulingFormat == null;
}
