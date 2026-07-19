import {
  BallType,
  dashboardPlayedBallTypes,
  EMPTY_DASHBOARD_PLAYER_PERFORMANCE,
  statsForDashboardBallType,
  type DashboardPlayerPerformance,
} from '@acc/types';

describe('dashboard player performance helpers', () => {
  const both: DashboardPlayerPerformance = {
    leather: { matches: 3, runs: 40, wickets: 2 },
    tennis: { matches: 1, runs: 12, wickets: 0 },
  };

  it('lists played formats with Leather first', () => {
    expect(dashboardPlayedBallTypes(both)).toEqual([BallType.Leather, BallType.Tennis]);
    expect(
      dashboardPlayedBallTypes({
        ...EMPTY_DASHBOARD_PLAYER_PERFORMANCE,
        tennis: { matches: 2, runs: 10, wickets: 1 },
      }),
    ).toEqual([BallType.Tennis]);
    expect(dashboardPlayedBallTypes(EMPTY_DASHBOARD_PLAYER_PERFORMANCE)).toEqual([]);
  });

  it('returns high-level totals for the selected ball type', () => {
    expect(statsForDashboardBallType(both, BallType.Leather)).toEqual(both.leather);
    expect(statsForDashboardBallType(both, BallType.Tennis)).toEqual(both.tennis);
  });
});
