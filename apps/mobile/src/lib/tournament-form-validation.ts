import type { MutableRefObject } from 'react';
import type { LayoutChangeEvent } from 'react-native';

import {
  firstTournamentFieldError,
  mapApiFieldsToTournamentForm,
  TOURNAMENT_FIELD_ORDER,
  validateCreateTournamentForm,
  validateUpdateTournamentForm,
  type CreateTournamentFormInput,
  type TournamentFormFieldErrors,
  type TournamentFormFieldKey,
  type TournamentType,
} from '@acc/types';

import type { ApiRequestError } from './api';

export type { CreateTournamentFormInput, TournamentFormFieldErrors, TournamentFormFieldKey };
export {
  DEFAULT_PLAYERS_PER_TEAM,
  DEFAULT_SUBSTITUTES_ALLOWED,
  TOURNAMENT_FIELD_ORDER,
  TOURNAMENT_FORM_MESSAGES,
} from '@acc/types';

export interface TournamentFormValues extends Omit<CreateTournamentFormInput, 'hasPoster'> {
  /** When omitted, derived from posterUri. */
  hasPoster?: boolean;
  posterUri: string | null;
  defaultProvinceId: string | null;
  leatherFromDate?: string;
  leatherEndDate?: string;
  venueTimezone?: string;
  initialLeatherFromDate?: string;
  initialLeatherEndDate?: string;
  initialVideoUploadStartDate?: string;
}

export function validateTournamentForm(values: TournamentFormValues): TournamentFormFieldErrors {
  return validateCreateTournamentForm({
    hasPoster: values.hasPoster ?? Boolean(values.posterUri),
    posterPickError: values.posterPickError,
    name: values.name,
    year: values.year,
    tournamentDates: values.tournamentDates,
    leatherFromDate: values.leatherFromDate ?? '',
    leatherEndDate: values.leatherEndDate ?? '',
    ballType: values.ballType,
    citySelection: values.citySelection,
    tournamentProvinceId: values.tournamentProvinceId,
    selectedCenterIds: values.selectedCenterIds,
    numberOfTeams: values.numberOfTeams,
    playersPerTeam: values.playersPerTeam,
    hasRegistrationWindow: values.hasRegistrationWindow,
    registrationOpenDate: values.registrationOpenDate,
    registrationOpenTime: values.registrationOpenTime,
    registrationCloseDate: values.registrationCloseDate,
    registrationCloseTime: values.registrationCloseTime,
    hasAuctionDate: values.hasAuctionDate,
    auctionDate: values.auctionDate,
    videoRequired: values.videoRequired,
    videoUploadStartDate: values.videoUploadStartDate,
    videoUploadStartTime: values.videoUploadStartTime,
    videoUploadEndDate: values.videoUploadEndDate,
    videoUploadEndTime: values.videoUploadEndTime,
    venueTimezone: values.venueTimezone,
    locationAddress: values.locationAddress,
    latitude: values.latitude,
    longitude: values.longitude,
    centerSevakCenterIds: values.centerSevakCenterIds,
  });
}

export function validateUpdateTournamentFormValues(
  values: TournamentFormValues & {
    minTeamCount: number;
    datesWithMatches: string[];
    tournamentType: TournamentType;
    groupCount: number;
    knockoutTeamCount: string | null;
    hasKnockoutBracket: boolean;
  },
): TournamentFormFieldErrors {
  return validateUpdateTournamentForm({
    hasPoster: values.hasPoster ?? Boolean(values.posterUri),
    posterPickError: values.posterPickError,
    name: values.name,
    year: values.year,
    tournamentDates: values.tournamentDates,
    leatherFromDate: values.leatherFromDate ?? '',
    leatherEndDate: values.leatherEndDate ?? '',
    ballType: values.ballType,
    citySelection: values.citySelection,
    tournamentProvinceId: values.tournamentProvinceId,
    selectedCenterIds: values.selectedCenterIds,
    numberOfTeams: values.numberOfTeams,
    playersPerTeam: values.playersPerTeam,
    hasRegistrationWindow: values.hasRegistrationWindow,
    registrationOpenDate: values.registrationOpenDate,
    registrationOpenTime: values.registrationOpenTime,
    registrationCloseDate: values.registrationCloseDate,
    registrationCloseTime: values.registrationCloseTime,
    hasAuctionDate: values.hasAuctionDate,
    auctionDate: values.auctionDate,
    videoRequired: values.videoRequired,
    videoUploadStartDate: values.videoUploadStartDate,
    videoUploadStartTime: values.videoUploadStartTime,
    videoUploadEndDate: values.videoUploadEndDate,
    videoUploadEndTime: values.videoUploadEndTime,
    venueTimezone: values.venueTimezone,
    locationAddress: values.locationAddress,
    latitude: values.latitude,
    longitude: values.longitude,
    initialLeatherFromDate: values.initialLeatherFromDate,
    initialLeatherEndDate: values.initialLeatherEndDate,
    initialVideoUploadStartDate: values.initialVideoUploadStartDate,
    minTeamCount: values.minTeamCount,
    datesWithMatches: values.datesWithMatches,
    tournamentType: values.tournamentType,
    groupCount: values.groupCount,
    knockoutTeamCount: values.knockoutTeamCount,
    hasKnockoutBracket: values.hasKnockoutBracket,
  });
}

export function firstTournamentFormFieldError(
  errors: TournamentFormFieldErrors,
): TournamentFormFieldKey | null {
  return firstTournamentFieldError(errors);
}

export function registerTournamentFieldLayout(
  offsets: MutableRefObject<Partial<Record<TournamentFormFieldKey, number>>>,
  key: TournamentFormFieldKey,
  event: LayoutChangeEvent,
): void {
  offsets.current[key] = event.nativeEvent.layout.y;
}

export function mapApiErrorsToTournamentFields(
  err: ApiRequestError,
): TournamentFormFieldErrors {
  return mapApiFieldsToTournamentForm(err.error.fields);
}
