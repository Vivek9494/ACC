import { validateKnockoutTeamCount } from './knockout-team-count';
import { BallType, CitySelection, TournamentType } from './rbac';
import {
  compareIsoDateOnly,
  isDateWithinLeatherSpan,
  resolveTournamentFormDates,
} from './tournament-dates';
import {
  DEFAULT_VENUE_TIMEZONE,
  isDateOnlyBeforeTodayInZone,
} from './timezone';
import {
  parsePositiveInt,
  TOURNAMENT_FIELD_LIMITS,
} from './tournament-field-limits';
import { TOURNAMENT_FORM_MESSAGES, type TournamentFormFieldKey } from './tournament-validation';

export type { TournamentFormFieldKey };
export { TOURNAMENT_FORM_MESSAGES };

export type TournamentFormFieldErrors = Partial<Record<TournamentFormFieldKey, string>>;

/** Visual / scroll order on the Add Tournament screen. */
export const TOURNAMENT_FIELD_ORDER: readonly TournamentFormFieldKey[] = [
  'poster',
  'name',
  'ballType',
  'year',
  'tournamentDates',
  'tournamentLocation',
  'leatherFromDate',
  'leatherEndDate',
  'province',
  'citySelection',
  'centers',
  'numberOfTeams',
  'playersPerTeam',
  'registrationOpenDate',
  'registrationOpenTime',
  'registrationCloseDate',
  'registrationCloseTime',
  'auctionDate',
  'videoUploadStartDate',
  'videoUploadStartTime',
  'videoUploadEndDate',
  'videoUploadEndTime',
  'knockoutTeamCount',
];

export interface CreateTournamentFormInput {
  /** Client: local uri chosen; server: posterUrl present on DTO. */
  hasPoster: boolean;
  /** Set when pick/upload failed type or size validation. */
  posterPickError?: string | null;
  name: string;
  year: string | null;
  tournamentDates: string[];
  /** Leather span — from date (YYYY-MM-DD). Ignored for tennis. */
  leatherFromDate: string;
  /** Leather span — end date (YYYY-MM-DD). Ignored for tennis. */
  leatherEndDate: string;
  ballType: BallType | null;
  citySelection: CitySelection | null;
  tournamentProvinceId: string | null;
  selectedCenterIds: string[];
  numberOfTeams: string | null;
  playersPerTeam: string;
  hasRegistrationWindow: boolean;
  registrationOpenDate: string;
  registrationOpenTime: string;
  registrationCloseDate: string;
  registrationCloseTime: string;
  hasAuctionDate: boolean;
  auctionDate: string;
  videoRequired: boolean;
  videoUploadStartDate: string;
  videoUploadStartTime: string;
  videoUploadEndDate: string;
  videoUploadEndTime: string;
  /** Venue IANA timezone for today comparisons; defaults to Ontario. */
  venueTimezone?: string;
  locationAddress?: string;
  latitude?: number | null;
  longitude?: number | null;
}

function combineLocalDateAndTimeToIso(date: string, time: string): string | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dateMatch || !timeMatch) {
    return null;
  }
  const combined = new Date(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2]),
    0,
    0,
  );
  return combined.toISOString();
}

function compareIsoDates(a: string, b: string): number {
  return new Date(a).getTime() - new Date(b).getTime();
}

export function validateNumberOfTeamsValue(value: string | null): string | null {
  if (!value || !value.trim()) {
    return TOURNAMENT_FORM_MESSAGES.numberOfTeams.required;
  }
  const num = parsePositiveInt(value);
  if (num === null) {
    return TOURNAMENT_FORM_MESSAGES.numberOfTeams.required;
  }
  const { min, max } = TOURNAMENT_FIELD_LIMITS.numberOfTeams;
  if (num < min || num > max) {
    return TOURNAMENT_FORM_MESSAGES.numberOfTeams.range;
  }
  return null;
}

