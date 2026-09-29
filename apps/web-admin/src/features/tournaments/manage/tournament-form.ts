import {
  APP_SHORT_NAME,
  BallType,
  CitySelection,
  DEFAULT_SUBSTITUTES_ALLOWED,
  DEFAULT_TOURNAMENT_FORMAT,
  DEFAULT_VENUE_TIMEZONE,
  TOURNAMENT_FIELD_LIMITS,
  TournamentType,
  buildKnockoutTeamCountOptions,
  buildKnockoutTeamCountOptionsForCreate,
  combineLocalDateAndTimeToIso,
  deferredMaxOversPerBowler,
  mapApiFieldsToTournamentForm,
  parseOptionalTournamentFee,
  resolveTournamentFormDates,
  resolvesToAplOnCreate,
  splitIsoToLocalDateAndTime,
  tournamentFeeToInputString,
  utcMidnightIsoToDateOnly,
  validateCreateTournamentForm,
  validateUpdateTournamentForm,
  type CreateTournamentFormInput,
  type CreateTournamentRequest,
  type TournamentEditFormData,
  type TournamentFormFieldErrors,
  type TournamentTypeDefinitionCatalogEntry,
  type UpdateTournamentRequest,
} from '@acc/types';

export type TournamentFormMode = 'create' | 'edit';

/** Everything the Add / Edit Tournament form holds (strings as typed; mirrors the mobile form state). */
export interface TournamentFormValues {
  name: string;
  year: string | null;
  ballType: BallType | null;
  /** Tennis: individual match days (YYYY-MM-DD). */
  tournamentDates: string[];
  /** Leather: inclusive span. */
  leatherFromDate: string;
  leatherEndDate: string;
  provinceId: string | null;
  citySelection: CitySelection | null;
  /** Tennis APL scope — the catalog type whose centers participate. */
  tournamentTypeDefinitionId: string | null;
  centerIds: string[];
  locationAddress: string;
  latitude: number | null;
  longitude: number | null;
  numberOfTeams: string | null;
  playersPerTeam: string;
  knockoutTeamCount: string | null;
  hasRegistrationWindow: boolean;
  registrationOpenDate: string;
  registrationOpenTime: string;
  registrationCloseDate: string;
  registrationCloseTime: string;
  feeFullTime: string;
  feePartTime: string;
  hasAuctionDate: boolean;
  auctionDate: string;
  auctionTime: string;
  impactPlayerEnabled: boolean;
  videoRequired: boolean;
  videoUploadStartDate: string;
  videoUploadStartTime: string;
  videoUploadEndDate: string;
  videoUploadEndTime: string;
}

/** Server facts the Edit form needs to lock fields and enforce scheduling constraints. */
export interface TournamentEditContext {
  tournamentType: TournamentType;
  minTeamCount: number;
  datesWithMatches: string[];
  groupCount: number;
  hasKnockoutBracket: boolean;
  venueTimezone: string;
  scopeLabel: string;
  centerNames: string[];
  initialLeatherFromDate: string;
  initialLeatherEndDate: string;
}

export function emptyTournamentForm(year: number = new Date().getFullYear()): TournamentFormValues {
  return {
    name: '',
    year: String(year),
    ballType: null,
    tournamentDates: [],
    leatherFromDate: '',
    leatherEndDate: '',
    provinceId: null,
    citySelection: null,
    tournamentTypeDefinitionId: null,
    centerIds: [],
    locationAddress: '',
    latitude: null,
    longitude: null,
    numberOfTeams: null,
    playersPerTeam: '',
    knockoutTeamCount: null,
    hasRegistrationWindow: false,
    registrationOpenDate: '',
    registrationOpenTime: '',
    registrationCloseDate: '',
    registrationCloseTime: '',
    feeFullTime: '',
    feePartTime: '',
    hasAuctionDate: false,
    auctionDate: '',
    auctionTime: '',
    impactPlayerEnabled: false,
    videoRequired: false,
    videoUploadStartDate: '',
    videoUploadStartTime: '',
    videoUploadEndDate: '',
    videoUploadEndTime: '',
  };
}

/** Last year through two years ahead — same range as mobile. */
export function yearOptions(now: Date = new Date()): string[] {
  const current = now.getFullYear();
  return [current - 1, current, current + 1, current + 2].map(String);
}

/** Edit can't drop below the teams already added. */
export function numberOfTeamsOptions(minTeamCount = 0): string[] {
  const { min, max } = TOURNAMENT_FIELD_LIMITS.numberOfTeams;
  const options: string[] = [];
  for (let count = Math.max(min, minTeamCount); count <= max; count += 1)
    options.push(String(count));
  return options;
}

