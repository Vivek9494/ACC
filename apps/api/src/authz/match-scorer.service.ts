import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

/**
 * Manages the transient per-match Scorer grant (§2, §11.1). The grant is a
 * `MatchScorerGrant` record, not a role; an active grant (`revokedAt IS NULL`)
 * is what the permission layer checks for scoring actions, and it is
 * auto-revoked at match completion.
 */
@Injectable()
export class MatchScorerGrantService {
  constructor(private readonly prisma: PrismaService) {}

  /** True if the user currently holds an un-revoked grant for the match. */
  async hasActiveGrant(matchId: string, userId: string): Promise<boolean> {
    const grant = await this.prisma.matchScorerGrant.findFirst({
      where: { matchId, userId, revokedAt: null },
      select: { id: true },
    });
    return grant !== null;
  }

  /** Grants scoring on a match to a player (§11.1). Idempotent per active grant. */
  async grant(matchId: string, userId: string, grantedByUserId?: string): Promise<void> {
    const existing = await this.prisma.matchScorerGrant.findFirst({
      where: { matchId, userId, revokedAt: null },
      select: { id: true },
    });
    if (existing) {
      return;
    }
    await this.prisma.matchScorerGrant.create({
      data: { matchId, userId, grantedByUserId: grantedByUserId ?? null },
    });
  }

  /** Revokes a player's active grant on handover (Captain/VC) — §11.1. */
  async revoke(matchId: string, userId: string): Promise<void> {
    await this.prisma.matchScorerGrant.updateMany({
      where: { matchId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Auto-revokes every active grant for a match. Called by the System actor at
   * match completion (§2, §11.1).
   */
  async revokeAllForMatch(matchId: string): Promise<void> {
    await this.prisma.matchScorerGrant.updateMany({
      where: { matchId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
