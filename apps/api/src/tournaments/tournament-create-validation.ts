import {
  BallType,
  CitySelection,
  TOURNAMENT_FORM_MESSAGES,
  validateCreateTournamentForm,
  validateTennisTournamentLocation,
  type CreateTournamentFormInput,
  type TournamentFormFieldErrors,
} from '@acc/types';
import { BadRequestException } from '@nestjs/common';

import type { CreateTournamentDto } from './dto/create-tournament.dto';

function dtoToFormInput(dto: CreateTournamentDto): CreateTournamentFormInput {
  const hasRegistration =
    dto.registrationOpenAt != null || dto.registrationCloseAt != null;

  return {
    hasPoster: Boolean(dto.posterUrl),
    name: dto.name ?? '',
    year: dto.year != null ? String(dto.year) : null,
    tournamentDates:
      dto.ballType === BallType.Tennis ? (dto.dates ?? []) : [],
    leatherFromDate:
      dto.ballType === BallType.Leather && dto.dates && dto.dates.length >= 1
        ? (dto.dates[0] ?? '')
        : '',
    leatherEndDate:
      dto.ballType === BallType.Leather && dto.dates && dto.dates.length >= 2
        ? (dto.dates[dto.dates.length - 1] ?? '')
        : '',
    ballType: dto.ballType,
    citySelection: dto.citySelection ?? null,
    tournamentProvinceId: dto.provinceId ?? null,
    selectedCenterIds: dto.centerIds ?? [],
    numberOfTeams: dto.numberOfTeams != null ? String(dto.numberOfTeams) : null,
    playersPerTeam: dto.playersPerTeam != null ? String(dto.playersPerTeam) : '',
    hasRegistrationWindow: hasRegistration,
    registrationOpenDate: dto.registrationOpenAt ? 'set' : '',
    registrationOpenTime: dto.registrationOpenAt ? 'set' : '',
    registrationCloseDate: dto.registrationCloseAt ? 'set' : '',
    registrationCloseTime: dto.registrationCloseAt ? 'set' : '',
    hasAuctionDate: dto.auctionAt != null,
    auctionDate: dto.auctionAt ? 'set' : '',
    videoRequired: dto.videoRequired,
    videoUploadStartDate: dto.videoUploadStartAt ? 'set' : '',
    videoUploadStartTime: dto.videoUploadStartAt ? 'set' : '',
    videoUploadEndDate: dto.videoUploadEndDate ? 'set' : '',
    videoUploadEndTime: dto.videoUploadEndDate ? 'set' : '',
    locationAddress: dto.locationAddress ?? '',
    latitude: dto.latitude ?? null,
    longitude: dto.longitude ?? null,
  };
}

export function assertCreateTournamentFormValid(dto: CreateTournamentDto): void {
  const errors: TournamentFormFieldErrors = validateCreateTournamentForm(dtoToFormInput(dto));
  if (Object.keys(errors).length > 0) {
    throw new BadRequestException({
      message: 'Validation failed',
      error: 'VALIDATION_ERROR',
      fields: errors,
    });
  }
}

export function registrationCloseBeforeOpenFields(): Record<string, string> {
  const message = TOURNAMENT_FORM_MESSAGES.registration.closeBeforeOpen;
  return {
    registrationCloseDate: message,
    registrationCloseTime: message,
  };
}

export function videoDateRequiredFields(): Record<string, string> {
  const m = TOURNAMENT_FORM_MESSAGES;
  return {
    videoUploadStartDate: m.videoUploadStartDate.required,
    videoUploadStartTime: m.videoUploadStartTime.required,
    videoUploadEndDate: m.videoUploadEndDate.required,
    videoUploadEndTime: m.videoUploadEndTime.required,
  };
}

export function videoDateAfterStartFields(): Record<string, string> {
  return {
    videoUploadEndDate: TOURNAMENT_FORM_MESSAGES.videoUploadEndDate.afterStart,
  };
}

export function videoDateAfterRegistrationFields(): Record<string, string> {
  return {
    videoUploadEndDate: TOURNAMENT_FORM_MESSAGES.videoUploadEndDate.afterRegistrationClose,
  };
}

export function assertTennisTournamentLocationValid(
  locationAddress?: string | null,
  latitude?: number | null,
  longitude?: number | null,
): void {
  const message = validateTennisTournamentLocation(locationAddress, latitude, longitude);
  if (message) {
    throw new BadRequestException({
      message: 'Validation failed',
      error: 'VALIDATION_ERROR',
      fields: { tournamentLocation: message },
    });
  }
}
