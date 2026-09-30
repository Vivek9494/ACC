import {
  BallType,
  DEFAULT_VENUE_TIMEZONE,
  MATCH_SETUP_FORM_MESSAGES,
  MatchSchedulingFormat,
  calendarDateFromUtcMidnightIso,
  clampPowerplaySelection,
  combineLocalDateAndTimeToIso,
  defaultMatchTypeForSchedulingFormat,
  isDateOnlyBeforeTodayInZone,
  isKnockoutMatchType,
  isUpcomingMatchForScheduleManagement,
  normalizeTeamPairKey,
  splitIsoToLocalDateAndTime,
  tournamentSupportsGroups,
  validateBattingPowerplayOvers,
  validatePowerplayOvers,
  type CreateMatchRequest,
  type HomeAway,
  type MatchDetail,
  type MatchListItem,
  type MatchType,
  type TournamentDetail,
} from '@acc/types';

/** Mobile Match Setup (`tournaments/[id]/_impl/match-setup.tsx`) form state. */
export interface MatchSetupValues {
  matchType: MatchType | null;
  groupId: string | null;
  teamAId: string | null;
  teamBId: string | null;
  /** Leather only: opponent is another team in this tournament rather than an external side. */
  opponentIsAccTeam: boolean;
  teamBExternalName: string;
  homeAway: HomeAway | null;
  groundAddress: string;
  groundLat: number | null;
  groundLng: number | null;
  oversPerInnings: number | null;
  maxOversPerBowler: number | null;
  powerplayOvers: number | null;
  battingPowerplayOvers: number | null;
  /** YYYY-MM-DD */
  matchDate: string;
  /** HH:mm, browser-local like mobile's device-local picker. */
  matchTime: string;
  reportingTime: string;
}

export type MatchSetupField =
  | 'matchType'
  | 'groupId'
  | 'teamAId'
  | 'teamBId'
  | 'externalOpponentName'
  | 'groundLocation'
  | 'oversPerInnings'
  | 'maxOversPerBowler'
  | 'powerplayOvers'
  | 'battingPowerplayOvers'
  | 'matchDate'
  | 'matchTime'
  | 'reportingTime';

export type MatchSetupErrors = Partial<Record<MatchSetupField, string>>;

export const MATCH_SETUP_FIELDS: readonly MatchSetupField[] = [
  'matchType',
  'groupId',
  'teamAId',
  'teamBId',
  'externalOpponentName',
  'groundLocation',
  'oversPerInnings',
  'maxOversPerBowler',
  'powerplayOvers',
  'battingPowerplayOvers',
  'matchDate',
  'matchTime',
  'reportingTime',
];

export interface MatchSetupContext {
  ballType: BallType;
  format: MatchSchedulingFormat;
  /** Group picker applies (group-capable tournament, not round robin, not a knockout fixture). */
  showGroupField: boolean;
  /** Round robin: pairings already scheduled (`teamId:teamId`). */
  existingPairKeys: readonly string[];
  isEdit: boolean;
  /** Saved date on edit — an unchanged past date stays valid. */
  initialMatchDate: string | null;
  timezone: string;
}

export const isRoundRobinFormat = (format: MatchSchedulingFormat): boolean =>
  format === MatchSchedulingFormat.RoundRobin;

/** Leather (non round robin) picks an external opponent or an ACC team, plus Home/Away + reporting time. */
export const showLeatherFixtureFields = (
  ctx: Pick<MatchSetupContext, 'ballType' | 'format'>,
): boolean => ctx.ballType === BallType.Leather && !isRoundRobinFormat(ctx.format);

export function showGroupFieldFor(
  tournament: Pick<TournamentDetail, 'type' | 'matchSchedulingFormat' | 'groupCount'>,
  format: MatchSchedulingFormat,
  matchType: MatchType | null,
): boolean {
  return (
    !isRoundRobinFormat(format) &&
    !isKnockoutMatchType(matchType) &&
    tournamentSupportsGroups(tournament)
  );
}

/** Edit / Delete are offered only on upcoming fixtures the API allows the viewer to manage. */
export const canEditMatch = (
  match: Pick<MatchListItem, 'state' | 'canEdit' | 'isDeleted'>,
): boolean =>
  !match.isDeleted && isUpcomingMatchForScheduleManagement(match.state) && match.canEdit === true;

