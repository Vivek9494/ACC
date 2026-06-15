import {
  BallType,
  CitySelection,
  type TournamentEditFormData,
} from '@acc/types';

import { formatIsoDate } from './tournament-datetime';
import { storedImageFromRemoteUrl } from './imagePicker';
import type { TournamentPosterSelection } from './tournament-poster';

function isoToLocalDate(iso: string | null): string {
  if (!iso) {
    return '';
  }
  return formatIsoDate(new Date(iso));
}

function isoToLocalTime(iso: string | null): string {
  if (!iso) {
    return '';
  }
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export interface HydratedTournamentFormState {
  poster: TournamentPosterSelection | null;
  name: string;
  year: string;
  tournamentDates: string[];
  locationAddress: string;
  latitude: number | null;
  longitude: number | null;
  ballType: BallType;
  citySelection: CitySelection | null;
  numberOfTeams: string;
  playersPerTeam: string;
  hasRegistrationWindow: boolean;
  registrationOpenDate: string;
  registrationOpenTime: string;
  registrationCloseDate: string;
  registrationCloseTime: string;
  hasAuctionDate: boolean;
  auctionDate: string;
  impactPlayerEnabled: boolean;
  videoRequired: boolean;
  videoUploadEndDate: string;
  minTeamCount: number;
  datesWithMatches: string[];
  scopeLabel: string;
  provinceLabel: string | null;
  centerLabels: string[];
}

function scopeLabelFor(data: TournamentEditFormData): string {
  if (data.ballType === BallType.Leather || data.type === 'ACC') {
    return 'Leather Ball (ACC)';
  }
  if (data.scopeDisplay.citySelection === CitySelection.All) {
    return 'All the Centers (APL)';
  }
  if (data.scopeDisplay.citySelection === CitySelection.Multi) {
    return 'Multi-centers';
  }
  if (data.scopeDisplay.citySelection === CitySelection.Single) {
    return 'Single center';
  }
  return data.type;
}

/** Maps edit-form API payload into Add/Edit Tournament form state. */
export function hydrateTournamentFormFromEditData(
  data: TournamentEditFormData,
): HydratedTournamentFormState {
  const poster: TournamentPosterSelection | null = data.posterUrl
    ? storedImageFromRemoteUrl(data.posterUrl)
    : null;

  return {
    poster,
    name: data.name,
    year: String(data.year),
    tournamentDates: [...data.dates],
    locationAddress: data.locationAddress ?? '',
    latitude: data.latitude,
    longitude: data.longitude,
    ballType: data.ballType,
    citySelection: data.scopeDisplay.citySelection,
    numberOfTeams: String(data.numberOfTeams),
    playersPerTeam: String(data.playersPerTeam),
    hasRegistrationWindow: data.hasRegistrationWindow,
    registrationOpenDate: isoToLocalDate(data.registrationOpenAt),
    registrationOpenTime: isoToLocalTime(data.registrationOpenAt),
    registrationCloseDate: isoToLocalDate(data.registrationCloseAt),
    registrationCloseTime: isoToLocalTime(data.registrationCloseAt),
    hasAuctionDate: data.auctionAt != null,
    auctionDate: isoToLocalDate(data.auctionAt),
    impactPlayerEnabled: data.impactPlayerEnabled,
    videoRequired: data.videoRequired,
    videoUploadEndDate: isoToLocalDate(data.videoUploadEndDate),
    minTeamCount: data.teamCount,
    datesWithMatches: [...data.datesWithMatches],
    scopeLabel: scopeLabelFor(data),
    provinceLabel: data.scopeDisplay.provinceName,
    centerLabels: [...data.scopeDisplay.centerNames],
  };
}
