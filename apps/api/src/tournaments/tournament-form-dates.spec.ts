import {
  BallType,
  resolveTournamentFormDates,
  TournamentType,
  validateUpdateTournamentForm,
} from '@acc/types';

describe('tournament form dates', () => {
  it('normalizes tennis multi-select days for validation and submit', () => {
    expect(
      resolveTournamentFormDates({
        ballType: BallType.Tennis,
        tournamentDates: ['2026-07-12', '2026-07-06', '2026-07-06', 'bad', ''],
        leatherFromDate: '',
        leatherEndDate: '',
      }),
    ).toEqual(['2026-07-06', '2026-07-12']);
  });

  it('accepts hydrated tennis dates on edit without re-tapping', () => {
    const errors = validateUpdateTournamentForm({
      hasPoster: true,
      name: 'APL 2026',
      year: '2026',
      tournamentDates: ['2026-07-06', '2026-07-07', '2026-07-10', '2026-07-11', '2026-07-12'],
      leatherFromDate: '',
      leatherEndDate: '',
      ballType: BallType.Tennis,
      citySelection: null,
      tournamentProvinceId: 'province-1',
      selectedCenterIds: [],
      numberOfTeams: '8',
      playersPerTeam: '',
      hasRegistrationWindow: false,
      registrationOpenDate: '',
      registrationOpenTime: '',
      registrationCloseDate: '',
      registrationCloseTime: '',
      hasAuctionDate: false,
      auctionDate: '',
      videoRequired: false,
      videoUploadEndDate: '',
      minTeamCount: 0,
      datesWithMatches: [],
      tournamentType: TournamentType.APL,
      groupCount: 2,
      knockoutTeamCount: null,
      hasKnockoutBracket: false,
    });

    expect(errors.tournamentDates).toBeUndefined();
  });

  it('still blocks an empty resolved selection', () => {
    const errors = validateUpdateTournamentForm({
      hasPoster: true,
      name: 'APL 2026',
      year: '2026',
      tournamentDates: [],
      leatherFromDate: '',
      leatherEndDate: '',
      ballType: BallType.Tennis,
      citySelection: null,
      tournamentProvinceId: 'province-1',
      selectedCenterIds: [],
      numberOfTeams: '8',
      playersPerTeam: '',
      hasRegistrationWindow: false,
      registrationOpenDate: '',
      registrationOpenTime: '',
      registrationCloseDate: '',
      registrationCloseTime: '',
      hasAuctionDate: false,
      auctionDate: '',
      videoRequired: false,
      videoUploadEndDate: '',
      minTeamCount: 0,
      datesWithMatches: [],
      tournamentType: TournamentType.APL,
      groupCount: 2,
      knockoutTeamCount: null,
      hasKnockoutBracket: false,
    });

    expect(errors.tournamentDates).toBe('Select at least one tournament date');
  });
});
