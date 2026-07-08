import {
  KNOCKOUT_BRACKET_MESSAGES,
  KNOCKOUT_TOUCHED_MATCH_STATES,
  type MatchState,
} from '@acc/types';
import { BadRequestException } from '@nestjs/common';

import type { PrismaService } from '../prisma/prisma.service';
import type { ScorecardReader } from '../scoring/scorecard-reader';

/**
 * Blocks post-confirm scorecard corrections that would change a knockout
 * winner when the downstream feeder slot is already scheduled or played.
 */
export async function assertKnockoutPostConfirmEditAllowed(
  prisma: PrismaService,
  reader: ScorecardReader,
  matchId: string,
): Promise<void> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      bracketId: true,
      isDeleted: true,
      confirmedAt: true,
      winningTeamId: true,
      nextMatchId: true,
    },
  });

  if (!match?.bracketId || match.isDeleted || match.confirmedAt == null) {
    return;
  }

  const card = await reader.byMatchId(matchId);
  const newWinnerId = card.result.winningTeamId;
  if (newWinnerId === match.winningTeamId) {
    return;
  }

  if (match.nextMatchId == null) {
    return;
  }

  const downstream = await prisma.match.findFirst({
    where: {
      id: match.nextMatchId,
      isDeleted: false,
    },
    select: {
      state: true,
      confirmedAt: true,
      _count: { select: { innings: true } },
    },
  });

  if (!downstream) {
    return;
  }

  const downstreamTouched =
    downstream.confirmedAt != null ||
    downstream._count.innings > 0 ||
    (KNOCKOUT_TOUCHED_MATCH_STATES as readonly string[]).includes(downstream.state);

  if (downstreamTouched) {
    throw new BadRequestException({
      message: KNOCKOUT_BRACKET_MESSAGES.correctionBlocked,
      error: 'KNOCKOUT_CORRECTION_BLOCKED',
    });
  }
}

/** @internal exported for unit tests */
export function isKnockoutMatchTouchedForCorrection(state: MatchState): boolean {
  return (KNOCKOUT_TOUCHED_MATCH_STATES as readonly MatchState[]).includes(state);
}
