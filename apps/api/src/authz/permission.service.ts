import {
  type AuthUser,
  type GrantSubject,
  type Permission,
  PERMISSION_MATRIX,
  type PermissionContext,
  PermissionScope,
  type RoleGrant,
  SCORER_SUBJECT,
  type TournamentType,
  UserRole,
} from '@acc/types';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { activeTournamentRelationWhere } from '../tournaments/tournament-query';
import { MatchScorerGrantService } from './match-scorer.service';

/**
 * Context references pulled from the request (params/body/query) that let the
 * service resolve the {@link PermissionContext} facts from the database.
 */
export interface PermissionRefs {
  tournamentId?: string;
  teamId?: string;
  matchId?: string;
  registrationId?: string;
  /** Target Center for OWN_CENTER checks, when not derived from a registration. */
  targetCenterId?: string;
  /** Target user for SELF checks. */
  targetUserId?: string;
}

const SUSPENDED_STATUSES = ['PENDING', 'CARRIED_FORWARD'] as const;

/**
 * Evaluates the RBAC matrix (`@acc/types`) for a given action. `evaluate` is a
 * pure function of the matrix + a {@link PermissionContext}; `check` resolves
 * that context from the database for a request.
 */
@Injectable()
export class PermissionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scorerGrants: MatchScorerGrantService,
  ) {}

  /**
   * Pure matrix evaluation. Returns true iff some grant for the permission is
   * satisfied by the actor's subjects, the tournament type, and the scope facts.
   */
  evaluate(permission: Permission, ctx: PermissionContext): boolean {
    const rule = PERMISSION_MATRIX[permission];
    if (!rule) {
      return false;
    }
    // Action-level tournament-type restriction (e.g. ACC-only sections).
    if (!this.tournamentTypeAllowed(rule.tournamentTypes, ctx.tournamentType)) {
      return false;
    }
    return rule.grants.some((grant) => this.grantSatisfied(grant, ctx));
  }

  private grantSatisfied(grant: RoleGrant, ctx: PermissionContext): boolean {
    if (!ctx.subjects.includes(grant.subject)) {
      return false;
    }
    // Grant-level type restriction (e.g. Manager only in APL/Center — D1).
    if (!this.tournamentTypeAllowed(grant.tournamentTypes, ctx.tournamentType)) {
      return false;
    }
    // E1: Vice Captain inherits a captain-only action only when suspended.
    if (grant.requiresCaptainSuspended && !ctx.captainSuspended) {
      return false;
    }
    // §31 #1: Club Manager fallback only when both leaders are suspended.
    if (grant.requiresLeadersSuspended && !ctx.leadersSuspended) {
      return false;
    }
    return this.scopeSatisfied(grant.scope ?? PermissionScope.Global, ctx);
  }

  private tournamentTypeAllowed(
    allowed: TournamentType[] | undefined,
    actual: TournamentType | undefined,
  ): boolean {
    if (!allowed) {
      return true;
    }
    return actual !== undefined && allowed.includes(actual);
  }

  private scopeSatisfied(scope: PermissionScope, ctx: PermissionContext): boolean {
    switch (scope) {
      case PermissionScope.Global:
        return true;
      case PermissionScope.Organizer:
        return ctx.isOrganizer === true;
      case PermissionScope.OwnCenter:
        return ctx.sameCenter === true;
      case PermissionScope.OwnTeam:
        return ctx.sameTeam === true;
      case PermissionScope.Self:
        return ctx.isSelf === true;
      default:
        return false;
    }
  }

  /** Resolves the context from the DB for a request, then evaluates. */
  async check(permission: Permission, actor: AuthUser, refs: PermissionRefs): Promise<boolean> {
    const ctx = await this.buildContext(actor, refs);
    return this.evaluate(permission, ctx);
  }

  /**
   * Resolves the {@link PermissionContext} facts: the actor's effective subjects
   * (global role + scoped role assignments + an active Scorer grant), the
   * tournament type/organizer, and the OWN_CENTER / OWN_TEAM / SELF / captain-
   * suspended flags.
   */
  async buildContext(actor: AuthUser, refs: PermissionRefs): Promise<PermissionContext> {
    let tournamentId = refs.tournamentId;
    let teamId = refs.teamId;
    let targetCenterId = refs.targetCenterId;
    let targetUserId = refs.targetUserId;

    if (refs.registrationId) {
      const registration = await this.prisma.registration.findUnique({
        where: { id: refs.registrationId },
        select: { tournamentId: true, centerId: true, userId: true },
      });
      if (registration) {
        tournamentId ??= registration.tournamentId;
        targetCenterId ??= registration.centerId;
        targetUserId ??= registration.userId;
      }
    }

    let match: { tournamentId: string; homeTeamId: string | null; awayTeamId: string | null } | null =
      null;
    if (refs.matchId) {
      match = await this.prisma.match.findUnique({
        where: { id: refs.matchId },
        select: { tournamentId: true, homeTeamId: true, awayTeamId: true },
      });
      if (match) {
        tournamentId ??= match.tournamentId;
      }
    }

    let tournamentType: TournamentType | undefined;
    let isOrganizer = false;
    if (tournamentId) {
      const tournament = await this.prisma.tournament.findUnique({
        where: { id: tournamentId },
        select: { type: true, createdByUserId: true, isDeleted: true },
      });
      if (tournament && !tournament.isDeleted) {
        tournamentType = tournament.type as TournamentType;
        isOrganizer = tournament.createdByUserId === actor.id;
      }
    }

    // Effective subjects: the global role, plus scoped role assignments that
    // match this tournament/center context, plus the per-match Scorer grant.
    const subjects = new Set<GrantSubject>([actor.role]);
    const captainTeamIds = new Set<string>();
    const sevakCenterIds = new Set<string>();

    const assignments = await this.prisma.roleAssignment.findMany({
      where: {
        userId: actor.id,
        OR: [
          tournamentId ? { tournamentId } : undefined,
          { centerId: { not: null } },
        ].filter((clause): clause is NonNullable<typeof clause> => clause !== undefined),
      },
      select: { role: true, tournamentId: true, teamId: true, centerId: true },
    });

    for (const a of assignments) {
      if (a.role === UserRole.CenterSevak && a.centerId) {
        subjects.add(UserRole.CenterSevak);
        sevakCenterIds.add(a.centerId);
        continue;
      }
      // Team-scoped roles only count within the context tournament.
      if (a.tournamentId && a.tournamentId === tournamentId) {
        subjects.add(a.role as GrantSubject);
        if (
          a.teamId &&
          (a.role === UserRole.Captain ||
            a.role === UserRole.ViceCaptain ||
            a.role === UserRole.Manager)
        ) {
          captainTeamIds.add(a.teamId);
        }
      }
    }

    if (refs.matchId && (await this.scorerGrants.hasActiveGrant(refs.matchId, actor.id))) {
      subjects.add(SCORER_SUBJECT);
    }

    // For a match action without an explicit team, treat both sides as the
    // candidate context team (a captain matches whichever side is theirs).
    const contextTeamIds = teamId
      ? [teamId]
      : [match?.homeTeamId, match?.awayTeamId].filter((id): id is string => Boolean(id));
    let sameTeam = contextTeamIds.some((id) => captainTeamIds.has(id));
    // Tournament-level routes (no team/match param): any leadership in this tournament satisfies OwnTeam.
    if (!sameTeam && contextTeamIds.length === 0 && tournamentId && captainTeamIds.size > 0) {
      sameTeam = true;
      if (!teamId) {
        teamId = [...captainTeamIds][0];
      }
    } else if (sameTeam && !teamId) {
      teamId = contextTeamIds.find((id) => captainTeamIds.has(id));
    }

    // Rostered team members (Player role) satisfy OwnTeam for their squad — e.g. availability polls.
    if (!sameTeam && tournamentId && contextTeamIds.length > 0) {
      const membership = await this.prisma.teamMembership.findFirst({
        where: {
          userId: actor.id,
          tournamentId,
          teamId: { in: contextTeamIds },
        },
        select: { id: true },
      });
      sameTeam = membership !== null;
      if (sameTeam && !teamId) {
        teamId = contextTeamIds[0];
      }
    }

    const sameCenterFromTarget =
      targetCenterId !== undefined && sevakCenterIds.has(targetCenterId);
    let sameCenter = sameCenterFromTarget;
    if (!sameCenter && tournamentId && sevakCenterIds.size > 0) {
      const centerLink = await this.prisma.tournamentCenter.findFirst({
        where: {
          tournamentId,
          centerId: { in: [...sevakCenterIds] },
        },
        select: { centerId: true },
      });
      sameCenter = centerLink !== null;
    }
    const isSelf = targetUserId !== undefined && targetUserId === actor.id;
    const { captainSuspended, leadersSuspended } = await this.leaderSuspensionFacts(
      teamId,
      refs.matchId,
    );

    return {
      subjects: [...subjects],
      tournamentType,
      isOrganizer,
      sameCenter,
      sameTeam,
      isSelf,
      captainSuspended,
      leadersSuspended,
    };
  }

  /**
   * E1 / §31 #1: whether the context team's Captain is suspended (drives VC
   * inheritance) and whether BOTH the Captain and Vice Captain are suspended
   * (drives the Club Manager fallback). Suspension is scoped to `matchId` when
   * known.
   */
  private async leaderSuspensionFacts(
    teamId: string | undefined,
    matchId: string | undefined,
  ): Promise<{ captainSuspended: boolean; leadersSuspended: boolean }> {
    if (!teamId) {
      return { captainSuspended: false, leadersSuspended: false };
    }
    const leaders = await this.prisma.roleAssignment.findMany({
      where: { teamId, role: { in: [UserRole.Captain, UserRole.ViceCaptain] } },
      select: { userId: true, role: true },
    });
    const captainId = leaders.find((l) => l.role === UserRole.Captain)?.userId;
    const viceCaptainId = leaders.find((l) => l.role === UserRole.ViceCaptain)?.userId;

    const isSuspended = async (userId: string | undefined): Promise<boolean> => {
      if (!userId) {
        return false;
      }
      const suspension = await this.prisma.suspension.findFirst({
        where: {
          userId,
          status: { in: [...SUSPENDED_STATUSES] },
          ...(matchId ? { servingMatchId: matchId } : {}),
        },
        select: { id: true },
      });
      return suspension !== null;
    };

    const captainSuspended = await isSuspended(captainId);
    const viceCaptainSuspended = await isSuspended(viceCaptainId);
    // §31 #1 requires both leaders to actually exist and both be suspended.
    const leadersSuspended =
      captainId !== undefined &&
      viceCaptainId !== undefined &&
      captainSuspended &&
      viceCaptainSuspended;

    return { captainSuspended, leadersSuspended };
  }
}
