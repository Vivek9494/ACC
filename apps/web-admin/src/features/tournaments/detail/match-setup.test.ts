import {
  BallType,
  HomeAway,
  MATCH_SETUP_FORM_MESSAGES as M,
  MatchSchedulingFormat,
  MatchState,
  MatchType,
  TournamentType,
  normalizeTeamPairKey,
  type MatchListItem,
} from '@acc/types';
import { describe, expect, it } from 'vitest';

import {
  canDeleteMatch,
  canEditMatch,
  emptyMatchSetup,
  roundRobinBlockedOpponents,
  serverMatchErrors,
  showGroupFieldFor,
  toMatchRequest,
  validateMatchSetup,
  withOvers,
  type MatchSetupContext,
  type MatchSetupValues,
} from './match-setup';

const FUTURE = `${new Date().getFullYear() + 1}-06-10`;

const ctx = (overrides: Partial<MatchSetupContext> = {}): MatchSetupContext => ({
  ballType: BallType.Tennis,
  format: MatchSchedulingFormat.Manual,
  showGroupField: false,
  existingPairKeys: [],
  isEdit: false,
  initialMatchDate: null,
  timezone: 'America/Toronto',
  ...overrides,
});

const valid = (overrides: Partial<MatchSetupValues> = {}): MatchSetupValues => ({
  ...emptyMatchSetup(MatchSchedulingFormat.Manual),
  matchType: MatchType.LeagueMatch,
  teamAId: 'a',
  teamBId: 'b',
  oversPerInnings: 10,
  maxOversPerBowler: 2,
  matchDate: FUTURE,
  matchTime: '09:30',
  ...overrides,
});