export function knockoutTeamCountOptions(
  mode: TournamentFormMode,
  numberOfTeams: string | null,
  groupCount: number,
): string[] {
  const total = numberOfTeams ? Number(numberOfTeams) : 0;
  const options =
    mode === 'edit'
      ? buildKnockoutTeamCountOptions(groupCount, total)
      : buildKnockoutTeamCountOptionsForCreate(total);
  return options.map((option) => option.value);
}

/** Switching ball type clears everything that only applies to the other one (mobile onBallTypeChange). */
export function withBallType(
  values: TournamentFormValues,
  ballType: BallType,
): TournamentFormValues {
  const next: TournamentFormValues = {
    ...values,
    ballType,
    tournamentDates: [],
    leatherFromDate: '',
    leatherEndDate: '',
  };
  if (ballType === BallType.Leather) {
    return {
      ...next,
      citySelection: null,
      tournamentTypeDefinitionId: null,
      centerIds: [],
      knockoutTeamCount: null,
      hasAuctionDate: false,
      auctionDate: '',
      auctionTime: '',
      impactPlayerEnabled: false,
      videoRequired: false,
      videoUploadStartDate: '',
      videoUploadStartTime: '',
      videoUploadEndDate: '',
      videoUploadEndTime: '',
      locationAddress: '',
      latitude: null,
      longitude: null,
    };
  }
  return { ...next, feePartTime: '' };
}

/** A new province invalidates the scope and centers picked for the old one. */
export function withProvince(
  values: TournamentFormValues,
  provinceId: string,
): TournamentFormValues {
  return {
    ...values,
    provinceId,
    citySelection: null,
    tournamentTypeDefinitionId: null,
    centerIds: [],
    knockoutTeamCount: null,
  };
}

/** Scope select value: a catalog type id (APL scope) or {@link CitySelection.Multi}. */
export function scopeSelectValue(values: TournamentFormValues): string | null {
  return values.citySelection === CitySelection.Multi
    ? CitySelection.Multi
    : values.tournamentTypeDefinitionId;
}

export function withScope(
  values: TournamentFormValues,
  scope: string,
  catalog: readonly TournamentTypeDefinitionCatalogEntry[],
): TournamentFormValues {
  if (scope === CitySelection.Multi) {
    return {
      ...values,
      citySelection: CitySelection.Multi,
      tournamentTypeDefinitionId: null,
      centerIds: [],
      knockoutTeamCount: null,
    };
  }
  const type = catalog.find((entry) => entry.id === scope);
  return {
    ...values,
    citySelection: CitySelection.Apl,
    tournamentTypeDefinitionId: scope,
    centerIds: type ? [...type.centerIds] : [],
  };
}

/** Mobile scope label for the locked Tournament Type row on Edit. */
export function scopeLabelFor(
  data: Pick<TournamentEditFormData, 'ballType' | 'type' | 'scopeDisplay'>,
): string {
  if (data.ballType === BallType.Leather || data.type === TournamentType.ACC)
    return `Leather Ball (${APP_SHORT_NAME})`;
  switch (data.scopeDisplay.citySelection) {
    case CitySelection.Apl:
      return 'APL';
    case CitySelection.Multi:
      return 'Multi-centers';
    case CitySelection.Single:
      return 'Single center';
    default:
      return data.type;
  }
}