export const canDeleteMatch = (
  match: Pick<MatchListItem, 'state' | 'canDelete' | 'isDeleted'>,
): boolean =>
  !match.isDeleted && isUpcomingMatchForScheduleManagement(match.state) && match.canDelete === true;

export function emptyMatchSetup(format: MatchSchedulingFormat): MatchSetupValues {
  return {
    matchType: defaultMatchTypeForSchedulingFormat(format),
    groupId: null,
    teamAId: null,
    teamBId: null,
    opponentIsAccTeam: false,
    teamBExternalName: '',
    homeAway: null,
    groundAddress: '',
    groundLat: null,
    groundLng: null,
    oversPerInnings: null,
    maxOversPerBowler: null,
    powerplayOvers: null,
    battingPowerplayOvers: null,
    matchDate: '',
    matchTime: '',
    reportingTime: '',
  };
}

function resolveGroupId(match: MatchDetail, teams: TournamentDetail['teams']): string | null {
  if (isKnockoutMatchType(match.matchType)) return null;
  if (match.groupId) return match.groupId;
  for (const teamId of [match.homeTeamId, match.awayTeamId]) {
    const groupId = teams.find((team) => team.id === teamId)?.groupId;
    if (groupId) return groupId;
  }
  return null;
}

export function hydrateMatchSetup(
  match: MatchDetail,
  teams: TournamentDetail['teams'],
): MatchSetupValues {
  return {
    matchType: match.matchType,
    groupId: resolveGroupId(match, teams),
    teamAId: match.homeTeamId,
    teamBId: match.awayTeamId,
    opponentIsAccTeam: match.awayTeamId !== null,
    teamBExternalName: match.externalOpponentName ?? '',
    homeAway: match.homeAway,
    groundAddress: match.groundLocation ?? '',
    groundLat: match.geofenceLat,
    groundLng: match.geofenceLng,
    oversPerInnings: match.oversPerInnings,
    maxOversPerBowler: match.maxOversPerBowler,
    powerplayOvers: match.powerplayOvers,
    battingPowerplayOvers: match.battingPowerplayOvers,
    matchDate: match.matchDate ? calendarDateFromUtcMidnightIso(match.matchDate) : '',
    matchTime: splitIsoToLocalDateAndTime(match.startTime).time,
    reportingTime: splitIsoToLocalDateAndTime(match.reportingTime).time,
  };
}

/** Changing overs resets max-per-bowler and drops powerplays that no longer fit. */
export function withOvers(values: MatchSetupValues, overs: number | null): MatchSetupValues {
  return {
    ...values,
    oversPerInnings: overs,
    maxOversPerBowler: null,
    powerplayOvers: clampPowerplaySelection(values.powerplayOvers, overs),
    battingPowerplayOvers: clampPowerplaySelection(values.battingPowerplayOvers, overs),
  };
}

/** Round robin: Team B excludes teams already paired with Team A (except this match's own pairing on edit). */
export function roundRobinBlockedOpponents(
  teamAId: string | null,
  existingPairKeys: readonly string[],
  ownPairKey: string | null,
): Set<string> {
  const blocked = new Set<string>();
  if (!teamAId) return blocked;
  for (const key of existingPairKeys) {
    if (key === ownPairKey) continue;
    const [first, second] = key.split(':');
    if (first === teamAId && second) blocked.add(second);
    if (second === teamAId && first) blocked.add(first);
  }
  return blocked;
}

