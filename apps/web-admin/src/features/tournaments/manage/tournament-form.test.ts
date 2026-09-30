import {
  APP_SHORT_NAME,
  BallType,
  CitySelection,
  DEFAULT_SUBSTITUTES_ALLOWED,
  DEFAULT_TOURNAMENT_FORMAT,
  TOURNAMENT_FORM_MESSAGES,
  TournamentDisplayStatus,
  TournamentState,
  TournamentType,
  combineLocalDateAndTimeToIso,
  splitIsoToLocalDateAndTime,
  type TournamentEditFormData,
} from '@acc/types';
import { describe, expect, it } from 'vitest';

import { deleteTournamentDescription } from './DeleteTournamentDialog';
import {
  emptyTournamentForm,
  hydrateTournamentForm,
  numberOfTeamsOptions,
  scopeLabelFor,
  serverFieldErrors,
  toCreateTournamentRequest,
  toUpdateTournamentRequest,
  validateTournamentForm,
  withBallType,
  withProvince,
  withScope,
  yearOptions,
  type TournamentFormValues,
} from './tournament-form';

const FUTURE_YEAR = new Date().getFullYear() + 1;
const day = (d: number): string => `${FUTURE_YEAR}-06-${String(d).padStart(2, '0')}`;

function editData(overrides: Partial<TournamentEditFormData> = {}): TournamentEditFormData {
  return {
    id: 't1',
    name: 'Summer APL',
    year: FUTURE_YEAR,
    type: TournamentType.APL,
    state: TournamentState.RegistrationOpen,
    displayStatus: TournamentDisplayStatus.Upcoming,
    ballType: BallType.Tennis,
    posterUrl: 'https://cdn.example/poster.jpg',
    startAt: `${day(10)}T00:00:00.000Z`,
    endAt: `${day(12)}T00:00:00.000Z`,
    locationAddress: 'Main Ground, Toronto',
    latitude: 43.7,
    longitude: -79.4,
    provinceId: 'on',
    scopeDisplay: {
      citySelection: CitySelection.Apl,
      provinceName: 'Ontario',
      centerNames: ['A', 'B'],
      centerIds: ['a', 'b'],
    },
    timezone: 'America/Toronto',
    teamCount: 4,
    dates: [day(10), day(12)],
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
    registrationOpenAt: combineLocalDateAndTimeToIso(day(1), '09:30'),
    registrationCloseAt: combineLocalDateAndTimeToIso(day(5), '18:00'),
    auctionAt: null,
    feeFullTime: 2500,
    feePartTime: null,
    hasRegistrationWindow: true,
    registrationIsOpen: true,
    matchSchedulingFormat: null,
    groupCount: 2,
    knockoutTeamCount: 4,
    hasKnockoutBracket: false,
    canGenerateKnockout: false,
    groups: [],
    teams: [],
    myTeamId: null,
    registrationVerificationComplete: false,
    canViewRegisteredPlayersList: true,
    canViewFavouritePlayers: true,
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
    datesWithMatches: [day(10)],
    ...overrides,
  };
}

function validTennisCreate(): TournamentFormValues {
  return {
    ...emptyTournamentForm(FUTURE_YEAR),
    name: '  Fall Cup ',
    ballType: BallType.Tennis,
    tournamentDates: [day(20), day(21)],
    provinceId: 'on',
    citySelection: CitySelection.Multi,
    centerIds: ['a', 'b'],
    locationAddress: 'Main Ground',
    latitude: 43.7,
    longitude: -79.4,
    numberOfTeams: '6',
    playersPerTeam: '12',
    feeFullTime: '25.50',
  };
}

describe('splitIsoToLocalDateAndTime', () => {
  it('round-trips combineLocalDateAndTimeToIso in local time', () => {
    const iso = combineLocalDateAndTimeToIso('2027-03-04', '07:05');
    expect(splitIsoToLocalDateAndTime(iso)).toEqual({ date: '2027-03-04', time: '07:05' });
  });

  it('returns blanks for missing or invalid values', () => {
    expect(splitIsoToLocalDateAndTime(null)).toEqual({ date: '', time: '' });
    expect(splitIsoToLocalDateAndTime('nope')).toEqual({ date: '', time: '' });
  });
});

describe('select options', () => {
  it('offers last year through two years ahead', () => {
    expect(yearOptions(new Date(2026, 5, 1))).toEqual(['2025', '2026', '2027', '2028']);
  });

  it('never offers fewer teams than already exist', () => {
    expect(numberOfTeamsOptions()[0]).toBe('2');
    expect(numberOfTeamsOptions(5)[0]).toBe('5');
    expect(numberOfTeamsOptions().at(-1)).toBe('30');
  });
});

