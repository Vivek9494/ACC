import { BallType, RegistrationStatus, type RegistrationSummary } from '@acc/types';
import { describe, expect, it } from 'vitest';

import {
  ALL_CENTERS,
  countByStatus,
  defaultRegistrationStatus,
  filterRegistrations,
  registrationCenters,
  resolveVerificationState,
} from './registrations';

const HOUR = 60 * 60 * 1000;
const now = new Date('2026-09-28T12:00:00.000Z');
const at = (offsetHours: number): string => new Date(now.getTime() + offsetHours * HOUR).toISOString();

const tennis = (open: number, close: number, auction: number | null = null) => ({
  ballType: BallType.Tennis,
  registrationOpenAt: at(open),
  registrationCloseAt: at(close),
  auctionAt: auction === null ? null : at(auction),
});

function reg(overrides: Partial<RegistrationSummary>): RegistrationSummary {
  return {
    id: 'r1',
    tournamentId: 't1',
    userId: 'u1',
    centerId: 'c1',
    centerName: 'Brampton',
    status: RegistrationStatus.InWaitlist,
    firstName: 'Arjun',
    lastName: 'Mehta',
    mobileNumber: '+15195550123',
    profilePhotoUrl: null,
    battingStyle: null,
    battingRating: null,
    battingPosition: null,
    playerRole: null,
    bowlingStyle: null,
    bowlingType: null,
    bowlingRating: null,
    fieldingRating: null,
    fieldingPosition: null,
    playerType: null,
    isAvailable: null,
    availabilityNote: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('resolveVerificationState', () => {
  it('has no verification step for leather', () => {
    expect(resolveVerificationState({ ...tennis(-10, 10), ballType: BallType.Leather }, 0, now).kind).toBe('leather');
  });

  it('needs a configured registration window', () => {
    expect(
      resolveVerificationState(
        { ballType: BallType.Tennis, registrationOpenAt: null, registrationCloseAt: null, auctionAt: null },
        0,
        now,
      ).kind,
    ).toBe('no-window');
  });

  it('is not open before registration opens', () => {
    expect(resolveVerificationState(tennis(5, 50), 0, now)).toEqual({ kind: 'not-open', opensAt: new Date(at(5)) });
  });

  it('stays open until close + 48h when there is no auction', () => {
    expect(resolveVerificationState(tennis(-100, -24), 3, now)).toEqual({ kind: 'open', deadline: new Date(at(24)) });
  });

  it('uses the auction time as the deadline when set', () => {
    expect(resolveVerificationState(tennis(-100, -24, -1), 3, now)).toEqual({
      kind: 'closed',
      deadline: new Date(at(-1)),
    });
  });

  it('is complete after the deadline once nobody is waitlisted', () => {
    const state = resolveVerificationState(tennis(-100, -72), 0, now);
    expect(state.kind).toBe('complete');
    expect(defaultRegistrationStatus(state)).toBe(RegistrationStatus.Confirmed);
    expect(defaultRegistrationStatus(resolveVerificationState(tennis(-100, -24), 0, now))).toBe(
      RegistrationStatus.InWaitlist,
    );
  });
});

describe('registration table helpers', () => {
  const rows = [
    reg({ id: 'a', firstName: 'Arjun', status: RegistrationStatus.InWaitlist }),
    reg({ id: 'b', firstName: 'Priya', lastName: 'Shah', centerId: 'c2', centerName: 'Ajax', mobileNumber: '+14165559876' }),
    reg({ id: 'c', status: RegistrationStatus.Confirmed }),
    reg({ id: 'd', status: RegistrationStatus.Declined }),
  ];

  it('counts each status', () => {
    expect(countByStatus(rows)).toEqual({ IN_WAITLIST: 2, CONFIRMED: 1, DECLINED: 1 });
  });

  it('lists distinct centers by name', () => {
    expect(registrationCenters(rows)).toEqual([
      { id: 'c2', name: 'Ajax' },
      { id: 'c1', name: 'Brampton' },
    ]);
  });

  it('filters by status, center, name and mobile digits', () => {
    const base = { status: RegistrationStatus.InWaitlist, search: '', centerId: ALL_CENTERS };
    expect(filterRegistrations(rows, base).map((r) => r.id)).toEqual(['a', 'b']);
    expect(filterRegistrations(rows, { ...base, centerId: 'c2' }).map((r) => r.id)).toEqual(['b']);
    expect(filterRegistrations(rows, { ...base, search: 'priya s' }).map((r) => r.id)).toEqual(['b']);
    expect(filterRegistrations(rows, { ...base, search: '(416) 555' }).map((r) => r.id)).toEqual(['b']);
    expect(filterRegistrations(rows, { ...base, status: RegistrationStatus.Declined }).map((r) => r.id)).toEqual(['d']);
  });
});