export function validateOptionalPlayersPerTeam(value: string): string | null {
  if (!value.trim()) {
    return null;
  }
  const num = parsePositiveInt(value);
  if (num === null) {
    return TOURNAMENT_FORM_MESSAGES.playersPerTeam.notNumeric;
  }
  if (num > TOURNAMENT_FIELD_LIMITS.playersPerTeam.max) {
    return TOURNAMENT_FORM_MESSAGES.playersPerTeam.max;
  }
  return null;
}

function appendTennisTournamentLocationErrors(
  errors: TournamentFormFieldErrors,
  values: Pick<
    CreateTournamentFormInput,
    'ballType' | 'locationAddress' | 'latitude' | 'longitude'
  >,
): void {
  if (values.ballType !== BallType.Tennis) {
    return;
  }
  const message = validateTennisTournamentLocation(
    values.locationAddress,
    values.latitude,
    values.longitude,
  );
  if (message) {
    errors.tournamentLocation = message;
  }
}

function appendVideoUploadWindowErrors(
  errors: TournamentFormFieldErrors,
  values: Pick<
    CreateTournamentFormInput,
    | 'ballType'
    | 'videoRequired'
    | 'videoUploadStartDate'
    | 'videoUploadStartTime'
    | 'videoUploadEndDate'
    | 'videoUploadEndTime'
    | 'hasRegistrationWindow'
    | 'registrationCloseDate'
    | 'registrationCloseTime'
    | 'venueTimezone'
  > & {
    initialVideoUploadStartDate?: string;
    isEdit?: boolean;
  },
): void {
  if (values.ballType !== BallType.Tennis || !values.videoRequired) {
    return;
  }

  const messages = TOURNAMENT_FORM_MESSAGES;
  const startDate = values.videoUploadStartDate.trim();
  const startTime = values.videoUploadStartTime.trim();
  const endDate = values.videoUploadEndDate.trim();
  const endTime = values.videoUploadEndTime.trim();
  const timeZone = values.venueTimezone ?? DEFAULT_VENUE_TIMEZONE;

  if (!startDate) {
    errors.videoUploadStartDate = messages.videoUploadStartDate.required;
  }
  if (!startTime) {
    errors.videoUploadStartTime = messages.videoUploadStartTime.required;
  }
  if (!endDate) {
    errors.videoUploadEndDate = messages.videoUploadEndDate.required;
  }
  if (!endTime) {
    errors.videoUploadEndTime = messages.videoUploadEndTime.required;
  }

  if (startDate && !values.isEdit && isDateOnlyBeforeTodayInZone(startDate, timeZone)) {
    errors.videoUploadStartDate = messages.videoUploadStartDate.past;
  } else if (
    startDate &&
    values.isEdit &&
    startDate !== values.initialVideoUploadStartDate &&
    isDateOnlyBeforeTodayInZone(startDate, timeZone)
  ) {
    errors.videoUploadStartDate = messages.videoUploadStartDate.past;
  }

  const startIso =
    startDate && startTime ? combineLocalDateAndTimeToIso(startDate, startTime) : null;
  const endIso = endDate && endTime ? combineLocalDateAndTimeToIso(endDate, endTime) : null;

  if (startIso && endIso && compareIsoDates(endIso, startIso) <= 0) {
    errors.videoUploadEndDate = messages.videoUploadEndDate.afterStart;
  }

  if (values.hasRegistrationWindow && endIso) {
    const registrationCloseIso = combineLocalDateAndTimeToIso(
      values.registrationCloseDate,
      values.registrationCloseTime,
    );
    if (registrationCloseIso && compareIsoDates(endIso, registrationCloseIso) <= 0) {
      errors.videoUploadEndDate = messages.videoUploadEndDate.afterRegistrationClose;
    }
  }
}

