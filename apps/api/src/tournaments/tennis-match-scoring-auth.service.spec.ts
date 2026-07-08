import 'reflect-metadata';

import {
  BallType,
  NO_MATCH_SCORER_ASSIGNED_ERROR,
  NO_MATCH_SCORER_ASSIGNED_MESSAGE,
  UserRole,
  type AuthUser,
} from '@acc/types';
import { ForbiddenException } from '@nestjs/common';

import { MatchScorerGrantService } from '../authz/match-scorer.service';
import { TennisMatchScoringAuthService } from './tennis-match-scoring-auth.service';

describe('TennisMatchScoringAuthService', () => {
  const prisma = {
    match: { findUnique: jest.fn() },
  };
  const scorerGrants = {
    getActiveGrant: jest.fn(),
  };
  const tournamentScorers = {
    viewerCanManageScorers: jest.fn().mockResolvedValue(false),
  };

  const service = new TennisMatchScoringAuthService(
    prisma as never,
    scorerGrants as unknown as MatchScorerGrantService,
    tournamentScorers as never,
  );

  const assignedScorer: AuthUser = {
    id: 'scorer-1',
    firstName: 'Sam',
    lastName: 'Scorer',
    mobileNumber: '+15555551001',
    email: 'sam@acc.local',
    centerId: 'center-A',
    jerseyNumber: 11,
    profilePhotoUrl: null,
    role: UserRole.Player,
    isActive: true,
  };

  const admin: AuthUser = { ...assignedScorer, id: 'admin-1', role: UserRole.Admin };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.match.findUnique.mockResolvedValue({
      tournament: { ballType: BallType.Tennis },
    });
  });

  it('allows leather matches without further checks', async () => {
    prisma.match.findUnique.mockResolvedValue({
      tournament: { ballType: BallType.Leather },
    });
    await expect(
      service.assertCanEnterScoringSession(assignedScorer, 'match-1'),
    ).resolves.toBeUndefined();
    expect(scorerGrants.getActiveGrant).not.toHaveBeenCalled();
  });

  it('allows Admin on tennis matches', async () => {
    await expect(service.assertCanEnterScoringSession(admin, 'match-1')).resolves.toBeUndefined();
    expect(scorerGrants.getActiveGrant).not.toHaveBeenCalled();
  });

  it('allows the assigned match scorer at session entry', async () => {
    scorerGrants.getActiveGrant.mockResolvedValue({ userId: 'scorer-1' });
    await expect(
      service.assertCanEnterScoringSession(assignedScorer, 'match-1'),
    ).resolves.toBeUndefined();
  });

  it('blocks session entry when no match scorer is assigned', async () => {
    scorerGrants.getActiveGrant.mockResolvedValue(null);
    await expect(
      service.assertCanEnterScoringSession(assignedScorer, 'match-1'),
    ).rejects.toMatchObject({
      response: {
        message: NO_MATCH_SCORER_ASSIGNED_MESSAGE,
        error: NO_MATCH_SCORER_ASSIGNED_ERROR,
      },
    });
  });

  it('rejects a user who is not the assigned match scorer', async () => {
    scorerGrants.getActiveGrant.mockResolvedValue({ userId: 'other-scorer' });
    await expect(
      service.assertCanEnterScoringSession(assignedScorer, 'match-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  describe('assertCanRecordToss', () => {
    beforeEach(() => {
      prisma.match.findUnique.mockResolvedValue({
        tournamentId: 'tour-1',
        tournament: { ballType: BallType.Tennis },
      });
      tournamentScorers.viewerCanManageScorers.mockResolvedValue(false);
    });

    it('allows leather matches without further checks', async () => {
      prisma.match.findUnique.mockResolvedValue({
        tournamentId: 'tour-1',
        tournament: { ballType: BallType.Leather },
      });
      await expect(service.assertCanRecordToss(assignedScorer, 'match-1')).resolves.toBeUndefined();
      expect(scorerGrants.getActiveGrant).not.toHaveBeenCalled();
    });

    it('allows Admin on tennis matches', async () => {
      await expect(service.assertCanRecordToss(admin, 'match-1')).resolves.toBeUndefined();
      expect(scorerGrants.getActiveGrant).not.toHaveBeenCalled();
    });

    it('allows tournament organizers on tennis matches', async () => {
      tournamentScorers.viewerCanManageScorers.mockResolvedValue(true);
      await expect(service.assertCanRecordToss(assignedScorer, 'match-1')).resolves.toBeUndefined();
      expect(scorerGrants.getActiveGrant).not.toHaveBeenCalled();
    });

    it('allows the assigned match scorer', async () => {
      scorerGrants.getActiveGrant.mockResolvedValue({ userId: 'scorer-1' });
      await expect(service.assertCanRecordToss(assignedScorer, 'match-1')).resolves.toBeUndefined();
    });

    it('rejects Captain/VC and other scorers without the active grant', async () => {
      scorerGrants.getActiveGrant.mockResolvedValue({ userId: 'other-scorer' });
      await expect(service.assertCanRecordToss(assignedScorer, 'match-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('rejects when no match scorer is assigned', async () => {
      scorerGrants.getActiveGrant.mockResolvedValue(null);
      await expect(service.assertCanRecordToss(assignedScorer, 'match-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });
});
