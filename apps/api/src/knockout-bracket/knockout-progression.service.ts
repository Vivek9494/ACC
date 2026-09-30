import { AuditEntityType, MatchSide } from '@acc/types';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';

import {
  parentProgressionUpdate,
  shouldAdvanceKnockoutWinner,
  type KnockoutProgressionFeeder,
} from './knockout-progression.compute';

@Injectable()
export class KnockoutProgressionService {
  constructor(private readonly audit: AuditService) {}

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
      await this.audit.record(
        {
          action: 'TOURNAMENT_CHAMPION_SET',
          targetEntityType: AuditEntityType.Tournament,
          targetEntityId: feeder.tournamentId,
          after: { championTeamId: winnerId },
          details: { finalMatchId: feeder.id },
        },
        tx,
      );
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
    await this.audit.record(
      {
        action: 'KNOCKOUT_WINNER_ADVANCED',
        targetEntityType: AuditEntityType.Match,
        targetEntityId: parent.id,
        before: { homeTeamId: parent.homeTeamId, awayTeamId: parent.awayTeamId },
        after: { homeTeamId: update.homeTeamId, awayTeamId: update.awayTeamId },
        details: { feederMatchId: feeder.id, winningTeamId: winnerId, slot: feeder.nextMatchSlot },
      },
      tx,
    );
  }
}
