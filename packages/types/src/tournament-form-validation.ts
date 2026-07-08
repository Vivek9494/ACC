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
  'videoUploadEndDate',
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
  videoUploadEndDate: string;
  /** Venue IANA timezone for today comparisons; defaults to Ontario. */
  venueTimezone?: string;
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
    if (!values.leatherFromDate.trim()) {
      errors.tournamentDates = TOURNAMENT_FORM_MESSAGES.tournamentDates.leatherFromRequired;
    } else if (!values.leatherEndDate.trim()) {
      errors.tournamentDates = TOURNAMENT_FORM_MESSAGES.tournamentDates.leatherEndRequired;
    } else if (compareIsoDateOnly(values.leatherEndDate, values.leatherFromDate) < 0) {
      errors.tournamentDates = TOURNAMENT_FORM_MESSAGES.tournamentDates.endBeforeFrom;
    } else if (
      isDateOnlyBeforeTodayInZone(
        values.leatherFromDate,
        values.venueTimezone ?? DEFAULT_VENUE_TIMEZONE,
      ) ||
      isDateOnlyBeforeTodayInZone(
        values.leatherEndDate,
        values.venueTimezone ?? DEFAULT_VENUE_TIMEZONE,
      )
    ) {
      errors.tournamentDates = TOURNAMENT_FORM_MESSAGES.tournamentDates.past;
    }
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

    if (values.videoRequired && !values.videoUploadEndDate) {
      errors.videoUploadEndDate = TOURNAMENT_FORM_MESSAGES.videoUploadEndDate.required;
    }
  }

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

/** Shared Edit Tournament validation (mobile submit + guards). */
export function validateUpdateTournamentForm(
  values: UpdateTournamentFormInput,
): TournamentFormFieldErrors {
  const errors = validateCreateTournamentForm(values);

  delete errors.year;
  delete errors.ballType;
  delete errors.citySelection;
  delete errors.centers;

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
    if (
      isNewPastLeatherDate(values.leatherFromDate, timeZone, values.initialLeatherFromDate) ||
      isNewPastLeatherDate(values.leatherEndDate, timeZone, values.initialLeatherEndDate)
    ) {
      errors.tournamentDates = TOURNAMENT_FORM_MESSAGES.tournamentDates.past;
    } else if (
      values.leatherFromDate.trim() &&
      values.leatherEndDate.trim() &&
      compareIsoDateOnly(values.leatherEndDate, values.leatherFromDate) >= 0
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
    m.videoUploadEndDate.required,
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
