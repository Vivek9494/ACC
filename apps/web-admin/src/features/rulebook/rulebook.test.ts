import {
  LEATHER_STANDINGS_POINTS,
  NotificationTrigger,
  OTP_LENGTH,
  Permission,
  PERMISSION_MATRIX,
  TENNIS_STANDINGS_POINTS,
  UserRole,
} from '@acc/types';
import { describe, expect, it } from 'vitest';

import { RULEBOOK_SECTIONS } from './rulebook-content';
import {
  buildPermissionMatrixRows,
  cellSegments,
  code,
  formatMinutes,
  formatSeconds,
  isCodeValue,
  MATRIX_SUBJECTS,
  rule,
  ruleText,
  type CodeValue,
} from './rulebook-model';

function allCodeValues(): CodeValue[] {
  return RULEBOOK_SECTIONS.flatMap((section) =>
    section.groups.flatMap((group) => [
      ...group.rules.flatMap((item) => item.parts.filter(isCodeValue)),
      ...(group.table?.rows.flat().flatMap(cellSegments).filter(isCodeValue) ?? []),
    ]),
  );
}

describe('rule template', () => {
  it('keeps code values as tagged segments', () => {
    const item = rule`Win = ${code(10, 'LEATHER_POINTS_WIN')} points`;
    expect(item.parts).toEqual(['Win = ', { kind: 'code', value: '10', source: 'LEATHER_POINTS_WIN' }, ' points']);
    expect(ruleText(item)).toBe('Win = 10 points');
  });

  it('formats durations', () => {
    expect(formatMinutes(120)).toBe('2 hours');
    expect(formatMinutes(30)).toBe('30 minutes');
    expect(formatSeconds(300)).toBe('5 minutes');
    expect(formatSeconds(45)).toBe('45 seconds');
  });
});

describe('RULEBOOK_SECTIONS', () => {
  it('covers every requested area with unique ids', () => {
    const ids = RULEBOOK_SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(
      expect.arrayContaining([
        'tournaments',
        'users-roles',
        'registration',
        'teams',
        'matches',
        'scoring',
        'password-otp',
        'notifications',
      ]),
    );
    for (const section of RULEBOOK_SECTIONS) {
      expect(section.groups.length).toBeGreaterThan(0);
    }
  });

  it('renders the points schedule from the standings constants', () => {
    const table = RULEBOOK_SECTIONS.find((s) => s.id === 'tournaments')?.groups.find(
      (g) => g.title === 'Points schedule',
    )?.table;
    const values = (row: number) => table?.rows[row]?.slice(1).map((cell) => (isCodeValue(cell) ? cell.value : cell));
    const expected = (p: typeof LEATHER_STANDINGS_POINTS) =>
      [p.win, p.tieOrNoResult, p.tieOrNoResult, p.loss].map(String);
    expect(values(0)).toEqual(expected(LEATHER_STANDINGS_POINTS));
    expect(values(1)).toEqual(expected(TENNIS_STANDINGS_POINTS));
  });

  it('reads the OTP length from code', () => {
    expect(allCodeValues()).toContainEqual({ kind: 'code', value: String(OTP_LENGTH), source: 'OTP_LENGTH' });
  });

  it('documents every push notification trigger', () => {
    const sources = new Set(allCodeValues().map((value) => value.source));
    const missing = Object.keys(NotificationTrigger).filter((key) => !sources.has(`NotificationTrigger.${key}`));
    expect(missing).toEqual([]);
  });

  it('names a source for every code value', () => {
    for (const value of allCodeValues()) {
      expect(value.source).not.toBe('');
      expect(value.value).not.toBe('');
    }
  });
});

describe('buildPermissionMatrixRows', () => {
  it('has one row per permission and one cell per subject', () => {
    const rows = buildPermissionMatrixRows();
    expect(rows).toHaveLength(Object.keys(PERMISSION_MATRIX).length);
    for (const row of rows) {
      expect(row.cells).toHaveLength(MATRIX_SUBJECTS.length);
    }
  });

  it('shows the audit log as Admin-only and unlock as Admin-only', () => {
    const rows = buildPermissionMatrixRows();
    const adminIndex = MATRIX_SUBJECTS.indexOf(UserRole.Admin);
    for (const permission of [Permission.VIEW_AUDIT_LOG, Permission.UNLOCK_ACCOUNT]) {
      const row = rows.find((r) => r.permission === permission);
      expect(row?.cells.filter((cell) => cell !== null)).toHaveLength(1);
      expect(row?.cells[adminIndex]).toEqual([]);
    }
  });
});
