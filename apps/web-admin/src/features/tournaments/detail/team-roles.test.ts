import { BallType } from '@acc/types';
import { describe, expect, it } from 'vitest';

import {
  EMPTY_ROLE_SELECTION,
  isRoleCheckboxDisabled,
  teamRoleColumns,
  toAssignRolesRequest,
  toggleRole,
} from './team-roles';

describe('team role checkboxes', () => {
  it('shows Manager for tennis only', () => {
    expect(teamRoleColumns(BallType.Tennis).map((c) => c.key)).toEqual([
      'captain',
      'viceCaptain',
      'manager',
    ]);
    expect(teamRoleColumns(BallType.Leather).map((c) => c.key)).toEqual(['captain', 'viceCaptain']);
  });

  it('picking a role disables that role for others and other roles for the holder', () => {
    const s = toggleRole(EMPTY_ROLE_SELECTION, 'a', 'captain', true);
    expect(isRoleCheckboxDisabled(s, 'b', 'captain')).toBe(true);
    expect(isRoleCheckboxDisabled(s, 'a', 'viceCaptain')).toBe(true);
    expect(isRoleCheckboxDisabled(s, 'a', 'manager')).toBe(true);
    expect(isRoleCheckboxDisabled(s, 'a', 'captain')).toBe(false);
    expect(isRoleCheckboxDisabled(s, 'b', 'viceCaptain')).toBe(false);
  });

  it('unchecking re-enables and blocked toggles are ignored', () => {
    let s = toggleRole(EMPTY_ROLE_SELECTION, 'a', 'captain', true);
    expect(toggleRole(s, 'b', 'captain', true)).toBe(s);
    expect(toggleRole(s, 'a', 'viceCaptain', true)).toBe(s);
    s = toggleRole(s, 'a', 'captain', false);
    expect(s).toEqual(EMPTY_ROLE_SELECTION);
    expect(isRoleCheckboxDisabled(s, 'b', 'captain')).toBe(false);
  });

  it('builds the PATCH body, clearing with null and omitting Manager for leather', () => {
    const s = { captain: 'a', viceCaptain: null, manager: 'c' };
    expect(toAssignRolesRequest(s, BallType.Tennis)).toEqual({
      captainUserId: 'a',
      viceCaptainUserId: null,
      managerUserId: 'c',
    });
    expect(toAssignRolesRequest(s, BallType.Leather)).toEqual({
      captainUserId: 'a',
      viceCaptainUserId: null,
    });
    expect(toAssignRolesRequest(s, BallType.Tennis, ['captain'])).toEqual({ captainUserId: 'a' });
  });
});