describe('field resets (mobile parity)', () => {
  it('switching to leather clears dates, scope and every tennis-only field', () => {
    const next = withBallType(
      {
        ...validTennisCreate(),
        hasAuctionDate: true,
        auctionDate: day(2),
        impactPlayerEnabled: true,
        videoRequired: true,
      },
      BallType.Leather,
    );
    expect(next).toMatchObject({
      ballType: BallType.Leather,
      tournamentDates: [],
      citySelection: null,
      centerIds: [],
      hasAuctionDate: false,
      auctionDate: '',
      impactPlayerEnabled: false,
      videoRequired: false,
      locationAddress: '',
      latitude: null,
      longitude: null,
    });
  });

  it('switching to tennis clears the part-time fee and leather span', () => {
    const next = withBallType(
      {
        ...emptyTournamentForm(),
        ballType: BallType.Leather,
        feePartTime: '10',
        leatherFromDate: day(1),
        leatherEndDate: day(3),
      },
      BallType.Tennis,
    );
    expect(next).toMatchObject({ feePartTime: '', leatherFromDate: '', leatherEndDate: '' });
  });

  it('changing province clears the scope and centers', () => {
    expect(withProvince(validTennisCreate(), 'bc')).toMatchObject({
      provinceId: 'bc',
      citySelection: null,
      tournamentTypeDefinitionId: null,
      centerIds: [],
    });
  });

  it('picking a catalog type selects APL with its centers; Multi-centers starts empty', () => {
    const catalog = [
      {
        id: 'type1',
        code: 'APL',
        name: 'Ontario APL',
        provinceId: 'on',
        ballType: BallType.Tennis,
        centerIds: ['a', 'b', 'c'],
      },
    ];
    expect(withScope(validTennisCreate(), 'type1', catalog)).toMatchObject({
      citySelection: CitySelection.Apl,
      tournamentTypeDefinitionId: 'type1',
      centerIds: ['a', 'b', 'c'],
    });
    expect(withScope(validTennisCreate(), CitySelection.Multi, catalog)).toMatchObject({
      citySelection: CitySelection.Multi,
      tournamentTypeDefinitionId: null,
      centerIds: [],
    });
  });
});

describe('validateTournamentForm', () => {
  it('uses the shared create rules', () => {
    const errors = validateTournamentForm(emptyTournamentForm(), false, null);
    expect(errors.poster).toBe(TOURNAMENT_FORM_MESSAGES.poster.required);
    expect(errors.name).toBe(TOURNAMENT_FORM_MESSAGES.name.required);
    expect(errors.ballType).toBe(TOURNAMENT_FORM_MESSAGES.ballType.required);
  });

  it('passes a complete tennis tournament', () => {
    expect(
      Object.values(validateTournamentForm(validTennisCreate(), true, null)).filter(Boolean),
    ).toEqual([]);
  });

  it('requires pinned coordinates for a tennis venue', () => {
    const errors = validateTournamentForm(
      { ...validTennisCreate(), latitude: null, longitude: null },
      true,
      null,
    );
    expect(errors.tournamentLocation).toBeTruthy();
  });

  it('on edit, blocks removing a day that already has matches', () => {
    const { values, context } = hydrateTournamentForm(editData());
    const errors = validateTournamentForm({ ...values, tournamentDates: [day(12)] }, true, context);
    expect(errors.tournamentDates).toBeTruthy();
  });
});

describe('hydrateTournamentForm', () => {
  it('pre-fills every editable field and the locked context', () => {
    const { values, context } = hydrateTournamentForm(editData());
    expect(values).toMatchObject({
      name: 'Summer APL',
      year: String(FUTURE_YEAR),
      ballType: BallType.Tennis,
      tournamentDates: [day(10), day(12)],
      numberOfTeams: '8',
      playersPerTeam: '14',
      knockoutTeamCount: '4',
      hasRegistrationWindow: true,
      registrationOpenDate: day(1),
      registrationOpenTime: '09:30',
      registrationCloseDate: day(5),
      registrationCloseTime: '18:00',
      feeFullTime: '2500',
      impactPlayerEnabled: true,
      hasAuctionDate: false,
    });
    expect(context).toMatchObject({
      tournamentType: TournamentType.APL,
      minTeamCount: 4,
      datesWithMatches: [day(10)],
      groupCount: 2,
      scopeLabel: 'APL',
      centerNames: ['A', 'B'],
    });
  });

  it('turns leather dates into a from/end span', () => {
    const { values } = hydrateTournamentForm(
      editData({
        ballType: BallType.Leather,
        type: TournamentType.ACC,
        dates: [day(1), day(2), day(3)],
      }),
    );
    expect(values).toMatchObject({
      leatherFromDate: day(1),
      leatherEndDate: day(3),
      tournamentDates: [],
    });
  });

  it('labels the locked scope like mobile', () => {
    expect(scopeLabelFor(editData({ ballType: BallType.Leather, type: TournamentType.ACC }))).toBe(
      `Leather Ball (${APP_SHORT_NAME})`,
    );
    expect(
      scopeLabelFor(
        editData({
          type: TournamentType.Center,
          scopeDisplay: {
            citySelection: CitySelection.Multi,
            provinceName: null,
            centerNames: [],
            centerIds: [],
          },
        }),
      ),
    ).toBe('Multi-centers');
  });
});

