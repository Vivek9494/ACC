import {
  BallType,
  CitySelection,
  TOURNAMENT_FORM_MESSAGES,
  validateCreateTournamentForm,
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
    tournamentDates: dto.dates ?? [],
    ballType: dto.ballType,
    citySelection: dto.citySelection ?? null,
    tournamentProvinceId:
      dto.ballType === BallType.Tennis && dto.citySelection === CitySelection.Multi
        ? (dto.provinceId ?? null)
        : null,
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
    videoUploadEndDate: dto.videoUploadEndDate ? 'set' : '',
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
  return {
    videoUploadEndDate: TOURNAMENT_FORM_MESSAGES.videoUploadEndDate.required,
  };
}

export function videoDateAfterRegistrationFields(): Record<string, string> {
  return {
    videoUploadEndDate: TOURNAMENT_FORM_MESSAGES.videoUploadEndDate.afterRegistrationClose,
  };
}