/** Returns a user-facing error when Tennis tournament location is incomplete. */
export function validateTennisTournamentLocation(
  locationAddress?: string | null,
  latitude?: number | null,
  longitude?: number | null,
): string | null {
  const address = locationAddress?.trim() ?? '';
  if (!address) {
    return TOURNAMENT_FORM_MESSAGES.tournamentLocation.required;
  }
  if (latitude == null || longitude == null) {
    return TOURNAMENT_FORM_MESSAGES.tournamentLocation.coordinates;
  }
  return null;
}

/** Shared Add Tournament validation (mobile submit + API create). */
export function validateCreateTournamentForm(
  values: CreateTournamentFormInput,
): TournamentFormFieldErrors {
  const errors: TournamentFormFieldErrors = {};

  if (values.hasPoster) {
    // Attached poster wins over any stale pick-time error.
  } else if (values.posterPickError) {
    errors.poster = values.posterPickError;
  } else {
    errors.poster = TOURNAMENT_FORM_MESSAGES.poster.required;
  }

  if (!values.name.trim()) {
    errors.name = TOURNAMENT_FORM_MESSAGES.name.required;
  }

  if (!values.year) {
    errors.year = TOURNAMENT_FORM_MESSAGES.year.required;
  }

  if (!values.ballType) {
    errors.ballType = TOURNAMENT_FORM_MESSAGES.ballType.required;
  }

  const resolvedDates = resolveTournamentFormDates(values);

  if (values.ballType === BallType.Leather) {
    appendLeatherSpanDateErrors(errors, values, {
      timeZone: values.venueTimezone ?? DEFAULT_VENUE_TIMEZONE,
    });
  } else if (resolvedDates.length === 0) {
    errors.tournamentDates = TOURNAMENT_FORM_MESSAGES.tournamentDates.required;
  }

  if (values.ballType === BallType.Tennis && !values.citySelection) {
    errors.citySelection = TOURNAMENT_FORM_MESSAGES.citySelection.required;
  }

  if (!values.tournamentProvinceId) {
    errors.province = TOURNAMENT_FORM_MESSAGES.province.required;
  }

  const isMultiCenters =
    values.ballType === BallType.Tennis && values.citySelection === CitySelection.Multi;

  if (isMultiCenters) {
    if (values.selectedCenterIds.length === 0) {
      errors.centers = TOURNAMENT_FORM_MESSAGES.centers.required;
    }
  }

  const teamsError = validateNumberOfTeamsValue(values.numberOfTeams);
  if (teamsError) {
    errors.numberOfTeams = teamsError;
  }

  const playersError = validateOptionalPlayersPerTeam(values.playersPerTeam);
  if (playersError) {
    errors.playersPerTeam = playersError;
  }

  if (values.hasRegistrationWindow) {
    const regMissing =
      !values.registrationOpenDate ||
      !values.registrationOpenTime ||
      !values.registrationCloseDate ||
      !values.registrationCloseTime;

    if (regMissing) {
      const message = TOURNAMENT_FORM_MESSAGES.registration.required;
      errors.registrationOpenDate = message;
      errors.registrationOpenTime = message;
      errors.registrationCloseDate = message;
      errors.registrationCloseTime = message;
    } else {
      const openIso = combineLocalDateAndTimeToIso(
        values.registrationOpenDate,
        values.registrationOpenTime,
      );
      const closeIso = combineLocalDateAndTimeToIso(
        values.registrationCloseDate,
        values.registrationCloseTime,
      );
      if (openIso && closeIso && compareIsoDates(closeIso, openIso) <= 0) {
        errors.registrationCloseDate = TOURNAMENT_FORM_MESSAGES.registration.closeBeforeOpen;
        errors.registrationCloseTime = TOURNAMENT_FORM_MESSAGES.registration.closeBeforeOpen;
      }
    }
  }

  if (values.ballType === BallType.Tennis) {
    if (values.hasAuctionDate && !values.auctionDate) {
      errors.auctionDate = TOURNAMENT_FORM_MESSAGES.auctionDate.required;
    }

    appendVideoUploadWindowErrors(errors, values);
  }

  appendTennisTournamentLocationErrors(errors, values);

  return errors;
}

