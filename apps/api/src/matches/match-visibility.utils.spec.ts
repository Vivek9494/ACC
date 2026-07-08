import { MatchState } from '@acc/types';

import {
  buildDashboardFeaturedMatchScopeWhere,
  dashboardFeaturedMatchBaseWhere,
  dashboardExcludeCancelledWhere,
  myMatchesStateWhere,
  withDashboardMatchVisibility,
} from './match-visibility.utils';

describe('match-visibility.utils', () => {
  it('dashboardFeaturedMatchBaseWhere excludes soft-deleted and cancelled', () => {
    expect(dashboardFeaturedMatchBaseWhere).toEqual({
      isDeleted: false,
      state: { not: MatchState.Cancelled },
    });
    expect(dashboardExcludeCancelledWhere).toBe(dashboardFeaturedMatchBaseWhere);
  });
  it('myMatchesStateWhere includes scored cancelled via delivery EXISTS', () => {
    expect(myMatchesStateWhere).toEqual({
      OR: [
        { state: { not: MatchState.Cancelled } },
        {
          state: MatchState.Cancelled,
          innings: { some: { deliveries: { some: {} } } },
        },
      ],
    });
  });

  it('withDashboardMatchVisibility ANDs without clobbering state filters', () => {
    expect(
      withDashboardMatchVisibility({
        state: { in: [MatchState.Live] },
        tournamentId: 't-1',
      }),
    ).toEqual({
      AND: [
        { state: { in: [MatchState.Live] }, tournamentId: 't-1' },
        dashboardFeaturedMatchBaseWhere,
      ],
    });
  });

  it('buildDashboardFeaturedMatchScopeWhere unions Playing XI ids and team scope', () => {
    expect(buildDashboardFeaturedMatchScopeWhere([], [])).toEqual({ id: { in: [] } });
    expect(buildDashboardFeaturedMatchScopeWhere(['team-1'], [])).toEqual({
      OR: [{ OR: [{ homeTeamId: { in: ['team-1'] } }, { awayTeamId: { in: ['team-1'] } }] }],
    });
    expect(buildDashboardFeaturedMatchScopeWhere([], ['match-1'])).toEqual({
      OR: [{ id: { in: ['match-1'] } }],
    });
    expect(buildDashboardFeaturedMatchScopeWhere(['team-1'], ['match-1'])).toEqual({
      OR: [
        { id: { in: ['match-1'] } },
        { OR: [{ homeTeamId: { in: ['team-1'] } }, { awayTeamId: { in: ['team-1'] } }] },
      ],
    });
  });
});
