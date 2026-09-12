import { MatchState, Permission, UserRole, type AuthUser } from '@acc/types';

import { assertCanManageUpcomingMatch } from './match-manage-auth.util';
import type { PermissionService } from '../authz/permission.service';

const adminActor: AuthUser = {
  id: 'admin-1',
  firstName: 'Ada',
  lastName: 'Min',
  mobileNumber: '+15555551001',
  email: 'admin@acc.local',
  centerId: 'center-A',
  jerseyNumber: 1,
  profilePhotoUrl: null,
  role: UserRole.Admin,
  isActive: true,
  teamLeadAssignments: [],
};

function allowAll(): PermissionService {
  return { check: jest.fn().mockResolvedValue(true) } as unknown as PermissionService;
}

function matchIn(state: MatchState, bracketId: string | null = null) {
  return { id: 'match-1', tournamentId: 'tour-1', state, bracketId };
}

describe('assertCanManageUpcomingMatch', () => {
  describe('delete eligibility by state', () => {
    it.each([
      MatchState.Scheduled,
      MatchState.Delayed,
      MatchState.PlayingXiLocked,
      MatchState.TossCompleted,
      MatchState.Completed,
      MatchState.NoResult,
    ])('allows deleting a %s match', async (state) => {
      await expect(
        assertCanManageUpcomingMatch(
          allowAll(),
          adminActor,
          matchIn(state),
          Permission.DELETE_MATCH,
        ),
      ).resolves.toBeUndefined();
    });

    it.each([
      MatchState.Live,
      MatchState.RainInterrupted,
      MatchState.ScorecardLocked,
      MatchState.Cancelled,
    ])('blocks deleting a %s match', async (state) => {
      await expect(
        assertCanManageUpcomingMatch(
          allowAll(),
          adminActor,
          matchIn(state),
          Permission.DELETE_MATCH,
        ),
      ).rejects.toMatchObject({
        response: {
          message: 'Only upcoming, completed, or no-result matches can be deleted',
        },
      });
    });
  });

  describe('knockout matches', () => {
    it.each([MatchState.Scheduled, MatchState.Completed, MatchState.NoResult])(
      'blocks deleting a %s match that belongs to a bracket',
      async (state) => {
        await expect(
          assertCanManageUpcomingMatch(
            allowAll(),
            adminActor,
            matchIn(state, 'bracket-1'),
            Permission.DELETE_MATCH,
          ),
        ).rejects.toMatchObject({
          response: { message: "Knockout matches can't be deleted" },
        });
      },
    );

    it('does not block editing a knockout fixture that is still upcoming', async () => {
      await expect(
        assertCanManageUpcomingMatch(
          allowAll(),
          adminActor,
          matchIn(MatchState.Scheduled, 'bracket-1'),
          Permission.EDIT_MATCH,
        ),
      ).resolves.toBeUndefined();
    });
  });

  describe('edit eligibility is unchanged by the widened delete window', () => {
    it.each([MatchState.Completed, MatchState.NoResult, MatchState.ScorecardLocked])(
      'still blocks editing a %s match',
      async (state) => {
        await expect(
          assertCanManageUpcomingMatch(
            allowAll(),
            adminActor,
            matchIn(state),
            Permission.EDIT_MATCH,
          ),
        ).rejects.toMatchObject({
          response: { message: 'Only upcoming matches can be edited' },
        });
      },
    );
  });

  it('rejects an actor without the permission even on an eligible match', async () => {
    const permissions = {
      check: jest.fn().mockResolvedValue(false),
    } as unknown as PermissionService;

    await expect(
      assertCanManageUpcomingMatch(
        permissions,
        adminActor,
        matchIn(MatchState.Completed),
        Permission.DELETE_MATCH,
      ),
    ).rejects.toMatchObject({
      response: { message: 'You do not have permission to perform this action' },
    });
  });
});
