import {
  buildDeliveryHighlightMarker,
  formatBoundaryBallLabel,
  resolveBoundaryHighlightRuns,
} from '@acc/types';

describe('boundary-highlight (v0 markers)', () => {
  it('resolves 4 vs 6 from isBoundary + runsBat', () => {
    expect(resolveBoundaryHighlightRuns(false, 4)).toBeNull();
    expect(resolveBoundaryHighlightRuns(true, 4)).toBe(4);
    expect(resolveBoundaryHighlightRuns(true, 6)).toBe(6);
    expect(resolveBoundaryHighlightRuns(true, 7)).toBe(6);
  });

  it('formats ball labels', () => {
    expect(formatBoundaryBallLabel(12, 3)).toBe('12.3');
    expect(formatBoundaryBallLabel(null, 1)).toBe('');
  });

  it('builds a marker from explicit highlight columns', () => {
    const marker = buildDeliveryHighlightMarker({
      deliveryId: 'd1',
      inningsId: 'i1',
      sequence: 9,
      isBoundary: true,
      runsBat: 4,
      createdAt: '2026-08-31T12:00:00.000Z',
      highlightMarkedAt: '2026-08-31T12:00:01.000Z',
      highlightBoundaryRuns: 4,
      overNumber: 3,
      ballNumber: 2,
      strikerId: 'bat',
      bowlerId: 'bowl',
    });
    expect(marker).toEqual({
      deliveryId: 'd1',
      inningsId: 'i1',
      sequence: 9,
      markedAt: '2026-08-31T12:00:01.000Z',
      overNumber: 3,
      ballNumber: 2,
      ballLabel: '3.2',
      strikerId: 'bat',
      bowlerId: 'bowl',
      runsBat: 4,
      boundaryRuns: 4,
      status: 'MARKED',
    });
  });

  it('falls back to isBoundary + createdAt when columns are unset (legacy rows)', () => {
    const marker = buildDeliveryHighlightMarker({
      deliveryId: 'd2',
      inningsId: 'i1',
      sequence: 2,
      isBoundary: true,
      runsBat: 6,
      createdAt: new Date('2026-08-31T13:00:00.000Z'),
      highlightMarkedAt: null,
      highlightBoundaryRuns: null,
      overNumber: 1,
      ballNumber: 1,
      strikerId: null,
      bowlerId: null,
    });
    expect(marker?.boundaryRuns).toBe(6);
    expect(marker?.markedAt).toBe('2026-08-31T13:00:00.000Z');
    expect(marker?.status).toBe('MARKED');
  });

  it('returns null for non-boundaries', () => {
    expect(
      buildDeliveryHighlightMarker({
        deliveryId: 'd3',
        inningsId: 'i1',
        sequence: 1,
        isBoundary: false,
        runsBat: 1,
        createdAt: '2026-08-31T12:00:00.000Z',
        overNumber: 1,
        ballNumber: 1,
        strikerId: 'a',
        bowlerId: 'b',
      }),
    ).toBeNull();
  });
});
