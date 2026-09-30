import {
  BallType,
  CitySelection,
  DEFAULT_TOURNAMENT_FORMAT,
  TournamentDisplayStatus,
  TournamentState,
  TournamentType,
  type TournamentDetail,
} from '@acc/types';
import { describe, expect, it } from 'vitest';

import {
  buildTournamentDetailSections,
  formatCalendarDay,
  type DetailSection,
} from './tournament-details';

function detail(overrides: Partial<TournamentDetail> = {}): TournamentDetail {
  return {
    id: 't1',
    name: 'Summer APL',
    year: 2026,
    type: TournamentType.APL,
    state: TournamentState.RegistrationOpen,
    displayStatus: TournamentDisplayStatus.Upcoming,
    ballType: BallType.Tennis,
    posterUrl: null,
    startAt: '2026-10-20T00:00:00.000Z',
    endAt: '2026-10-21T00:00:00.000Z',
    locationAddress: 'Main Ground, Toronto',
    latitude: 43.7,
    longitude: -79.4,
    provinceId: 'on',
    scopeDisplay: {
      citySelection: CitySelection.Apl,
      provinceName: 'Ontario',
      centerNames: [],
      centerIds: [],
    },
    timezone: 'America/Toronto',
    teamCount: 0,
    dates: ['2026-10-21', '2026-10-20'],
    oversPerInnings: null,
    maxOversPerBowler: 3,
    numberOfTeams: 8,
    playersPerTeam: 14,
    substitutesAllowed: 2,
    format: DEFAULT_TOURNAMENT_FORMAT,
    impactPlayerEnabled: true,
    videoRequired: false,
    videoUploadStartAt: null,
    videoUploadEndDate: null,
    youtubeUrl: null,
    registrationOpenAt: '2026-10-01T13:30:00.000Z',
    registrationCloseAt: '2026-10-05T22:00:00.000Z',
    auctionAt: null,
    feeFullTime: 25,
    feePartTime: null,
    hasRegistrationWindow: true,
    registrationIsOpen: true,
    matchSchedulingFormat: null,
    groupCount: 0,
    knockoutTeamCount: null,
    hasKnockoutBracket: false,
    canGenerateKnockout: false,
    groups: [],
    teams: [],
    myTeamId: null,
    registrationVerificationComplete: false,
    canViewRegisteredPlayersList: true,
    canViewFavouritePlayers: false,
    canRegisterForLeatherTournament: false,
    canRegisterForTennisTournament: false,
    canManageLeatherInvites: false,
    canEdit: true,
    canScheduleMatches: true,
    viewerLeaderTeamIds: [],
    canUploadSkillVideo: false,
    hasSkillVideo: false,
    canUploadPlayerVideo: false,
    hasPlayerVideo: false,
    canManageTournamentScorers: false,
    tournamentScorerCount: 0,
    ...overrides,
  };
}

const rowsOf = (sections: DetailSection[]): Record<string, string | string[]> =>
  Object.fromEntries(sections.flatMap((s) => s.rows.map((r) => [r.label, r.value])));

describe('tournament details', () => {
  it('formats calendar days without shifting across timezones', () => {
    expect(formatCalendarDay('2026-10-20')).toBe('Tue, Oct 20, 2026');
  });

  it('shows tennis APL values grouped like the form', () => {
    const sections = buildTournamentDetailSections(detail());
    expect(sections.map((s) => s.title)).toEqual([
      'Tournament',
      'Schedule & venue',
      'Teams',
      'Registration & fees',
      'Tennis options',
    ]);
    const rows = rowsOf(sections);
    expect(rows['Tournament Dates']).toEqual(['Tue, Oct 20, 2026', 'Wed, Oct 21, 2026']);
    expect(rows['Tournament Type']).toBe('APL');
    expect(rows['Knockout Teams']).toBe('Not set');
    expect(rows['Registration Open']).toBe('Oct 1, 2026, 9:30 a.m.');
    expect(rows['Tournament Fees']).toBe('$25.00');
    expect(rows['Auction Date']).toBe('Not set');
    expect(rows['Impact Player']).toBe('Yes');
    expect(rows['Upload Start']).toBeUndefined();
  });

  it('lists centers and video window only when set', () => {
    const rows = rowsOf(
      buildTournamentDetailSections(
        detail({
          type: TournamentType.Center,
          scopeDisplay: {
            citySelection: CitySelection.Multi,
            provinceName: 'Ontario',
            centerNames: ['Toronto', 'Brampton'],
            centerIds: ['a', 'b'],
          },
          videoRequired: true,
          videoUploadStartAt: '2026-10-02T13:00:00.000Z',
          videoUploadEndDate: null,
        }),
      ),
    );
    expect(rows['Centers']).toEqual(['Toronto', 'Brampton']);
    expect(rows['Knockout Teams']).toBe('Not set');
    expect(rows['Upload Start']).toBe('Oct 2, 2026, 9:00 a.m.');
    expect(rows['Upload End']).toBe('Not set');
  });

  it('shows leather from/end dates and both fees, no tennis options', () => {
    const sections = buildTournamentDetailSections(
      detail({
        type: TournamentType.ACC,
        ballType: BallType.Leather,
        dates: ['2026-10-20', '2026-10-22', '2026-10-21'],
        hasRegistrationWindow: false,
        registrationOpenAt: null,
        registrationCloseAt: null,
        feeFullTime: 100,
        feePartTime: null,
        playersPerTeam: null,
      }),
    );
    const rows = rowsOf(sections);
    expect(sections.some((s) => s.title === 'Tennis options')).toBe(false);
    expect(rows['From Date']).toBe('Tue, Oct 20, 2026');
    expect(rows['End Date']).toBe('Thu, Oct 22, 2026');
    expect(rows['Location']).toBeUndefined();
    expect(rows['Registration Window']).toBe('Not set');
    expect(rows['Full-time Player Fees']).toBe('$100.00');
    expect(rows['Part-time Player Fees']).toBe('Not set');
    expect(rows['Players per Team']).toBe('Not set');
  });
});