export interface UpdateTournamentFormInput extends CreateTournamentFormInput {
  minTeamCount: number;
  datesWithMatches: string[];
  /** Stored tournament type — knockout field is APL-only. */
  tournamentType: TournamentType;
  groupCount: number;
  knockoutTeamCount: string | null;
  hasKnockoutBracket: boolean;
  /** Venue IANA timezone for today comparisons (edit mode). */
  venueTimezone?: string;
  /** Saved span boundaries — unchanged past dates remain valid on edit. */
  initialLeatherFromDate?: string;
  initialLeatherEndDate?: string;
  /** Saved upload window start date — unchanged past dates remain valid on edit. */
  initialVideoUploadStartDate?: string;
}

function isNewPastLeatherDate(
  dateOnly: string,
  timeZone: string,
  initialDate?: string,
): boolean {
  if (!dateOnly.trim()) {
    return false;
  }
  if (initialDate && dateOnly === initialDate) {
    return false;
  }
  return isDateOnlyBeforeTodayInZone(dateOnly, timeZone);
}

function appendLeatherSpanDateErrors(
  errors: TournamentFormFieldErrors,
  values: Pick<CreateTournamentFormInput, 'leatherFromDate' | 'leatherEndDate'>,
  options: {
    timeZone: string;
    initialLeatherFromDate?: string;
    initialLeatherEndDate?: string;
  },
): void {
  const fromDate = values.leatherFromDate.trim();
  const endDate = values.leatherEndDate.trim();
  const { timeZone } = options;
  const messages = TOURNAMENT_FORM_MESSAGES.tournamentDates;

  if (!fromDate) {
    errors.leatherFromDate = messages.leatherFromRequired;
    return;
  }
  if (!endDate) {
    errors.leatherEndDate = messages.leatherEndRequired;
    return;
  }
  if (compareIsoDateOnly(endDate, fromDate) < 0) {
    errors.leatherEndDate = messages.endBeforeFrom;
    return;
  }

  if (isNewPastLeatherDate(fromDate, timeZone, options.initialLeatherFromDate)) {
    errors.leatherFromDate = messages.past;
  }
  if (isNewPastLeatherDate(endDate, timeZone, options.initialLeatherEndDate)) {
    errors.leatherEndDate = messages.past;
  }
}

