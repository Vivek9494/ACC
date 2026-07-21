import {
  BallType,
  CitySelection,
  resolveTournamentFormDates,
  TournamentType,
  validateCreateTournamentForm,
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
      videoUploadStartDate: '',
      videoUploadStartTime: '',
      videoUploadEndDate: '',
      videoUploadEndTime: '',
      locationAddress: 'Central Ground, Toronto',
      latitude: 43.6532,
      longitude: -79.3832,
      minTeamCount: 0,
      datesWithMatches: [],
      tournamentType: TournamentType.APL,
      groupCount: 2,
      knockoutTeamCount: null,
      hasKnockoutBracket: false,
    });

    expect(errors.tournamentDates).toBeUndefined();
  });

  it('accepts unchanged past leather from date on edit when end date is future', () => {
    const errors = validateUpdateTournamentForm({
      hasPoster: true,
      name: 'ACC 2026',
      year: '2026',
      tournamentDates: [],
      leatherFromDate: '2026-07-03',
      leatherEndDate: '2026-10-29',
      ballType: BallType.Leather,
      citySelection: null,
      tournamentProvinceId: 'province-1',
      selectedCenterIds: [],
      numberOfTeams: '4',
      playersPerTeam: '',
      hasRegistrationWindow: false,
      registrationOpenDate: '',
      registrationOpenTime: '',
      registrationCloseDate: '',
      registrationCloseTime: '',
      hasAuctionDate: false,
      auctionDate: '',
      videoRequired: false,
      videoUploadStartDate: '',
      videoUploadStartTime: '',
      videoUploadEndDate: '',
      videoUploadEndTime: '',
      venueTimezone: 'America/Toronto',
      initialLeatherFromDate: '2026-07-03',
      initialLeatherEndDate: '2026-10-29',
      minTeamCount: 0,
      datesWithMatches: [],
      tournamentType: TournamentType.ACC,
      groupCount: 0,
      knockoutTeamCount: null,
      hasKnockoutBracket: false,
    });

    expect(errors.leatherFromDate).toBeUndefined();
    expect(errors.leatherEndDate).toBeUndefined();
    expect(errors.tournamentDates).toBeUndefined();
  });

  it('attributes end-before-from to the end date field', () => {
    const errors = validateUpdateTournamentForm({
      hasPoster: true,
      name: 'ACC 2026',
      year: '2026',
      tournamentDates: [],
      leatherFromDate: '2026-10-29',
      leatherEndDate: '2026-07-03',
      ballType: BallType.Leather,
      citySelection: null,
      tournamentProvinceId: 'province-1',
      selectedCenterIds: [],
      numberOfTeams: '4',
      playersPerTeam: '',
      hasRegistrationWindow: false,
      registrationOpenDate: '',
      registrationOpenTime: '',
      registrationCloseDate: '',
      registrationCloseTime: '',
      hasAuctionDate: false,
      auctionDate: '',
      videoRequired: false,
      videoUploadStartDate: '',
      videoUploadStartTime: '',
      videoUploadEndDate: '',
      videoUploadEndTime: '',
      venueTimezone: 'America/Toronto',
      initialLeatherFromDate: '2026-10-29',
      initialLeatherEndDate: '2026-07-03',
      minTeamCount: 0,
      datesWithMatches: [],
      tournamentType: TournamentType.ACC,
      groupCount: 0,
      knockoutTeamCount: null,
      hasKnockoutBracket: false,
    });

    expect(errors.leatherEndDate).toBe('End date must be on or after from date');
    expect(errors.leatherFromDate).toBeUndefined();
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
      videoUploadStartDate: '',
      videoUploadStartTime: '',
      videoUploadEndDate: '',
      videoUploadEndTime: '',
      locationAddress: 'Central Ground, Toronto',
      latitude: 43.6532,
      longitude: -79.3832,
      minTeamCount: 0,
      datesWithMatches: [],
      tournamentType: TournamentType.APL,
      groupCount: 2,
      knockoutTeamCount: null,
      hasKnockoutBracket: false,
    });

    expect(errors.tournamentDates).toBe('Select at least one tournament date');
  });

  it('requires tournament location for tennis create', () => {
    const errors = validateCreateTournamentForm({
      hasPoster: true,
      name: 'APL 2026',
      year: '2026',
      tournamentDates: ['2026-07-06'],
      leatherFromDate: '',
      leatherEndDate: '',
      ballType: BallType.Tennis,
      citySelection: CitySelection.Apl,
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
      videoUploadStartDate: '',
      videoUploadStartTime: '',
      videoUploadEndDate: '',
      videoUploadEndTime: '',
      locationAddress: '',
      latitude: null,
      longitude: null,
    });

    expect(errors.tournamentLocation).toBe('Tournament location is required');
  });

  it('allows leather create without tournament location', () => {
    const errors = validateCreateTournamentForm({
      hasPoster: true,
      name: 'ACC 2026',
      year: '2026',
      tournamentDates: [],
      leatherFromDate: '2026-10-01',
      leatherEndDate: '2026-10-29',
      ballType: BallType.Leather,
      citySelection: null,
      tournamentProvinceId: 'province-1',
      selectedCenterIds: [],
      numberOfTeams: '4',
      playersPerTeam: '',
      hasRegistrationWindow: false,
      registrationOpenDate: '',
      registrationOpenTime: '',
      registrationCloseDate: '',
      registrationCloseTime: '',
      hasAuctionDate: false,
      auctionDate: '',
      videoRequired: false,
      videoUploadStartDate: '',
      videoUploadStartTime: '',
      videoUploadEndDate: '',
      videoUploadEndTime: '',
      locationAddress: '',
      latitude: null,
      longitude: null,
    });

    expect(errors.tournamentLocation).toBeUndefined();
  });

  it('allows leather edit without tournament location', () => {
    const errors = validateUpdateTournamentForm({
      hasPoster: true,
      name: 'ACC 2026',
      year: '2026',
      tournamentDates: [],
      leatherFromDate: '2026-07-03',
      leatherEndDate: '2026-10-29',
      ballType: BallType.Leather,
      citySelection: null,
      tournamentProvinceId: 'province-1',
      selectedCenterIds: [],
      numberOfTeams: '4',
      playersPerTeam: '',
      hasRegistrationWindow: false,
      registrationOpenDate: '',
      registrationOpenTime: '',
      registrationCloseDate: '',
      registrationCloseTime: '',
      hasAuctionDate: false,
      auctionDate: '',
      videoRequired: false,
      videoUploadStartDate: '',
      videoUploadStartTime: '',
      videoUploadEndDate: '',
      videoUploadEndTime: '',
      venueTimezone: 'America/Toronto',
      initialLeatherFromDate: '2026-07-03',
      initialLeatherEndDate: '2026-10-29',
      minTeamCount: 0,
      datesWithMatches: [],
      tournamentType: TournamentType.ACC,
      groupCount: 0,
      knockoutTeamCount: null,
      hasKnockoutBracket: false,
      locationAddress: 'Stale leather ground',
      latitude: 43.1,
      longitude: -79.1,
    });

    expect(errors.tournamentLocation).toBeUndefined();
  });

  it('requires full video upload window when video is required', () => {
    const errors = validateCreateTournamentForm({
      hasPoster: true,
      name: 'APL 2026',
      year: '2026',
      tournamentDates: ['2026-07-06'],
      leatherFromDate: '',
      leatherEndDate: '',
      ballType: BallType.Tennis,
      citySelection: CitySelection.Apl,
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
      videoRequired: true,
      videoUploadStartDate: '',
      videoUploadStartTime: '',
      videoUploadEndDate: '',
      videoUploadEndTime: '',
    });

    expect(errors.videoUploadStartDate).toBe('Upload start date is required');
    expect(errors.videoUploadEndTime).toBe('Upload end time is required');
  });

  it('requires upload end after upload start', () => {
    const errors = validateCreateTournamentForm({
      hasPoster: true,
      name: 'APL 2026',
      year: '2026',
      tournamentDates: ['2026-07-06'],
      leatherFromDate: '',
      leatherEndDate: '',
      ballType: BallType.Tennis,
      citySelection: CitySelection.Apl,
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
      videoRequired: true,
      videoUploadStartDate: '2026-07-10',
      videoUploadStartTime: '14:00',
      videoUploadEndDate: '2026-07-10',
      videoUploadEndTime: '10:00',
    });

    expect(errors.videoUploadEndDate).toBe('Upload end must be after upload start');
  });
});
