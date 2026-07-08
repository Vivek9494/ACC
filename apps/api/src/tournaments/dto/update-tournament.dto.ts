import { TournamentFormat, TOURNAMENT_FORM_MESSAGES, type UpdateTournamentRequest } from '@acc/types';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmpty,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
  ArrayMinSize,
} from 'class-validator';

import { APP_URL_VALIDATION_OPTIONS } from '../../common/validation/url-options';

const FORMATS = Object.values(TournamentFormat);

/** Mid-tournament edits (§6.4). Every field optional. */
export class UpdateTournamentDto implements UpdateTournamentRequest {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsUrl(APP_URL_VALIDATION_OPTIONS)
  posterUrl?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  oversPerInnings?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  maxOversPerBowler?: number;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(64)
  numberOfTeams?: number;

  @IsOptional()
  @IsInt()
  @Min(11)
  @Max(30)
  playersPerTeam?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(11)
  substitutesAllowed?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  locationAddress?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  dates?: string[];

  @IsOptional()
  @IsIn(FORMATS)
  format?: TournamentFormat;

  @IsOptional()
  @IsBoolean()
  impactPlayerEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  videoRequired?: boolean;

  @IsOptional()
  @IsDateString()
  videoUploadEndDate?: string | null;

  @IsOptional()
  @IsUrl(APP_URL_VALIDATION_OPTIONS)
  youtubeUrl?: string | null;

  @IsOptional()
  @IsDateString()
  registrationOpenAt?: string | null;

  @IsOptional()
  @IsDateString()
  registrationCloseAt?: string | null;

  @IsOptional()
  @IsDateString()
  auctionAt?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  feeFullTime?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  feePartTime?: number | null;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: TOURNAMENT_FORM_MESSAGES.province.required })
  provinceId?: string;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(64)
  knockoutTeamCount?: number | null;

  // §6.1: still rejected on edit.
  @IsEmpty({ message: 'Powerplay Overs was removed per spec §6.1 and is not accepted' })
  powerplayOvers?: never;
}