describe('payloads', () => {
  it('builds the create request like mobile (multi-centers tennis)', () => {
    const body = toCreateTournamentRequest(validTennisCreate(), 'tournament-posters/abc.jpg');
    expect(body).toMatchObject({
      name: 'Fall Cup',
      year: FUTURE_YEAR,
      posterUrl: 'tournament-posters/abc.jpg',
      ballType: BallType.Tennis,
      maxOversPerBowler: 4,
      numberOfTeams: 6,
      playersPerTeam: 12,
      substitutesAllowed: DEFAULT_SUBSTITUTES_ALLOWED,
      format: DEFAULT_TOURNAMENT_FORMAT,
      dates: [day(20), day(21)],
      provinceId: 'on',
      citySelection: CitySelection.Multi,
      centerIds: ['a', 'b'],
      locationAddress: 'Main Ground',
      latitude: 43.7,
      longitude: -79.4,
      feeFullTime: 25.5,
      feePartTime: null,
      registrationOpenAt: null,
      auctionAt: null,
    });
    expect(body).not.toHaveProperty('tournamentTypeDefinitionId');
    expect(body.knockoutTeamCount).toBeNull();
  });

  it('APL create sends the type definition and knockout size', () => {
    const body = toCreateTournamentRequest(
      {
        ...validTennisCreate(),
        citySelection: CitySelection.Apl,
        tournamentTypeDefinitionId: 'type1',
        knockoutTeamCount: '4',
      },
      'k',
    );
    expect(body).toMatchObject({
      citySelection: CitySelection.Apl,
      tournamentTypeDefinitionId: 'type1',
      knockoutTeamCount: 4,
    });
    expect(body).not.toHaveProperty('centerIds');
  });

  it('leather create nulls venue and tennis options, keeps both fees', () => {
    const body = toCreateTournamentRequest(
      {
        ...emptyTournamentForm(FUTURE_YEAR),
        name: 'ACC League',
        ballType: BallType.Leather,
        leatherFromDate: day(1),
        leatherEndDate: day(3),
        provinceId: 'on',
        numberOfTeams: '4',
        feeFullTime: '100',
        feePartTime: '50',
      },
      'k',
    );
    expect(body).toMatchObject({
      ballType: BallType.Leather,
      maxOversPerBowler: 5,
      dates: [day(1), day(3)],
      locationAddress: null,
      latitude: null,
      impactPlayerEnabled: false,
      videoRequired: false,
      feeFullTime: 100,
      feePartTime: 50,
    });
    expect(body).not.toHaveProperty('citySelection');
  });

  it('update never sends locked fields and keeps the poster unless replaced', () => {
    const { values, context } = hydrateTournamentForm(editData());
    const body = toUpdateTournamentRequest({ ...values, name: 'Renamed' }, context, null);
    expect(body).toMatchObject({ name: 'Renamed', provinceId: 'on', knockoutTeamCount: 4 });
    for (const locked of [
      'year',
      'ballType',
      'citySelection',
      'centerIds',
      'tournamentTypeDefinitionId',
      'posterUrl',
    ]) {
      expect(body).not.toHaveProperty(locked);
    }
    expect(toUpdateTournamentRequest(values, context, 'new-key')).toHaveProperty(
      'posterUrl',
      'new-key',
    );
  });

  it('update omits knockout size once a bracket exists', () => {
    const { values, context } = hydrateTournamentForm(editData({ hasKnockoutBracket: true }));
    expect(toUpdateTournamentRequest(values, context, null)).not.toHaveProperty(
      'knockoutTeamCount',
    );
  });
});

describe('server errors and delete copy', () => {
  it('maps API field names onto form fields', () => {
    expect(serverFieldErrors({ provinceId: 'Pick a province' }).province).toBe('Pick a province');
  });

  it('warns when deleting a live or completed tournament', () => {
    expect(
      deleteTournamentDescription({
        id: 't',
        name: 'X',
        displayStatus: TournamentDisplayStatus.Live,
      }),
    ).toMatch(/LIVE/);
    expect(
      deleteTournamentDescription({
        id: 't',
        name: 'X',
        displayStatus: TournamentDisplayStatus.Completed,
      }),
    ).toMatch(/completed/);
    expect(
      deleteTournamentDescription({
        id: 't',
        name: 'X',
        displayStatus: TournamentDisplayStatus.Upcoming,
      }),
    ).toMatch(/notified/);
  });
});