/** GET /tournaments/:id/edit-form → form values + locked context (mobile hydrateTournamentFormFromEditData). */
export function hydrateTournamentForm(data: TournamentEditFormData): {
  values: TournamentFormValues;
  context: TournamentEditContext;
} {
  const leather = data.ballType === BallType.Leather;
  const leatherFromDate = leather ? (data.dates[0] ?? utcMidnightIsoToDateOnly(data.startAt)) : '';
  const leatherEndDate = leather
    ? (data.dates[data.dates.length - 1] ?? utcMidnightIsoToDateOnly(data.endAt))
    : '';
  const registrationOpen = splitIsoToLocalDateAndTime(data.registrationOpenAt);
  const registrationClose = splitIsoToLocalDateAndTime(data.registrationCloseAt);
  const auction = splitIsoToLocalDateAndTime(data.auctionAt);
  const videoStart = splitIsoToLocalDateAndTime(data.videoUploadStartAt);
  const videoEnd = splitIsoToLocalDateAndTime(data.videoUploadEndDate);

  return {
    values: {
      ...emptyTournamentForm(data.year),
      name: data.name,
      ballType: data.ballType,
      tournamentDates: leather
        ? []
        : resolveTournamentFormDates({
            ballType: BallType.Tennis,
            tournamentDates: data.dates,
            leatherFromDate: '',
            leatherEndDate: '',
          }),
      leatherFromDate,
      leatherEndDate,
      provinceId: data.provinceId,
      citySelection: data.scopeDisplay.citySelection,
      locationAddress: data.locationAddress ?? '',
      latitude: data.latitude,
      longitude: data.longitude,
      numberOfTeams: String(data.numberOfTeams),
      playersPerTeam: data.playersPerTeam != null ? String(data.playersPerTeam) : '',
      knockoutTeamCount: data.knockoutTeamCount != null ? String(data.knockoutTeamCount) : null,
      hasRegistrationWindow: data.hasRegistrationWindow,
      registrationOpenDate: registrationOpen.date,
      registrationOpenTime: registrationOpen.time,
      registrationCloseDate: registrationClose.date,
      registrationCloseTime: registrationClose.time,
      feeFullTime: tournamentFeeToInputString(data.feeFullTime),
      feePartTime: tournamentFeeToInputString(data.feePartTime),
      hasAuctionDate: data.auctionAt != null,
      auctionDate: auction.date,
      auctionTime: auction.time,
      impactPlayerEnabled: data.impactPlayerEnabled,
      videoRequired: data.videoRequired,
      videoUploadStartDate: videoStart.date,
      videoUploadStartTime: videoStart.time,
      videoUploadEndDate: videoEnd.date,
      videoUploadEndTime: videoEnd.time,
    },
    context: {
      tournamentType: data.type,
      minTeamCount: data.teamCount,
      datesWithMatches: [...data.datesWithMatches],
      groupCount: data.groupCount,
      hasKnockoutBracket: data.hasKnockoutBracket,
      venueTimezone: data.timezone ?? DEFAULT_VENUE_TIMEZONE,
      scopeLabel: scopeLabelFor(data),
      centerNames: [...data.scopeDisplay.centerNames],
      initialLeatherFromDate: leatherFromDate,
      initialLeatherEndDate: leatherEndDate,
    },
  };
}

function toFormInput(
  values: TournamentFormValues,
  hasPoster: boolean,
  venueTimezone: string,
): CreateTournamentFormInput {
  const tennis = values.ballType === BallType.Tennis;
  return {
    hasPoster,
    name: values.name,
    year: values.year,
    tournamentDates: values.tournamentDates,
    leatherFromDate: values.leatherFromDate,
    leatherEndDate: values.leatherEndDate,
    ballType: values.ballType,
    citySelection: values.citySelection,
    tournamentProvinceId: values.provinceId,
    selectedCenterIds: values.centerIds,
    numberOfTeams: values.numberOfTeams,
    playersPerTeam: values.playersPerTeam,
    hasRegistrationWindow: values.hasRegistrationWindow,
    registrationOpenDate: values.registrationOpenDate,
    registrationOpenTime: values.registrationOpenTime,
    registrationCloseDate: values.registrationCloseDate,
    registrationCloseTime: values.registrationCloseTime,
    hasAuctionDate: tennis && values.hasAuctionDate,
    auctionDate: tennis ? values.auctionDate : '',
    auctionTime: tennis ? values.auctionTime : '',
    videoRequired: tennis && values.videoRequired,
    videoUploadStartDate: tennis ? values.videoUploadStartDate : '',
    videoUploadStartTime: tennis ? values.videoUploadStartTime : '',
    videoUploadEndDate: tennis ? values.videoUploadEndDate : '',
    videoUploadEndTime: tennis ? values.videoUploadEndTime : '',
    venueTimezone,
    locationAddress: values.locationAddress,
    latitude: values.latitude,
    longitude: values.longitude,
  };
}

/** Same shared validators the mobile form and the API run. */
export function validateTournamentForm(
  values: TournamentFormValues,
  hasPoster: boolean,
  context: TournamentEditContext | null,
): TournamentFormFieldErrors {
  if (!context) {
    return validateCreateTournamentForm({
      ...toFormInput(values, hasPoster, DEFAULT_VENUE_TIMEZONE),
      knockoutTeamCount: resolvesToAplOnCreate(values.ballType, values.citySelection)
        ? values.knockoutTeamCount
        : null,
    });
  }
  return validateUpdateTournamentForm({
    ...toFormInput(values, hasPoster, context.venueTimezone),
    initialLeatherFromDate: context.initialLeatherFromDate,
    initialLeatherEndDate: context.initialLeatherEndDate,
    minTeamCount: context.minTeamCount,
    datesWithMatches: context.datesWithMatches,
    tournamentType: context.tournamentType,
    groupCount: context.groupCount,
    knockoutTeamCount: values.knockoutTeamCount,
    hasKnockoutBracket: context.hasKnockoutBracket,
  });
}

