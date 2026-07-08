import { MatchSide } from '@acc/types';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import {
  parentProgressionUpdate,
  shouldAdvanceKnockoutWinner,
  type KnockoutProgressionFeeder,
} from './knockout-progression.compute';

@Injectable()
export class KnockoutProgressionService {
  /**
   * Advances a confirmed knockout match's winner into the parent slot, or
   * records the tournament champion when the feeder is the final.
   * Idempotent — safe when confirmation is re-fired for the same result.
   */
  async advanceWinnerOnConfirmation(
    tx: Prisma.TransactionClient,
    feeder: KnockoutProgressionFeeder,
  ): Promise<void> {
    if (!shouldAdvanceKnockoutWinner(feeder)) {
      return;
    }

    const winnerId = feeder.winningTeamId;
    if (winnerId == null) {
      return;
    }

    if (feeder.nextMatchId == null) {
      await tx.tournament.update({
        where: { id: feeder.tournamentId },
        data: { championTeamId: winnerId },
      });
      return;
    }

    if (feeder.nextMatchSlot == null) {
      return;
    }

    const parent = await tx.match.findFirst({
      where: { id: feeder.nextMatchId, isDeleted: false },
      select: {
        id: true,
        homeTeamId: true,
        awayTeamId: true,
        awaitingTeams: true,
      },
    });
    if (!parent) {
      return;
    }

    const update = parentProgressionUpdate(parent, feeder.nextMatchSlot, winnerId);
    if (!update) {
      return;
    }

    await tx.match.update({
      where: { id: parent.id },
      data: {
        homeTeamId: update.homeTeamId,
        awayTeamId: update.awayTeamId,
        awaitingTeams: update.awaitingTeams,
      },
    });
  }
}
