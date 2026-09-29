import { UserRole } from '@acc/types';
import { describe, expect, it } from 'vitest';

import {
  ACCESS_DENIED_MESSAGE,
  canAccessAdminDashboard,
  dashboardAccessBlocker,
  MUST_CHANGE_PASSWORD_MESSAGE,
} from './access';

describe('canAccessAdminDashboard', () => {
  it.each([UserRole.Admin, UserRole.ClubManager])('allows active %s', (role) => {
    expect(canAccessAdminDashboard({ role, isActive: true })).toBe(true);
  });

  it('blocks every other platform role', () => {
    const others = Object.values(UserRole).filter(
      (r) => r !== UserRole.Admin && r !== UserRole.ClubManager,
    );
    expect(others.length).toBeGreaterThan(0);
    for (const role of others) {
      expect(canAccessAdminDashboard({ role, isActive: true })).toBe(false);
    }
  });

  it('blocks deactivated admins', () => {
    expect(canAccessAdminDashboard({ role: UserRole.Admin, isActive: false })).toBe(false);
  });
});

describe('dashboardAccessBlocker', () => {
  it('returns null for an active admin', () => {
    expect(dashboardAccessBlocker({ role: UserRole.Admin, isActive: true })).toBeNull();
  });

  it('explains role denials before password state', () => {
    expect(
      dashboardAccessBlocker({ role: UserRole.Player, isActive: true, mustChangePassword: true }),
    ).toBe(ACCESS_DENIED_MESSAGE);
  });

  it('asks club managers with a pending password change to finish it on mobile', () => {
    expect(
      dashboardAccessBlocker({
        role: UserRole.ClubManager,
        isActive: true,
        mustChangePassword: true,
      }),
    ).toBe(MUST_CHANGE_PASSWORD_MESSAGE);
  });
});
