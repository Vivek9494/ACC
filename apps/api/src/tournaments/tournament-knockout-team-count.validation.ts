import {
  isAplTournamentType,
  KNOCKOUT_TEAM_COUNT_MESSAGES,
  validateKnockoutTeamCount,
  validateKnockoutTeamCountOnCreate,
  type TournamentType,
} from '@acc/types';
import { BadRequestException } from '@nestjs/common';

/** APL create — knockout size may be set before groups exist (floor = 2). */
export function assertKnockoutTeamCountOnCreate(
  type: TournamentType,
  numberOfTeams: number,
  knockoutTeamCount: number | null | undefined,
): void {
  if (knockoutTeamCount == null) {
    return;
  }

  if (!isAplTournamentType(type)) {
    throw new BadRequestException({
      message: KNOCKOUT_TEAM_COUNT_MESSAGES.notApl,
      error: 'KNOCKOUT_TEAM_COUNT_NOT_APL',
      fields: { knockoutTeamCount: KNOCKOUT_TEAM_COUNT_MESSAGES.notApl },
    });
  }

  const validationError = validateKnockoutTeamCountOnCreate(
    knockoutTeamCount,
    numberOfTeams,
  );
  if (validationError) {
    throw new BadRequestException({
      message: validationError,
      error: 'KNOCKOUT_TEAM_COUNT_INVALID',
      fields: { knockoutTeamCount: validationError },
    });
  }
}

export async function assertKnockoutTeamCountOnUpdate(
  type: TournamentType,
  groupCount: number,
  numberOfTeams: number,
  existingKnockoutTeamCount: number | null,
  nextKnockoutTeamCount: number | null | undefined,
  hasKnockoutBracket: boolean,
): Promise<void> {
  if (nextKnockoutTeamCount === undefined) {
    return;
  }

  if (!isAplTournamentType(type)) {
    if (nextKnockoutTeamCount != null) {
      throw new BadRequestException({
        message: KNOCKOUT_TEAM_COUNT_MESSAGES.notApl,
        error: 'KNOCKOUT_TEAM_COUNT_NOT_APL',
        fields: { knockoutTeamCount: KNOCKOUT_TEAM_COUNT_MESSAGES.notApl },
      });
    }
    return;
  }

  if (hasKnockoutBracket) {
    if (nextKnockoutTeamCount !== existingKnockoutTeamCount) {
      throw new BadRequestException({
        message: KNOCKOUT_TEAM_COUNT_MESSAGES.locked,
        error: 'KNOCKOUT_TEAM_COUNT_LOCKED',
        fields: { knockoutTeamCount: KNOCKOUT_TEAM_COUNT_MESSAGES.locked },
      });
    }
    return;
  }

  if (nextKnockoutTeamCount == null) {
    return;
  }

  const validationError = validateKnockoutTeamCount(nextKnockoutTeamCount, {
    groupCount,
    totalTeams: numberOfTeams,
  });
  if (validationError) {
    throw new BadRequestException({
      message: validationError,
      error: 'KNOCKOUT_TEAM_COUNT_INVALID',
      fields: { knockoutTeamCount: validationError },
    });
  }
}
