/**
 * Values still collected off-form until those fields are added to the Add Tournament UI.
 * Leather: max 5 overs/bowler (ACC spec). Tennis: 4 (seed convention).
 */
import { BallType } from './rbac';
import { TournamentFormat } from './tournament';

export const DEFAULT_TOURNAMENT_FORMAT = TournamentFormat.LeagueSingleRoundRobin;

export function deferredMaxOversPerBowler(ballType: BallType): number {
  if (ballType === BallType.Leather) {
    return 5;
  }
  return 4;
}
