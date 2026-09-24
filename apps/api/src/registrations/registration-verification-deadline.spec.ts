import {
  BallType,
  canManageRegistrationVerification,
  getRegistrationVerificationDeadline,
  isRegistrationVerificationComplete,
  isRegistrationVerificationDeadlinePassed,
  REGISTRATION_VERIFICATION_NO_AUCTION_GRACE_MS,
} from '@acc/types';

describe('registration verification deadline helpers', () => {
  const openAt = new Date('2026-06-01T12:00:00.000Z');
  const closeAt = new Date('2026-06-10T12:00:00.000Z');
  const auctionAt = new Date('2026-06-20T18:00:00.000Z');

  it('uses auctionAt when set', () => {
    expect(
      getRegistrationVerificationDeadline({
        auctionAt,
        registrationCloseAt: closeAt,
      }),
    ).toEqual(auctionAt);
  });

  it('falls back to registrationCloseAt + 48h', () => {
    expect(
      getRegistrationVerificationDeadline({
        auctionAt: null,
        registrationCloseAt: closeAt,
      }),
    ).toEqual(new Date(closeAt.getTime() + REGISTRATION_VERIFICATION_NO_AUCTION_GRACE_MS));
  });

  it('allows manage from open through the deadline', () => {
    const tournament = {
      registrationOpenAt: openAt,
      registrationCloseAt: closeAt,
      auctionAt: null,
    };
    expect(canManageRegistrationVerification(tournament, openAt)).toBe(true);
    expect(
      canManageRegistrationVerification(
        tournament,
        new Date(closeAt.getTime() + REGISTRATION_VERIFICATION_NO_AUCTION_GRACE_MS),
      ),
    ).toBe(true);
    expect(
      canManageRegistrationVerification(
        tournament,
        new Date(closeAt.getTime() + REGISTRATION_VERIFICATION_NO_AUCTION_GRACE_MS + 1),
      ),
    ).toBe(false);
  });

  it('marks complete only after deadline with zero waitlist', () => {
    const tournament = {
      ballType: BallType.Tennis,
      hasRegistrationWindow: true,
      registrationOpenAt: openAt.toISOString(),
      registrationCloseAt: closeAt.toISOString(),
      auctionAt: null as string | null,
    };
    const beforeDeadline = new Date(closeAt.getTime() + 24 * 60 * 60 * 1000);
    const afterDeadline = new Date(
      closeAt.getTime() + REGISTRATION_VERIFICATION_NO_AUCTION_GRACE_MS + 1,
    );
    expect(isRegistrationVerificationDeadlinePassed(tournament, beforeDeadline)).toBe(false);
    expect(isRegistrationVerificationComplete(tournament, 0, beforeDeadline)).toBe(false);
    expect(isRegistrationVerificationComplete(tournament, 1, afterDeadline)).toBe(false);
    expect(isRegistrationVerificationComplete(tournament, 0, afterDeadline)).toBe(true);
  });
});
