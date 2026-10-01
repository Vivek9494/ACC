import { AUDIT_LOG_MAX_RANGE_DAYS, AUDIT_LOG_RETENTION_DAYS } from '@acc/types';
import { describe, expect, it } from 'vitest';

import {
  auditFieldChanges,
  EMPTY_LOGS_FILTERS,
  formatAuditValue,
  inclusiveDaySpan,
  oldestRetainedDate,
  selectionToUtcWindow,
  shiftLocalIsoDate,
  summarizeAuditDetails,
  toAuditLogParams,
  toAuditLogSearch,
  validateLogsRange,
} from './audit-logs';

describe('selectionToUtcWindow', () => {
  it('covers one full local day for a single date (to is exclusive)', () => {
    const { from, to } = selectionToUtcWindow({ mode: 'day', date: '2026-09-30' });
    expect(new Date(from).getTime()).toBe(new Date(2026, 8, 30).getTime());
    expect(new Date(to).getTime()).toBe(new Date(2026, 9, 1).getTime());
  });

  it('spans from the first local midnight to the midnight after the last day', () => {
    const { from, to } = selectionToUtcWindow({ mode: 'range', fromDate: '2026-09-24', toDate: '2026-09-30' });
    expect(new Date(from).getTime()).toBe(new Date(2026, 8, 24).getTime());
    expect(new Date(to).getTime()).toBe(new Date(2026, 9, 1).getTime());
  });
});

describe('date helpers', () => {
  it('shifts across month boundaries', () => {
    expect(shiftLocalIsoDate('2026-09-30', 1)).toBe('2026-10-01');
    expect(shiftLocalIsoDate('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('counts days inclusively', () => {
    expect(inclusiveDaySpan('2026-09-30', '2026-09-30')).toBe(1);
    expect(inclusiveDaySpan('2026-09-01', '2026-09-30')).toBe(30);
  });

  it('puts the oldest retained day N days before today', () => {
    expect(oldestRetainedDate(new Date(2026, 8, 30, 15))).toBe(shiftLocalIsoDate('2026-09-30', -AUDIT_LOG_RETENTION_DAYS));
  });
});

describe('validateLogsRange', () => {
  it('accepts a valid range', () => {
    expect(validateLogsRange('2026-09-24', '2026-09-30')).toBeNull();
  });

  it('rejects missing, reversed and over-long ranges', () => {
    expect(validateLogsRange('', '2026-09-30')).not.toBeNull();
    expect(validateLogsRange('2026-09-30', '2026-09-29')).not.toBeNull();
    const end = shiftLocalIsoDate('2026-01-01', AUDIT_LOG_MAX_RANGE_DAYS);
    expect(validateLogsRange('2026-01-01', end)).not.toBeNull();
    expect(validateLogsRange('2026-01-01', shiftLocalIsoDate(end, -1))).toBeNull();
  });
});

describe('toAuditLogParams / toAuditLogSearch', () => {
  it('uses a 1-based page and omits empty filters', () => {
    const params = toAuditLogParams({ mode: 'day', date: '2026-09-30' }, EMPTY_LOGS_FILTERS, 0, 50);
    expect(params.page).toBe(1);
    expect(params.pageSize).toBe(50);
    expect(params).not.toHaveProperty('actorUserId');
    const search = toAuditLogSearch(params);
    expect(search.has('action')).toBe(false);
    expect(search.get('page')).toBe('1');
  });

  it('passes through actor (including System), action and entity type', () => {
    const params = toAuditLogParams(
      { mode: 'day', date: '2026-09-30' },
      { actorUserId: 'System', action: 'TEAM_CREATED', entityType: 'team' },
      2,
      25,
    );
    const search = toAuditLogSearch(params);
    expect(search.get('actorUserId')).toBe('System');
    expect(search.get('action')).toBe('TEAM_CREATED');
    expect(search.get('entityType')).toBe('team');
    expect(search.get('page')).toBe('3');
  });
});

describe('audit value formatting', () => {
  it('pairs before/after fields', () => {
    expect(auditFieldChanges({ name: 'A', city: 'X' }, { name: 'B' })).toEqual([
      { key: 'name', before: 'A', after: 'B' },
      { key: 'city', before: 'X', after: undefined },
    ]);
    expect(auditFieldChanges(null, null)).toEqual([]);
  });

  it('formats values and summarises details', () => {
    expect(formatAuditValue(undefined)).toBe('—');
    expect(formatAuditValue(null)).toBe('null');
    expect(formatAuditValue([1, 2])).toBe('[1,2]');
    expect(summarizeAuditDetails({ a: 1, b: 'x', c: true, d: null })).toBe('a: 1 · b: x · c: true · +1 more');
    expect(summarizeAuditDetails(null)).toBe('');
  });
});
