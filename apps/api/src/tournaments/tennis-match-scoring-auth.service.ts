import {
  BallType,
  NO_MATCH_SCORER_ASSIGNED_ERROR,
  NO_MATCH_SCORER_ASSIGNED_MESSAGE,
  UserRole,
  type AuthUser,
} from '@acc/types';
import { ForbiddenException, Injectable } from '@nestjs/common';

import { MatchScorerGrantService } from '../authz/match-scorer.service';
import { PrismaService } from '../prisma/prisma.service';
import { TournamentScorersService } from './tournament-scorers.service';

/**
 * Tennis-only scoring session entry (Phase 2). Checked once when the scorer opens
 * the live scoring screen — not on every ball. Leather matches keep the existing
 * SCORE_BALL matrix (Scorer grant + Captain/VC on own team).
 */
@Injectable()
export class TennisMatchScoringAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scorerGrants: MatchScorerGrantService,
    private readonly tournamentScorers: TournamentScorersService,
  ) {}

  /** No-op for leather; tennis requires Admin or the assigned match scorer grant. */
  async assertCanEnterScoringSession(actor: AuthUser, matchId: string): Promise<void> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: {
        tournament: { select: { ballType: true } },
      },
    });
    if (!match || match.tournament.ballType !== BallType.Tennis) {
      return;
    }

    if (actor.role === UserRole.Admin) {
      return;
    }

    const activeGrant = await this.scorerGrants.getActiveGrant(matchId);
    if (!activeGrant) {
      throw new ForbiddenException({
        message: NO_MATCH_SCORER_ASSIGNED_MESSAGE,
        error: NO_MATCH_SCORER_ASSIGNED_ERROR,
      });
    }

    if (activeGrant.userId !== actor.id) {
      throw new ForbiddenException({
        message: 'Only the assigned match scorer may score this match',
        error: 'FORBIDDEN',
      });
    }
  }

  /**
   * Tennis toss capture (Phase 2): Admin, tournament organizers, or the single
   * assigned match scorer. Leather uses the RECORD_TOSS permission matrix instead.
   */
  async assertCanRecordToss(actor: AuthUser, matchId: string): Promise<void> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: { tournamentId: true, tournament: { select: { ballType: true } } },
    });
    if (!match || match.tournament.ballType !== BallType.Tennis) {
      return;
    }

    if (actor.role === UserRole.Admin) {
      return;
    }

    if (await this.tournamentScorers.viewerCanManageScorers(actor, match.tournamentId)) {
      return;
    }

    const activeGrant = await this.scorerGrants.getActiveGrant(matchId);
    if (!activeGrant || activeGrant.userId !== actor.id) {
      throw new ForbiddenException({
        message: 'Only the assigned match scorer may record the toss for this match',
        error: 'FORBIDDEN',
      });
    }
  }
}