/** API `fields` (e.g. `provinceId`, `videoUploadEndDate`) → form field keys. */
export function serverFieldErrors(
  fields: Readonly<Record<string, string>>,
): TournamentFormFieldErrors {
  return mapApiFieldsToTournamentForm({ ...fields });
}

function localDateTimeIso(enabled: boolean, date: string, time: string): string | null {
  return enabled && date && time ? combineLocalDateAndTimeToIso(date, time) : null;
}

/** Fields shared by create and update, resolved exactly as the mobile submit does. */
function sharedPayload(values: TournamentFormValues) {
  const tennis = values.ballType === BallType.Tennis;
  const leather = values.ballType === BallType.Leather;
  return {
    name: values.name.trim(),
    numberOfTeams: Number(values.numberOfTeams),
    playersPerTeam: values.playersPerTeam.trim() ? Number(values.playersPerTeam) : undefined,
    substitutesAllowed: DEFAULT_SUBSTITUTES_ALLOWED,
    dates: resolveTournamentFormDates(values),
    format: DEFAULT_TOURNAMENT_FORMAT,
    impactPlayerEnabled: tennis && values.impactPlayerEnabled,
    videoRequired: tennis && values.videoRequired,
    videoUploadStartAt: localDateTimeIso(
      tennis && values.videoRequired,
      values.videoUploadStartDate,
      values.videoUploadStartTime,
    ),
    videoUploadEndDate: localDateTimeIso(
      tennis && values.videoRequired,
      values.videoUploadEndDate,
      values.videoUploadEndTime,
    ),
    registrationOpenAt: localDateTimeIso(
      values.hasRegistrationWindow,
      values.registrationOpenDate,
      values.registrationOpenTime,
    ),
    registrationCloseAt: localDateTimeIso(
      values.hasRegistrationWindow,
      values.registrationCloseDate,
      values.registrationCloseTime,
    ),
    auctionAt: localDateTimeIso(
      tennis && values.hasAuctionDate,
      values.auctionDate,
      values.auctionTime,
    ),
    feeFullTime: parseOptionalTournamentFee(values.feeFullTime),
    feePartTime: leather ? parseOptionalTournamentFee(values.feePartTime) : null,
  };
}

/** Call only after {@link validateTournamentForm} passes (ball type, year, province are set). */
export function toCreateTournamentRequest(
  values: TournamentFormValues,
  posterStorageKey: string,
): CreateTournamentRequest {
  const ballType = values.ballType ?? BallType.Tennis;
  const tennis = ballType === BallType.Tennis;
  return {
    ...sharedPayload(values),
    year: Number(values.year),
    posterUrl: posterStorageKey,
    maxOversPerBowler: deferredMaxOversPerBowler(ballType),
    ballType,
    provinceId: values.provinceId ?? '',
    locationAddress: tennis ? values.locationAddress.trim() || null : null,
    latitude: tennis ? values.latitude : null,
    longitude: tennis ? values.longitude : null,
    ...(tennis && values.citySelection
      ? {
          citySelection: values.citySelection,
          ...(values.citySelection === CitySelection.Multi
            ? { centerIds: values.centerIds }
            : values.tournamentTypeDefinitionId
              ? { tournamentTypeDefinitionId: values.tournamentTypeDefinitionId }
              : {}),
        }
      : {}),
    ...(resolvesToAplOnCreate(ballType, values.citySelection)
      ? { knockoutTeamCount: values.knockoutTeamCount ? Number(values.knockoutTeamCount) : null }
      : {}),
  };
}

/** Ball type, year, scope and centers are never sent on edit — the server keeps them locked. */
export function toUpdateTournamentRequest(
  values: TournamentFormValues,
  context: TournamentEditContext,
  newPosterStorageKey: string | null,
): UpdateTournamentRequest {
  const tennis = values.ballType === BallType.Tennis;
  return {
    ...sharedPayload(values),
    ...(newPosterStorageKey ? { posterUrl: newPosterStorageKey } : {}),
    ...(tennis
      ? {
          locationAddress: values.locationAddress.trim() || null,
          latitude: values.latitude,
          longitude: values.longitude,
        }
      : {}),
    provinceId: values.provinceId ?? undefined,
    ...(context.tournamentType === TournamentType.APL && !context.hasKnockoutBracket
      ? { knockoutTeamCount: values.knockoutTeamCount ? Number(values.knockoutTeamCount) : null }
      : {}),
  };
}
