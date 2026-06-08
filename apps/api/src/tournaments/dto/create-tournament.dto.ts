import {
  BallType,
  CitySelection,
  type CreateTournamentRequest,
  TournamentFormat,
} from '@acc/types';
import {
  ArrayNotEmpty,
  IsArray,
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

const BALL_TYPES = Object.values(BallType);
const CITY_SELECTIONS = Object.values(CitySelection);
const FORMATS = Object.values(TournamentFormat);

/**
 * Add Tournament form (§6.1). `type` is omitted — the service derives it via the
 * §1.1 resolver. Powerplay Overs is explicitly rejected (removed per §6.1); the
 * global `forbidNonWhitelisted` pipe would reject unknown props, but declaring
 * it lets us return a clear, spec-referenced message.
 */
export class CreateTournamentDto implements CreateTournamentRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @IsOptional()
  @IsUrl()
  posterUrl?: string | null;

  @IsInt()
  @Min(1)
  @Max(50)
  oversPerInnings!: number;

  @IsInt()
  @Min(1)
  @Max(50)
  maxOversPerBowler!: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string | null;

  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;

  @IsIn(BALL_TYPES)
  ballType!: BallType;

  @IsIn(CITY_SELECTIONS)
  citySelection!: CitySelection;

  @IsOptional()
  @IsString()
  provinceId?: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  centerIds?: string[];

  @IsIn(FORMATS)
  format!: TournamentFormat;

  @IsBoolean()
  impactPlayerEnabled!: boolean;

  @IsBoolean()
  videoRequired!: boolean;

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

  @IsOptional()
  @IsString()
  cloneFromTournamentId?: string | null;

  @IsOptional()
  @IsBoolean()
  copyRoleAssignments?: boolean;

  // §6.1: Powerplay Overs was removed from the Add Tournament form. Reject any
  // attempt to set it. `@IsEmpty` passes only when the value is absent.
  @IsEmpty({ message: 'Powerplay Overs was removed per spec §6.1 and is not accepted' })
  powerplayOvers?: never;
}