describe('match setup form', () => {
  it('defaults match type from the scheduling format', () => {
    expect(emptyMatchSetup(MatchSchedulingFormat.Manual).matchType).toBeNull();
    expect(emptyMatchSetup(MatchSchedulingFormat.RoundRobin).matchType).toBe(MatchType.LeagueMatch);
  });

  it('requires the mobile fields', () => {
    const errors = validateMatchSetup(emptyMatchSetup(MatchSchedulingFormat.Manual), ctx());
    expect(errors).toMatchObject({
      matchType: M.matchType.required,
      teamAId: M.teamA.required,
      teamBId: M.teamB.required,
      oversPerInnings: M.overs.required,
      maxOversPerBowler: M.oversPerBowler.required,
      matchDate: M.matchDate.required,
      matchTime: M.matchTime.required,
    });
    expect(validateMatchSetup(valid(), ctx())).toEqual({});
  });

  it('rejects same teams, duplicate round-robin pairs, and past dates (except the saved one on edit)', () => {
    expect(validateMatchSetup(valid({ teamBId: 'a' }), ctx()).teamBId).toBe(
      M.teamsDistinct.duplicate,
    );
    const rr = ctx({
      format: MatchSchedulingFormat.RoundRobin,
      existingPairKeys: [normalizeTeamPairKey('a', 'b')],
    });
    expect(validateMatchSetup(valid(), rr).teamBId).toBe(M.duplicatePairing.duplicate);
    expect(validateMatchSetup(valid(), { ...rr, isEdit: true }).teamBId).toBeUndefined();
    expect(validateMatchSetup(valid({ matchDate: '2020-01-01' }), ctx()).matchDate).toBe(
      M.matchDate.past,
    );
    expect(
      validateMatchSetup(
        valid({ matchDate: '2020-01-01' }),
        ctx({ isEdit: true, initialMatchDate: '2020-01-01' }),
      ).matchDate,
    ).toBeUndefined();
  });

  it('leather needs a pinned ground and an external name unless the opponent is an ACC team', () => {
    const leather = ctx({ ballType: BallType.Leather });
    const errors = validateMatchSetup(valid({ teamBId: null }), leather);
    expect(errors.externalOpponentName).toBe(M.externalOpponentName.required);
    expect(errors.groundLocation).toBe(M.ground.required);
    expect(validateMatchSetup(valid({ groundAddress: 'Park' }), leather).groundLocation).toBe(
      M.coordinates.required,
    );
    expect(
      validateMatchSetup(valid({ opponentIsAccTeam: true, teamBId: null }), leather).teamBId,
    ).toBe(M.teamB.required);
  });

  it('builds the mobile request body', () => {
    const tennis = toMatchRequest(valid({ powerplayOvers: 3, battingPowerplayOvers: 2 }), ctx());
    expect(tennis).toMatchObject({
      homeTeamId: 'a',
      awayTeamId: 'b',
      externalOpponentName: null,
      groupId: null,
      oversPerInnings: 10,
      powerplayOvers: 3,
      battingPowerplayOvers: 2,
      matchDate: FUTURE,
    });
    expect(tennis.startTime).toBe(new Date(`${FUTURE}T09:30:00`).toISOString());
    expect(tennis).not.toHaveProperty('groundLocation');

    const leather = toMatchRequest(
      valid({
        teamBExternalName: ' Strikers ',
        groundAddress: 'Park',
        groundLat: 43.7,
        groundLng: -79.4,
        homeAway: HomeAway.Home,
        reportingTime: '08:45',
        battingPowerplayOvers: 2,
      }),
      ctx({ ballType: BallType.Leather }),
    );
    expect(leather).toMatchObject({
      awayTeamId: null,
      externalOpponentName: 'Strikers',
      groundLocation: 'Park',
      geofenceLat: 43.7,
      homeAway: HomeAway.Home,
    });
    expect(leather.reportingTime).toBe(new Date(`${FUTURE}T08:45:00`).toISOString());
    expect(leather).not.toHaveProperty('battingPowerplayOvers');
  });

  it('resets dependent overs and filters already-paired opponents', () => {
    const next = withOvers(valid({ powerplayOvers: 8, battingPowerplayOvers: 3 }), 5);
    expect(next).toMatchObject({
      oversPerInnings: 5,
      maxOversPerBowler: null,
      powerplayOvers: null,
      battingPowerplayOvers: 3,
    });
    const keys = [normalizeTeamPairKey('a', 'b'), normalizeTeamPairKey('c', 'a')];
    expect([...roundRobinBlockedOpponents('a', keys, null)].sort()).toEqual(['b', 'c']);
    expect([...roundRobinBlockedOpponents('a', keys, normalizeTeamPairKey('a', 'b'))]).toEqual([
      'c',
    ]);
  });

  it('shows the group picker only for group-capable, non-knockout, non-round-robin fixtures', () => {
    const apl = { type: TournamentType.APL, matchSchedulingFormat: null, groupCount: 2 };
    expect(showGroupFieldFor(apl, MatchSchedulingFormat.Manual, MatchType.LeagueMatch)).toBe(true);
    expect(showGroupFieldFor(apl, MatchSchedulingFormat.Manual, MatchType.Final)).toBe(false);
    expect(showGroupFieldFor(apl, MatchSchedulingFormat.RoundRobin, null)).toBe(false);
  });

  it('maps server field errors and hides group errors on knockout fixtures', () => {
    expect(serverMatchErrors({ teamBId: 'Taken', other: 'x' }, MatchType.LeagueMatch)).toEqual({
      teamBId: 'Taken',
    });
    expect(serverMatchErrors({ groupId: 'Required' }, MatchType.Final)).toEqual({});
  });

  it('offers edit / delete only on upcoming fixtures the API allows', () => {
    const row = (state: MatchListItem['state'], flags: Partial<MatchListItem> = {}) => ({
      state,
      canEdit: true,
      canDelete: true,
      isDeleted: false,
      ...flags,
    });
    expect(canEditMatch(row(MatchState.Scheduled))).toBe(true);
    expect(canDeleteMatch(row(MatchState.Scheduled))).toBe(true);
    for (const state of [MatchState.Live, MatchState.Completed, MatchState.Cancelled]) {
      expect(canEditMatch(row(state))).toBe(false);
      expect(canDeleteMatch(row(state))).toBe(false);
    }
    expect(canEditMatch(row(MatchState.Scheduled, { canEdit: false }))).toBe(false);
    expect(canDeleteMatch(row(MatchState.Scheduled, { canDelete: undefined }))).toBe(false);
  });
});
