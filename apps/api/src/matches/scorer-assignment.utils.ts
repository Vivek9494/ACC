import { TournamentType } from '@acc/types';

/** ACC league fixture with two registered system teams (not vs external opponent). */
export function isAccVsAccMatch(match: {
  tournament: { type: string };
  homeTeamId: string | null;
  awayTeamId: string | null;
}): boolean {
  return (
    match.tournament.type === TournamentType.ACC &&
    match.homeTeamId != null &&
    match.awayTeamId != null
  );
}

type ActiveScorerGrant = {
  grantedByUserId: string | null;
};

/**
 * Whether the actor should see the captain scorer-assignment dashboard card (§11.1).
 * Unassigned: any captain/organizer with assign permission (ACC-vs-ACC → both captains).
 * Assigned: only the captain who created the active grant (Switch Scorer).
 */
export function canShowScorerAssignmentCard(
  actorId: string,
  activeGrant: ActiveScorerGrant | null,
): boolean {
  if (!activeGrant) {
    return true;
  }
  return activeGrant.grantedByUserId === actorId;
}
