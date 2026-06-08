import { TournamentFormat, type UpdateTournamentRequest } from '@acc/types';
import {
  IsBoolean,
  IsDateString,
  IsEmpty,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const FORMATS = Object.values(TournamentFormat);

/** Mid-tournament edits (§6.4). Every field optional. */
export class UpdateTournamentDto implements UpdateTournamentRequest {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsUrl()
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
  @IsString()
  @MaxLength(200)
  location?: string | null;

  @IsOptional()
  @IsDateString()
  startAt?: string;

  @IsOptional()
  @IsDateString()
  endAt?: string;

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
  @IsUrl()
  youtubeUrl?: string | null;

  @IsOptional()
  @IsDateString()
  registrationOpenAt?: string | null;

  @IsOptional()
  @IsDateString()
  registrationCloseAt?: string | null;

  // §6.1: still rejected on edit.
  @IsEmpty({ message: 'Powerplay Overs was removed per spec §6.1 and is not accepted' })
  powerplayOvers?: never;
}
