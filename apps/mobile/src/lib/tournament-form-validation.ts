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
}

export function validateTournamentForm(values: TournamentFormValues): TournamentFormFieldErrors {
  return validateCreateTournamentForm({
    hasPoster: values.hasPoster ?? Boolean(values.posterUri),
    posterPickError: values.posterPickError,
    name: values.name,
    year: values.year,
    tournamentDates: values.tournamentDates,
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
    videoUploadEndDate: values.videoUploadEndDate,
  });
}

export function validateUpdateTournamentFormValues(
  values: TournamentFormValues & { minTeamCount: number; datesWithMatches: string[] },
): TournamentFormFieldErrors {
  return validateUpdateTournamentForm({
    hasPoster: values.hasPoster ?? Boolean(values.posterUri),
    posterPickError: values.posterPickError,
    name: values.name,
    year: values.year,
    tournamentDates: values.tournamentDates,
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
    videoUploadEndDate: values.videoUploadEndDate,
    minTeamCount: values.minTeamCount,
    datesWithMatches: values.datesWithMatches,
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