/** Shared Edit Tournament validation (mobile submit + guards). */
export function validateUpdateTournamentForm(
  values: UpdateTournamentFormInput,
): TournamentFormFieldErrors {
  const errors = validateCreateTournamentForm(values);

  delete errors.year;
  delete errors.ballType;
  delete errors.citySelection;
  delete errors.centers;

  if (values.ballType === BallType.Tennis && values.videoRequired) {
    appendVideoUploadWindowErrors(errors, {
      ...values,
      isEdit: true,
      initialVideoUploadStartDate: values.initialVideoUploadStartDate,
    });
  } else {
    delete errors.videoUploadStartDate;
    delete errors.videoUploadStartTime;
    delete errors.videoUploadEndDate;
    delete errors.videoUploadEndTime;
  }

  if (values.numberOfTeams) {
    const num = parsePositiveInt(values.numberOfTeams);
    if (num !== null && num < values.minTeamCount) {
      errors.numberOfTeams = TOURNAMENT_FORM_MESSAGES.numberOfTeams.belowExisting(
        values.minTeamCount,
      );
    }
  }

  if (values.ballType === BallType.Leather) {
    const timeZone = values.venueTimezone ?? DEFAULT_VENUE_TIMEZONE;
    delete errors.leatherFromDate;
    delete errors.leatherEndDate;
    delete errors.tournamentLocation;
    appendLeatherSpanDateErrors(errors, values, {
      timeZone,
      initialLeatherFromDate: values.initialLeatherFromDate,
      initialLeatherEndDate: values.initialLeatherEndDate,
    });

    if (
      values.leatherFromDate.trim() &&
      values.leatherEndDate.trim() &&
      compareIsoDateOnly(values.leatherEndDate, values.leatherFromDate) >= 0 &&
      !errors.leatherFromDate &&
      !errors.leatherEndDate
    ) {
      for (const lockedDate of values.datesWithMatches) {
        if (
          !isDateWithinLeatherSpan(
            lockedDate,
            values.leatherFromDate,
            values.leatherEndDate,
          )
        ) {
          errors.tournamentDates = TOURNAMENT_FORM_MESSAGES.tournamentDates.matchOutsideSpan(
            lockedDate,
          );
          break;
        }
      }
    }
  } else {
    const nextDates = new Set(resolveTournamentFormDates(values));
    for (const lockedDate of values.datesWithMatches) {
      if (!nextDates.has(lockedDate)) {
        errors.tournamentDates = TOURNAMENT_FORM_MESSAGES.tournamentDates.hasScheduledMatch(
          lockedDate,
        );
        break;
      }
    }
  }

  if (values.tournamentType === TournamentType.APL) {
    if (values.knockoutTeamCount != null && values.knockoutTeamCount.trim() !== '') {
      if (values.hasKnockoutBracket) {
        errors.knockoutTeamCount = TOURNAMENT_FORM_MESSAGES.knockoutTeamCount.locked;
      } else {
        const parsed = Number(values.knockoutTeamCount);
        const totalTeams = values.numberOfTeams ? Number(values.numberOfTeams) : 0;
        const knockoutError = validateKnockoutTeamCount(
          Number.isInteger(parsed) ? parsed : null,
          { groupCount: values.groupCount, totalTeams },
        );
        if (knockoutError) {
          errors.knockoutTeamCount = knockoutError;
        }
      }
    }
  }

  return errors;
}

export function firstTournamentFieldError(
  errors: TournamentFormFieldErrors,
): TournamentFormFieldKey | null {
  for (const key of TOURNAMENT_FIELD_ORDER) {
    if (errors[key]) {
      return key;
    }
  }
  return null;
}

export function allTournamentFormMessages(): string[] {
  const m = TOURNAMENT_FORM_MESSAGES;
  return [
    m.poster.required,
    m.poster.type,
    m.poster.size,
    m.name.required,
    m.year.required,
    m.tournamentDates.required,
    m.tournamentDates.leatherFromRequired,
    m.tournamentDates.leatherEndRequired,
    m.tournamentDates.past,
    m.tournamentDates.endBeforeFrom,
    m.ballType.required,
    m.citySelection.required,
    m.province.required,
    m.centers.required,
    m.numberOfTeams.required,
    m.numberOfTeams.range,
    m.playersPerTeam.notNumeric,
    m.playersPerTeam.max,
    m.registration.required,
    m.registration.closeBeforeOpen,
    m.auctionDate.required,
    m.videoUploadStartDate.required,
    m.videoUploadStartTime.required,
    m.videoUploadEndDate.required,
    m.videoUploadEndTime.required,
  ];
}

const TOURNAMENT_FIELD_KEY_SET = new Set<string>(TOURNAMENT_FIELD_ORDER);

const TOURNAMENT_API_FIELD_ALIASES: Record<string, TournamentFormFieldKey> = {
  posterUrl: 'poster',
  provinceId: 'province',
};

export function mapApiFieldsToTournamentForm(
  fields: Record<string, string> | undefined,
): TournamentFormFieldErrors {
  if (!fields) {
    return {};
  }
  const mapped: TournamentFormFieldErrors = {};
  for (const [key, message] of Object.entries(fields)) {
    const formKey = TOURNAMENT_API_FIELD_ALIASES[key] ?? key;
    if (TOURNAMENT_FIELD_KEY_SET.has(formKey)) {
      mapped[formKey as TournamentFormFieldKey] = message;
    }
  }
  return mapped;
}
