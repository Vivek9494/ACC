import {
  BallType,
  CitySelection,
  DEFAULT_PLAYERS_PER_TEAM,
  DEFAULT_SUBSTITUTES_ALLOWED,
  TOURNAMENT_FORM_MESSAGES,
  type TournamentFormFieldKey,
  validateNumberOfTeams,
  validateOversPerInnings,
  validatePlayersPerTeam,
  validateSquadCapacity,
} from '@acc/types';

import {
  combineLocalDateAndTimeToIso,
  compareIsoDates,
  dateOnlyToUtcIso,
} from './tournament-datetime';

export type TournamentFieldErrors = Partial<Record<TournamentFormFieldKey, string>>;

export interface TournamentFormValues {
  name: string;
  year: string | null;
  startDate: string;
  endDate: string;
  ballType: BallType | null;
  citySelection: CitySelection | null;
  tournamentProvinceId: string | null;
  selectedCenterIds: string[];
  defaultProvinceId: string | null;
  oversPerInnings: string;
  numberOfTeams: string;
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
  posterError: string | null;
}

export function validateTournamentForm(values: TournamentFormValues): TournamentFieldErrors {
  const errors: TournamentFieldErrors = {};

  if (values.posterError) {
    errors.poster = values.posterError;
  }

  const trimmedName = values.name.trim();
  if (!trimmedName) {
    errors.name = TOURNAMENT_FORM_MESSAGES.name.required;
  } else if (trimmedName.length > 120) {
    errors.name = TOURNAMENT_FORM_MESSAGES.name.max;
  }

  if (!values.year) {
    errors.year = TOURNAMENT_FORM_MESSAGES.year.required;
  }

  if (!values.startDate) {
    errors.startDate = TOURNAMENT_FORM_MESSAGES.startDate.required;
  }

  if (!values.endDate) {
    errors.endDate = TOURNAMENT_FORM_MESSAGES.endDate.required;
  } else if (values.startDate) {
    const startIso = dateOnlyToUtcIso(values.startDate);
    const endIso = dateOnlyToUtcIso(values.endDate);
    if (startIso && endIso && compareIsoDates(endIso, startIso) < 0) {
      errors.endDate = TOURNAMENT_FORM_MESSAGES.endDate.beforeStart;
    }
  }

  if (!values.ballType) {
    errors.ballType = TOURNAMENT_FORM_MESSAGES.ballType.required;
  }

  if (values.ballType === BallType.Tennis && !values.citySelection) {
    errors.citySelection = TOURNAMENT_FORM_MESSAGES.citySelection.required;
  }

  const isMultiCenters =
    values.ballType === BallType.Tennis && values.citySelection === CitySelection.Multi;

  if (isMultiCenters) {
    if (!values.tournamentProvinceId) {
      errors.province = TOURNAMENT_FORM_MESSAGES.province.required;
    }
    if (values.selectedCenterIds.length === 0) {
      errors.centers = TOURNAMENT_FORM_MESSAGES.centers.required;
    }
  }

  const isAllCenters =
    values.ballType === BallType.Tennis && values.citySelection === CitySelection.All;

  if (isAllCenters && !values.defaultProvinceId) {
    errors.province = TOURNAMENT_FORM_MESSAGES.province.required;
  }

  const oversError = validateOversPerInnings(values.oversPerInnings);
  if (oversError) {
    errors.oversPerInnings = oversError;
  }

  const teamsError = validateNumberOfTeams(values.numberOfTeams);
  if (teamsError) {
    errors.numberOfTeams = teamsError;
  }

  const playersError = validatePlayersPerTeam(values.playersPerTeam);
  if (playersError) {
    errors.playersPerTeam = playersError;
  }

  const playersNum = Number(values.playersPerTeam);
  if (!errors.playersPerTeam && Number.isInteger(playersNum)) {
    const squadError = validateSquadCapacity(playersNum, DEFAULT_SUBSTITUTES_ALLOWED);
    if (squadError) {
      errors.playersPerTeam = squadError;
    }
  }

  if (values.hasRegistrationWindow) {
    if (!values.registrationOpenDate) {
      errors.registrationOpenDate = TOURNAMENT_FORM_MESSAGES.registrationOpenDate.required;
    }
    if (!values.registrationOpenTime) {
      errors.registrationOpenTime = TOURNAMENT_FORM_MESSAGES.registrationOpenTime.required;
    }
    if (!values.registrationCloseDate) {
      errors.registrationCloseDate = TOURNAMENT_FORM_MESSAGES.registrationCloseDate.required;
    }
    if (!values.registrationCloseTime) {
      errors.registrationCloseTime = TOURNAMENT_FORM_MESSAGES.registrationCloseTime.required;
    }

    const openIso = combineLocalDateAndTimeToIso(
      values.registrationOpenDate,
      values.registrationOpenTime,
    );
    const closeIso = combineLocalDateAndTimeToIso(
      values.registrationCloseDate,
      values.registrationCloseTime,
    );
    if (openIso && closeIso && compareIsoDates(closeIso, openIso) <= 0) {
      errors.registrationCloseTime = TOURNAMENT_FORM_MESSAGES.registrationCloseTime.beforeOpen;
    }
  }

  if (values.hasAuctionDate && !values.auctionDate) {
    errors.auctionDate = TOURNAMENT_FORM_MESSAGES.auctionDate.required;
  }

  if (values.videoRequired && !values.videoUploadEndDate) {
    errors.videoUploadEndDate = TOURNAMENT_FORM_MESSAGES.videoUploadEndDate.required;
  }

  return errors;
}

export { DEFAULT_PLAYERS_PER_TEAM, DEFAULT_SUBSTITUTES_ALLOWED };
