import { MatchSide } from '@acc/types';

export interface KnockoutProgressionFeeder {
  id: string;
  tournamentId: string;
  bracketId: string | null;
  isDeleted: boolean;
  winningTeamId: string | null;
  isNoResult: boolean;
  nextMatchId: string | null;
  nextMatchSlot: MatchSide | null;
}

export interface KnockoutProgressionParent {
  id: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  awaitingTeams: boolean;
}

export function shouldAdvanceKnockoutWinner(feeder: KnockoutProgressionFeeder): boolean {
  if (feeder.isDeleted || feeder.bracketId == null) {
    return false;
  }
  if (feeder.winningTeamId == null || feeder.isNoResult) {
    return false;
  }
  return true;
}

export function parentSlotUpdateForWinner(
  parent: Pick<KnockoutProgressionParent, 'homeTeamId' | 'awayTeamId'>,
  slot: MatchSide,
  winnerId: string,
): Pick<KnockoutProgressionParent, 'homeTeamId' | 'awayTeamId'> {
  if (slot === MatchSide.TeamA) {
    return {
      homeTeamId: winnerId,
      awayTeamId: parent.awayTeamId,
    };
  }
  return {
    homeTeamId: parent.homeTeamId,
    awayTeamId: winnerId,
  };
}

export function knockoutParentAwaitingTeams(
  homeTeamId: string | null,
  awayTeamId: string | null,
): boolean {
  return !(homeTeamId != null && awayTeamId != null);
}

export function parentProgressionUpdate(
  parent: KnockoutProgressionParent,
  slot: MatchSide,
  winnerId: string,
): KnockoutProgressionParent | null {
  const slots = parentSlotUpdateForWinner(parent, slot, winnerId);
  const awaitingTeams = knockoutParentAwaitingTeams(slots.homeTeamId, slots.awayTeamId);

  if (
    parent.homeTeamId === slots.homeTeamId &&
    parent.awayTeamId === slots.awayTeamId &&
    parent.awaitingTeams === awaitingTeams
  ) {
    return null;
  }

  return {
    id: parent.id,
    homeTeamId: slots.homeTeamId,
    awayTeamId: slots.awayTeamId,
    awaitingTeams,
  };
}