export function validateMatchSetup(
  values: MatchSetupValues,
  ctx: MatchSetupContext,
): MatchSetupErrors {
  const m = MATCH_SETUP_FORM_MESSAGES;
  const errors: MatchSetupErrors = {};
  const isLeather = ctx.ballType === BallType.Leather;
  const isTennis = ctx.ballType === BallType.Tennis;

  if (!values.matchType) errors.matchType = m.matchType.required;
  if (ctx.showGroupField && !values.groupId) errors.groupId = m.group.required;
  if (!values.teamAId) errors.teamAId = m.teamA.required;

  if (showLeatherFixtureFields(ctx) && !values.opponentIsAccTeam) {
    if (!values.teamBExternalName.trim())
      errors.externalOpponentName = m.externalOpponentName.required;
  } else {
    if (!values.teamBId) errors.teamBId = m.teamB.required;
    else if (values.teamAId === values.teamBId) errors.teamBId = m.teamsDistinct.duplicate;
    else if (
      isRoundRobinFormat(ctx.format) &&
      !ctx.isEdit &&
      values.teamAId &&
      ctx.existingPairKeys.includes(normalizeTeamPairKey(values.teamAId, values.teamBId))
    ) {
      errors.teamBId = m.duplicatePairing.duplicate;
    }
  }

  if (isLeather) {
    if (!values.groundAddress.trim()) errors.groundLocation = m.ground.required;
    else if (values.groundLat == null || values.groundLng == null)
      errors.groundLocation = m.coordinates.required;
  }

  if (values.oversPerInnings == null) errors.oversPerInnings = m.overs.required;
  if (values.maxOversPerBowler == null) errors.maxOversPerBowler = m.oversPerBowler.required;
  if (values.oversPerInnings != null && values.powerplayOvers != null) {
    const error = validatePowerplayOvers(values.oversPerInnings, values.powerplayOvers);
    if (error) errors.powerplayOvers = error;
  }
  if (isTennis && values.oversPerInnings != null && values.battingPowerplayOvers != null) {
    const error = validateBattingPowerplayOvers(
      values.oversPerInnings,
      values.battingPowerplayOvers,
    );
    if (error) errors.battingPowerplayOvers = error;
  }

  if (!values.matchDate) errors.matchDate = m.matchDate.required;
  else if (
    values.matchDate !== ctx.initialMatchDate &&
    isDateOnlyBeforeTodayInZone(values.matchDate, ctx.timezone || DEFAULT_VENUE_TIMEZONE)
  ) {
    errors.matchDate = m.matchDate.past;
  }
  if (!values.matchTime) errors.matchTime = m.matchTime.required;

  return errors;
}

/** Same body mobile sends for create and update (validate first). */
export function toMatchRequest(
  values: MatchSetupValues,
  ctx: MatchSetupContext,
): CreateMatchRequest {
  const isLeather = ctx.ballType === BallType.Leather;
  const leatherFixture = showLeatherFixtureFields(ctx);
  const external = leatherFixture && !values.opponentIsAccTeam;
  return {
    homeTeamId: values.teamAId,
    awayTeamId: external ? null : values.teamBId,
    externalOpponentName: external ? values.teamBExternalName.trim() : null,
    groupId: ctx.showGroupField ? values.groupId : null,
    matchType: values.matchType,
    ...(isLeather
      ? {
          groundLocation: values.groundAddress.trim(),
          geofenceLat: values.groundLat,
          geofenceLng: values.groundLng,
        }
      : {}),
    oversPerInnings: values.oversPerInnings,
    maxOversPerBowler: values.maxOversPerBowler,
    ...(values.powerplayOvers != null ? { powerplayOvers: values.powerplayOvers } : {}),
    ...(ctx.ballType === BallType.Tennis && values.battingPowerplayOvers != null
      ? { battingPowerplayOvers: values.battingPowerplayOvers }
      : {}),
    matchDate: values.matchDate,
    startTime: combineLocalDateAndTimeToIso(values.matchDate, values.matchTime),
    ...(leatherFixture && values.reportingTime
      ? { reportingTime: combineLocalDateAndTimeToIso(values.matchDate, values.reportingTime) }
      : {}),
    ...(leatherFixture ? { homeAway: values.homeAway } : {}),
  };
}

/** Server `fields` → known form fields (knockout fixtures never show a group error). */
export function serverMatchErrors(
  fields: Readonly<Record<string, string>>,
  matchType: MatchType | null,
): MatchSetupErrors {
  const errors: MatchSetupErrors = {};
  for (const key of MATCH_SETUP_FIELDS) {
    const message = fields[key];
    if (message && !(key === 'groupId' && isKnockoutMatchType(matchType))) errors[key] = message;
  }
  return errors;
}
