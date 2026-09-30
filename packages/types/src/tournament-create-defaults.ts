/**
 * Values still collected off-form until those fields are added to the Add Tournament UI.
 * Leather: max 5 overs/bowler (ACC spec). Tennis: 4 (seed convention).
 */
import { BallType } from './rbac';
import { TournamentFormat } from './tournament';

export const DEFAULT_TOURNAMENT_FORMAT = TournamentFormat.LeagueSingleRoundRobin;

export const DEFAULT_MAX_OVERS_PER_BOWLER: Readonly<Record<BallType, number>> = {
  [BallType.Leather]: 5,
  [BallType.Tennis]: 4,
};

export function deferredMaxOversPerBowler(ballType: BallType): number {
  return DEFAULT_MAX_OVERS_PER_BOWLER[ballType];
}
