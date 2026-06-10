import 'reflect-metadata';

import {
  type AuthUser,
  Permission,
  type PermissionContext,
  TournamentType,
  UserRole,
} from '@acc/types';
import { Test } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';
import { MatchScorerGrantService } from './match-scorer.service';
import { PermissionService } from './permission.service';

describe('PermissionService', () => {
  let service: PermissionService;
  let prisma: {
    registration: { findUnique: jest.Mock };
    match: { findUnique: jest.Mock };
    tournament: { findUnique: jest.Mock };
    tournamentCenter: { findFirst: jest.Mock };
    roleAssignment: { findMany: jest.Mock; findFirst: jest.Mock };
    suspension: { findFirst: jest.Mock };
  };
  let scorerGrants: { hasActiveGrant: jest.Mock };

  beforeEach(async () => {
    prisma = {
      registration: { findUnique: jest.fn() },
      match: { findUnique: jest.fn() },
      tournament: { findUnique: jest.fn() },
      tournamentCenter: { findFirst: jest.fn().mockResolvedValue(null) },
      roleAssignment: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn() },
      suspension: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    scorerGrants = { hasActiveGrant: jest.fn().mockResolvedValue(false) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PermissionService,
        { provide: PrismaService, useValue: prisma },
        { provide: MatchScorerGrantService, useValue: scorerGrants },
      ],
    }).compile();

    service = moduleRef.get(PermissionService);
  });

  const ctx = (overrides: Partial<PermissionContext>): PermissionContext => ({
    subjects: [],
    ...overrides,
  });

  describe('Center Sevak registration approval is scoped to own Center (§7.4, C1)', () => {
    it('denies approving a registration from another Center', () => {
      const result = service.evaluate(
        Permission.APPROVE_REGISTRATION,
        ctx({ subjects: [UserRole.CenterSevak], tournamentType: TournamentType.APL, sameCenter: false }),
      );
      expect(result).toBe(false);
    });

    it('allows approving a registration from their own Center', () => {
      const result = service.evaluate(
        Permission.APPROVE_REGISTRATION,
        ctx({ subjects: [UserRole.CenterSevak], tournamentType: TournamentType.APL, sameCenter: true }),
      );
      expect(result).toBe(true);
    });
  });

  describe('Scorecard confirmation is Captain/VC only (§13.1)', () => {
    it('denies a Player confirming a scorecard', () => {
      const result = service.evaluate(
        Permission.CONFIRM_SCORECARD,
        ctx({ subjects: [UserRole.Player], sameTeam: true }),
      );
      expect(result).toBe(false);
    });

    it('allows a Captain of the team to confirm', () => {
      const result = service.evaluate(
        Permission.CONFIRM_SCORECARD,
        ctx({ subjects: [UserRole.Captain], sameTeam: true }),
      );
      expect(result).toBe(true);
    });
  });

  describe('Manager does not exist in ACC (§2, D1)', () => {
    it('returns false for a Manager permission in an ACC tournament', () => {
      const result = service.evaluate(
        Permission.ADD_PLAYER_TO_TEAM,
        ctx({ subjects: [UserRole.Manager], tournamentType: TournamentType.ACC, sameTeam: true }),
      );
      expect(result).toBe(false);
    });

    it('grants the same Manager permission in an APL tournament', () => {
      const result = service.evaluate(
        Permission.ADD_PLAYER_TO_TEAM,
        ctx({ subjects: [UserRole.Manager], tournamentType: TournamentType.APL, sameTeam: true }),
      );
      expect(result).toBe(true);
    });
  });

  describe('Vice Captain inheritance while Captain is suspended (E1)', () => {
    it('denies Playing 11 selection when the Captain is not suspended', () => {
      const result = service.evaluate(
        Permission.SELECT_PLAYING_11,
        ctx({ subjects: [UserRole.ViceCaptain], tournamentType: TournamentType.ACC, sameTeam: true, captainSuspended: false }),
      );
      expect(result).toBe(false);
    });

    it('allows Playing 11 selection when the Captain is suspended', () => {
      const result = service.evaluate(
        Permission.SELECT_PLAYING_11,
        ctx({ subjects: [UserRole.ViceCaptain], tournamentType: TournamentType.ACC, sameTeam: true, captainSuspended: true }),
      );
      expect(result).toBe(true);
    });
  });

  describe('Club Manager assumes captaincy when both leaders are suspended (§31 #1)', () => {
    it('grants Playing 11 selection to a Club Manager when both leaders are suspended', () => {
      const result = service.evaluate(
        Permission.SELECT_PLAYING_11,
        ctx({ subjects: [UserRole.ClubManager], tournamentType: TournamentType.ACC, leadersSuspended: true }),
      );
      expect(result).toBe(true);
    });

    it('denies a Club Manager Playing 11 selection when the leaders are available', () => {
      const result = service.evaluate(
        Permission.SELECT_PLAYING_11,
        ctx({ subjects: [UserRole.ClubManager], tournamentType: TournamentType.ACC, leadersSuspended: false }),
      );
      expect(result).toBe(false);
    });
  });

  describe('per-match Scorer grant (§11.1)', () => {
    it('allows scoring a ball with an active Scorer grant', () => {
      const result = service.evaluate(Permission.SCORE_BALL, ctx({ subjects: ['SCORER'] }));
      expect(result).toBe(true);
    });

    it('denies scoring a ball to a plain Player', () => {
      const result = service.evaluate(Permission.SCORE_BALL, ctx({ subjects: [UserRole.Player] }));
      expect(result).toBe(false);
    });
  });

  describe('check() resolves Center scope from the database', () => {
    const actor: AuthUser = {
      id: 'sevak-1',
      firstName: 'C',
      lastName: 'S',
      mobileNumber: '+15555550900',
      email: 'cs@acc.local',
      centerId: 'center-A',
      jerseyNumber: 0,
      profilePhotoUrl: null,
      role: UserRole.Player,
      isActive: true,
    };

    it('denies a Center Sevak approving a registration from a different Center', async () => {
      prisma.registration.findUnique.mockResolvedValue({
        tournamentId: 't1',
        centerId: 'center-B',
        userId: 'player-9',
      });
      prisma.tournament.findUnique.mockResolvedValue({ type: 'APL', createdByUserId: 'cm-1' });
      // The actor is Center Sevak for center-A only.
      prisma.roleAssignment.findMany.mockResolvedValue([
        { role: UserRole.CenterSevak, tournamentId: null, teamId: null, centerId: 'center-A' },
      ]);

      const allowed = await service.check(Permission.APPROVE_REGISTRATION, actor, {
        registrationId: 'reg-1',
      });
      expect(allowed).toBe(false);
    });

    it('allows a Center Sevak approving a registration from their own Center', async () => {
      prisma.registration.findUnique.mockResolvedValue({
        tournamentId: 't1',
        centerId: 'center-A',
        userId: 'player-9',
      });
      prisma.tournament.findUnique.mockResolvedValue({ type: 'APL', createdByUserId: 'cm-1' });
      prisma.roleAssignment.findMany.mockResolvedValue([
        { role: UserRole.CenterSevak, tournamentId: null, teamId: null, centerId: 'center-A' },
      ]);

      const allowed = await service.check(Permission.APPROVE_REGISTRATION, actor, {
        registrationId: 'reg-1',
      });
      expect(allowed).toBe(true);
    });
  });
});
