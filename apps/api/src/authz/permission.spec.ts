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
    teamMembership: { findFirst: jest.Mock };
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
      teamMembership: { findFirst: jest.fn().mockResolvedValue(null) },
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

    it('allows approving a registration from their own Center on tennis', () => {
      const result = service.evaluate(
        Permission.APPROVE_REGISTRATION,
        ctx({ subjects: [UserRole.CenterSevak], tournamentType: TournamentType.APL, sameCenter: true }),
      );
      expect(result).toBe(true);
    });

    it('denies Center Sevak approval on leather ACC', () => {
      const result = service.evaluate(
        Permission.APPROVE_REGISTRATION,
        ctx({ subjects: [UserRole.CenterSevak], tournamentType: TournamentType.ACC, sameCenter: true }),
      );
      expect(result).toBe(false);
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

    it('allows Admin to confirm', () => {
      const result = service.evaluate(
        Permission.CONFIRM_SCORECARD,
        ctx({ subjects: [UserRole.Admin] }),
      );
      expect(result).toBe(true);
    });

    it('allows Club Manager to confirm', () => {
      const result = service.evaluate(
        Permission.CONFIRM_SCORECARD,
        ctx({ subjects: [UserRole.ClubManager], tournamentType: TournamentType.ACC }),
      );
      expect(result).toBe(true);
    });

    it('denies a Scorer who is not a captain or vice-captain', () => {
      const result = service.evaluate(
        Permission.CONFIRM_SCORECARD,
        ctx({ subjects: [UserRole.Player, 'SCORER'], sameTeam: false }),
      );
      expect(result).toBe(false);
    });
  });

  describe('tournament player profile (captain + Club Manager)', () => {
    it('allows any captain in the tournament to view profiles', () => {
      const result = service.evaluate(
        Permission.VIEW_TOURNAMENT_PLAYER_PROFILE,
        ctx({ subjects: [UserRole.Captain], tournamentType: TournamentType.ACC }),
      );
      expect(result).toBe(true);
    });

    it('allows Club Manager cross-team profile access', () => {
      const result = service.evaluate(
        Permission.VIEW_TOURNAMENT_PLAYER_PROFILE,
        ctx({ subjects: [UserRole.ClubManager], tournamentType: TournamentType.ACC }),
      );
      expect(result).toBe(true);
    });

    it('denies a regular player from viewing tournament player profiles', () => {
      const result = service.evaluate(
        Permission.VIEW_TOURNAMENT_PLAYER_PROFILE,
        ctx({ subjects: [UserRole.Player], tournamentType: TournamentType.ACC }),
      );
      expect(result).toBe(false);
    });
  });

  describe('verified registered players (Captain / VC / Club Manager)', () => {
    it('allows Captain in a tennis tournament on own team', () => {
      const result = service.evaluate(
        Permission.VIEW_VERIFIED_REGISTERED_PLAYERS,
        ctx({ subjects: [UserRole.Captain], tournamentType: TournamentType.APL, sameTeam: true }),
      );
      expect(result).toBe(true);
    });

    it('allows Vice Captain in a tennis tournament on own team', () => {
      const result = service.evaluate(
        Permission.VIEW_VERIFIED_REGISTERED_PLAYERS,
        ctx({
          subjects: [UserRole.ViceCaptain],
          tournamentType: TournamentType.APL,
          sameTeam: true,
        }),
      );
      expect(result).toBe(true);
    });

    it('denies a regular player', () => {
      const result = service.evaluate(
        Permission.VIEW_VERIFIED_REGISTERED_PLAYERS,
        ctx({ subjects: [UserRole.Player], tournamentType: TournamentType.APL }),
      );
      expect(result).toBe(false);
    });

    it('allows Manager in a tennis tournament', () => {
      const result = service.evaluate(
        Permission.VIEW_VERIFIED_REGISTERED_PLAYERS,
        ctx({ subjects: [UserRole.Manager], tournamentType: TournamentType.APL, sameTeam: true }),
      );
      expect(result).toBe(true);
    });
  });

  describe('favourite players (Captain / VC / Manager, tennis only)', () => {
    it('allows Captain on own team in APL', () => {
      const result = service.evaluate(
        Permission.FAVOURITE_PLAYERS,
        ctx({ subjects: [UserRole.Captain], tournamentType: TournamentType.APL, sameTeam: true }),
      );
      expect(result).toBe(true);
    });

    it('allows Manager on own team in APL', () => {
      const result = service.evaluate(
        Permission.FAVOURITE_PLAYERS,
        ctx({ subjects: [UserRole.Manager], tournamentType: TournamentType.APL, sameTeam: true }),
      );
      expect(result).toBe(true);
    });

    it('denies Manager in ACC (leather)', () => {
      const result = service.evaluate(
        Permission.FAVOURITE_PLAYERS,
        ctx({ subjects: [UserRole.Manager], tournamentType: TournamentType.ACC, sameTeam: true }),
      );
      expect(result).toBe(false);
    });

    it('denies Club Manager without team leadership', () => {
      const result = service.evaluate(
        Permission.FAVOURITE_PLAYERS,
        ctx({ subjects: [UserRole.ClubManager], tournamentType: TournamentType.APL }),
      );
      expect(result).toBe(false);
    });
  });

  describe('check() — tournament-level OwnTeam (favourite players PUT)', () => {
    const captain: AuthUser = {
      id: 'captain-1',
      firstName: 'Cap',
      lastName: 'Tain',
      mobileNumber: '+15555550001',
      email: 'cap@acc.local',
      centerId: 'center-A',
      jerseyNumber: 1,
      profilePhotoUrl: null,
      role: UserRole.Player,
      isActive: true,
    };

    it('allows Captain when leading a team in the tournament (no teamId in route)', async () => {
      prisma.tournament.findUnique.mockResolvedValue({
        type: TournamentType.APL,
        createdByUserId: 'other',
        isDeleted: false,
      });
      prisma.roleAssignment.findMany.mockResolvedValue([
        {
          role: UserRole.Captain,
          tournamentId: 'tour-1',
          teamId: 'team-1',
          centerId: null,
        },
      ]);

      const allowed = await service.check(Permission.FAVOURITE_PLAYERS, captain, {
        tournamentId: 'tour-1',
      });

      expect(allowed).toBe(true);
    });

    it('denies a player with no team leadership in the tournament', async () => {
      prisma.tournament.findUnique.mockResolvedValue({
        type: TournamentType.APL,
        createdByUserId: 'other',
        isDeleted: false,
      });
      prisma.roleAssignment.findMany.mockResolvedValue([]);

      const allowed = await service.check(Permission.FAVOURITE_PLAYERS, captain, {
        tournamentId: 'tour-1',
      });

      expect(allowed).toBe(false);
    });
  });

  describe('check() — VOTE_AVAILABILITY_POLL (rostered Player OwnTeam)', () => {
    const rosteredPlayer: AuthUser = {
      id: 'player-1',
      firstName: 'Pat',
      lastName: 'Player',
      mobileNumber: '+15555550099',
      email: 'pat@acc.local',
      centerId: 'center-A',
      jerseyNumber: 7,
      profilePhotoUrl: null,
      role: UserRole.Player,
      isActive: true,
    };

    it('allows a rostered Player on the match team in ACC', async () => {
      prisma.tournament.findUnique.mockResolvedValue({
        type: TournamentType.ACC,
        createdByUserId: 'other',
        isDeleted: false,
      });
      prisma.match.findUnique.mockResolvedValue({
        tournamentId: 'tour-acc',
        homeTeamId: 'acc-3',
        awayTeamId: 'ext-1',
      });
      prisma.roleAssignment.findMany.mockResolvedValue([]);
      prisma.teamMembership.findFirst.mockResolvedValue({ id: 'membership-1' });

      const allowed = await service.check(Permission.VOTE_AVAILABILITY_POLL, rosteredPlayer, {
        matchId: 'match-1',
        teamId: 'acc-3',
        tournamentId: 'tour-acc',
      });

      expect(allowed).toBe(true);
      expect(prisma.teamMembership.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'player-1',
            tournamentId: 'tour-acc',
            teamId: { in: ['acc-3'] },
          }),
        }),
      );
    });

    it('denies a Player who is not on the team roster', async () => {
      prisma.tournament.findUnique.mockResolvedValue({
        type: TournamentType.ACC,
        createdByUserId: 'other',
        isDeleted: false,
      });
      prisma.match.findUnique.mockResolvedValue({
        tournamentId: 'tour-acc',
        homeTeamId: 'acc-3',
        awayTeamId: 'ext-1',
      });
      prisma.roleAssignment.findMany.mockResolvedValue([]);
      prisma.teamMembership.findFirst.mockResolvedValue(null);

      const allowed = await service.check(Permission.VOTE_AVAILABILITY_POLL, rosteredPlayer, {
        matchId: 'match-1',
        teamId: 'acc-3',
        tournamentId: 'tour-acc',
      });

      expect(allowed).toBe(false);
    });
  });

  describe('CREATE_MATCH (captain leather)', () => {
    it('allows Captain on own team in an ACC tournament', () => {
      const result = service.evaluate(Permission.CREATE_MATCH, ctx({
        subjects: [UserRole.Captain],
        tournamentType: TournamentType.ACC,
        sameTeam: true,
      }));
      expect(result).toBe(true);
    });

    it('allows Vice Captain on own team in an ACC tournament', () => {
      const result = service.evaluate(Permission.CREATE_MATCH, ctx({
        subjects: [UserRole.ViceCaptain],
        tournamentType: TournamentType.ACC,
        sameTeam: true,
      }));
      expect(result).toBe(true);
    });

    it('denies Captain without own-team scope in an ACC tournament', () => {
      const result = service.evaluate(Permission.CREATE_MATCH, ctx({
        subjects: [UserRole.Captain],
        tournamentType: TournamentType.ACC,
        sameTeam: false,
      }));
      expect(result).toBe(false);
    });

    it('denies Captain in a tennis tournament even on own team', () => {
      const result = service.evaluate(Permission.CREATE_MATCH, ctx({
        subjects: [UserRole.Captain],
        tournamentType: TournamentType.APL,
        sameTeam: true,
      }));
      expect(result).toBe(false);
    });

    it('allows Club Manager in ACC tournaments even when not the organizer', () => {
      const result = service.evaluate(Permission.CREATE_MATCH, ctx({
        subjects: [UserRole.ClubManager],
        tournamentType: TournamentType.ACC,
        isOrganizer: false,
      }));
      expect(result).toBe(true);
    });

    it('allows Club Manager in APL tournaments even when not the organizer', () => {
      const result = service.evaluate(Permission.CREATE_MATCH, ctx({
        subjects: [UserRole.ClubManager],
        tournamentType: TournamentType.APL,
        isOrganizer: false,
      }));
      expect(result).toBe(true);
    });
  });

  describe('EDIT_MATCH / DELETE_MATCH (Admin / Club Manager)', () => {
    it('allows Club Manager to edit matches', () => {
      const result = service.evaluate(
        Permission.EDIT_MATCH,
        ctx({ subjects: [UserRole.ClubManager], tournamentType: TournamentType.ACC }),
      );
      expect(result).toBe(true);
    });

    it('denies Captain from editing matches', () => {
      const result = service.evaluate(
        Permission.EDIT_MATCH,
        ctx({ subjects: [UserRole.Captain], tournamentType: TournamentType.ACC, sameTeam: true }),
      );
      expect(result).toBe(false);
    });

    it('allows Admin to delete matches', () => {
      const result = service.evaluate(
        Permission.DELETE_MATCH,
        ctx({ subjects: [UserRole.Admin], tournamentType: TournamentType.APL }),
      );
      expect(result).toBe(true);
    });
  });

  describe('leather registered players (Admin / Club Manager)', () => {
    it('allows Club Manager in an ACC tournament', () => {
      const result = service.evaluate(
        Permission.VIEW_LEATHER_REGISTERED_PLAYERS,
        ctx({ subjects: [UserRole.ClubManager], tournamentType: TournamentType.ACC }),
      );
      expect(result).toBe(true);
    });

    it('allows Admin in an ACC tournament', () => {
      const result = service.evaluate(
        Permission.VIEW_LEATHER_REGISTERED_PLAYERS,
        ctx({ subjects: [UserRole.Admin], tournamentType: TournamentType.ACC }),
      );
      expect(result).toBe(true);
    });

    it('denies Captain in an ACC tournament', () => {
      const result = service.evaluate(
        Permission.VIEW_LEATHER_REGISTERED_PLAYERS,
        ctx({ subjects: [UserRole.Captain], tournamentType: TournamentType.ACC, sameTeam: true }),
      );
      expect(result).toBe(false);
    });

    it('denies Club Manager on a tennis tournament', () => {
      const result = service.evaluate(
        Permission.VIEW_LEATHER_REGISTERED_PLAYERS,
        ctx({ subjects: [UserRole.ClubManager], tournamentType: TournamentType.APL }),
      );
      expect(result).toBe(false);
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

  describe('Vice Captain mirrors Captain (always active)', () => {
    it('allows Playing 11 selection for Vice Captain without Captain suspension', () => {
      const result = service.evaluate(
        Permission.SELECT_PLAYING_11,
        ctx({ subjects: [UserRole.ViceCaptain], tournamentType: TournamentType.ACC, sameTeam: true }),
      );
      expect(result).toBe(true);
    });

    it('allows Vice Captain to view tournament player profiles', () => {
      const result = service.evaluate(
        Permission.VIEW_TOURNAMENT_PLAYER_PROFILE,
        ctx({ subjects: [UserRole.ViceCaptain], tournamentType: TournamentType.ACC }),
      );
      expect(result).toBe(true);
    });

    it('allows Club Manager to view verified registered players in tennis', () => {
      const result = service.evaluate(
        Permission.VIEW_VERIFIED_REGISTERED_PLAYERS,
        ctx({ subjects: [UserRole.ClubManager], tournamentType: TournamentType.APL }),
      );
      expect(result).toBe(true);
    });
  });

  describe('Club Manager assigns team roles', () => {
    it('allows a Club Manager who organizes the tournament', () => {
      const result = service.evaluate(
        Permission.ASSIGN_TEAM_ROLES,
        ctx({ subjects: [UserRole.ClubManager], tournamentType: TournamentType.ACC, isOrganizer: true }),
      );
      expect(result).toBe(true);
    });

    it('denies a Center Sevak from assigning team roles', () => {
      const result = service.evaluate(
        Permission.ASSIGN_TEAM_ROLES,
        ctx({
          subjects: [UserRole.CenterSevak],
          tournamentType: TournamentType.APL,
          isOrganizer: true,
        }),
      );
      expect(result).toBe(false);
    });

    it('allows a Club Manager on ACC tournaments even when Admin created them', () => {
      const result = service.evaluate(
        Permission.ASSIGN_TEAM_ROLES,
        ctx({ subjects: [UserRole.ClubManager], tournamentType: TournamentType.ACC, isOrganizer: false }),
      );
      expect(result).toBe(true);
    });
  });

  describe('Club Manager edits tournaments', () => {
    it('allows editing ACC tournaments even when Admin created them', () => {
      const result = service.evaluate(
        Permission.EDIT_TOURNAMENT,
        ctx({ subjects: [UserRole.ClubManager], tournamentType: TournamentType.ACC, isOrganizer: false }),
      );
      expect(result).toBe(true);
    });

    it('allows editing APL tournaments even when not the organizer', () => {
      const result = service.evaluate(
        Permission.EDIT_TOURNAMENT,
        ctx({ subjects: [UserRole.ClubManager], tournamentType: TournamentType.APL, isOrganizer: false }),
      );
      expect(result).toBe(true);
    });

    it('allows editing Center-level tournaments even when not the organizer', () => {
      const result = service.evaluate(
        Permission.EDIT_TOURNAMENT,
        ctx({ subjects: [UserRole.ClubManager], tournamentType: TournamentType.Center, isOrganizer: false }),
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

  describe('MANAGE_BROADCAST', () => {
    it('allows Admin', () => {
      expect(service.evaluate(Permission.MANAGE_BROADCAST, ctx({ subjects: [UserRole.Admin] }))).toBe(
        true,
      );
    });

    it('allows Club Manager', () => {
      expect(
        service.evaluate(Permission.MANAGE_BROADCAST, ctx({ subjects: [UserRole.ClubManager] })),
      ).toBe(true);
    });

    it('denies Player', () => {
      expect(service.evaluate(Permission.MANAGE_BROADCAST, ctx({ subjects: [UserRole.Player] }))).toBe(
        false,
      );
    });

    it('denies Center Sevak', () => {
      expect(
        service.evaluate(Permission.MANAGE_BROADCAST, ctx({ subjects: [UserRole.CenterSevak] })),
      ).toBe(false);
    });

    it('check() allows Club Manager without tournament scope refs', async () => {
      const clubManager: AuthUser = {
        id: 'cm-1',
        firstName: 'Rahul',
        lastName: 'Manager',
        mobileNumber: '+15555550002',
        email: 'manager@acc.local',
        centerId: 'center-A',
        jerseyNumber: 0,
        profilePhotoUrl: null,
        role: UserRole.ClubManager,
        isActive: true,
        teamLeadAssignments: [],
      };

      const allowed = await service.check(Permission.MANAGE_BROADCAST, clubManager, {});
      expect(allowed).toBe(true);
    });
  });

  describe('VIEW_ADMIN_USERS', () => {
    it('allows Admin', () => {
      expect(service.evaluate(Permission.VIEW_ADMIN_USERS, ctx({ subjects: [UserRole.Admin] }))).toBe(
        true,
      );
    });

    it('allows Club Manager', () => {
      expect(
        service.evaluate(Permission.VIEW_ADMIN_USERS, ctx({ subjects: [UserRole.ClubManager] })),
      ).toBe(true);
    });

    it('denies Player', () => {
      expect(service.evaluate(Permission.VIEW_ADMIN_USERS, ctx({ subjects: [UserRole.Player] }))).toBe(
        false,
      );
    });
  });

  describe('MANAGE_ADMIN_USERS', () => {
    it('allows Admin', () => {
      expect(
        service.evaluate(Permission.MANAGE_ADMIN_USERS, ctx({ subjects: [UserRole.Admin] })),
      ).toBe(true);
    });

    it('denies Club Manager', () => {
      expect(
        service.evaluate(Permission.MANAGE_ADMIN_USERS, ctx({ subjects: [UserRole.ClubManager] })),
      ).toBe(false);
    });

    it('denies Player', () => {
      expect(
        service.evaluate(Permission.MANAGE_ADMIN_USERS, ctx({ subjects: [UserRole.Player] })),
      ).toBe(false);
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

  describe('UPDATE_MATCH_STATUS (§5.2 match status controls)', () => {
    it('allows Admin and Club Manager', () => {
      expect(
        service.evaluate(
          Permission.UPDATE_MATCH_STATUS,
          ctx({ subjects: [UserRole.Admin], tournamentType: TournamentType.ACC }),
        ),
      ).toBe(true);
      expect(
        service.evaluate(
          Permission.UPDATE_MATCH_STATUS,
          ctx({ subjects: [UserRole.ClubManager], tournamentType: TournamentType.ACC }),
        ),
      ).toBe(true);
    });

    it('denies a plain Player without team leadership or scorer grant', () => {
      expect(
        service.evaluate(
          Permission.UPDATE_MATCH_STATUS,
          ctx({ subjects: [UserRole.Player], tournamentType: TournamentType.ACC }),
        ),
      ).toBe(false);
    });
  });
});
