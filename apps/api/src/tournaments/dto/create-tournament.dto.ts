import {
  BallType,
  CitySelection,
  TOURNAMENT_FORM_MESSAGES,
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
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

import { APP_URL_VALIDATION_OPTIONS } from '../../common/validation/url-options';

const BALL_TYPES = Object.values(BallType);
const CITY_SELECTIONS = Object.values(CitySelection);
const FORMATS = Object.values(TournamentFormat);
const M = TOURNAMENT_FORM_MESSAGES;

/**
 * Add Tournament form (§6.1). `type` is omitted — the service derives it via the
 * §1.1 resolver. Powerplay Overs is explicitly rejected (removed per §6.1); the
 * global `forbidNonWhitelisted` pipe would reject unknown props, but declaring
 * it lets us return a clear, spec-referenced message.
 */
export class CreateTournamentDto implements CreateTournamentRequest {
  @IsString()
  @MinLength(1, { message: M.name.required })
  @MaxLength(120)
  name!: string;

  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @IsUrl(APP_URL_VALIDATION_OPTIONS, { message: M.poster.required })
  @IsNotEmpty({ message: M.poster.required })
  posterUrl!: string;

  @IsInt()
  @Min(1)
  @Max(50)
  maxOversPerBowler!: number;

  @IsInt()
  @Min(2, { message: M.numberOfTeams.range })
  @Max(30, { message: M.numberOfTeams.range })
  numberOfTeams!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30, { message: M.playersPerTeam.max })
  playersPerTeam?: number;

  @IsInt()
  @Min(0)
  @Max(11)
  substitutesAllowed!: number;

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

  /** YYYY-MM-DD calendar days; server derives startAt/endAt from min/max. */
  @IsArray()
  @ArrayNotEmpty({ message: M.tournamentDates.required })
  @IsString({ each: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    each: true,
    message: M.tournamentDates.required,
  })
  dates!: string[];

  @IsIn(BALL_TYPES, { message: M.ballType.required })
  ballType!: BallType;

  /** Required for tennis-ball tournaments; ignored when ball type is leather. */
  @ValidateIf((dto: CreateTournamentDto) => dto.ballType === BallType.Tennis)
  @IsIn(CITY_SELECTIONS, { message: M.citySelection.required })
  citySelection?: CitySelection;

  @IsString()
  @MinLength(1, { message: M.province.required })
  provinceId!: string;

  @ValidateIf(
    (dto: CreateTournamentDto) =>
      dto.ballType === BallType.Tennis && dto.citySelection === CitySelection.Multi,
  )
  @IsArray()
  @ArrayNotEmpty({ message: M.centers.required })
  @IsString({ each: true })
  centerIds?: string[];

  @IsIn(FORMATS)
  format!: TournamentFormat;

  @IsBoolean()
  impactPlayerEnabled!: boolean;

  @IsBoolean()
  videoRequired!: boolean;

  @ValidateIf((dto: CreateTournamentDto) => dto.videoRequired)
  @IsDateString({}, { message: M.videoUploadStartDate.required })
  videoUploadStartAt?: string | null;

  @ValidateIf((dto: CreateTournamentDto) => dto.videoRequired)
  @IsDateString({}, { message: M.videoUploadEndDate.required })
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

  @ValidateIf((dto: CreateTournamentDto) => dto.auctionAt != null)
  @IsDateString({}, { message: M.auctionDate.required })
  auctionAt?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  feeFullTime?: number | null;

  /** Leather only — ignored for tennis tournaments. */
  @ValidateIf((dto: CreateTournamentDto) => dto.ballType === BallType.Leather)
  @IsOptional()
  @IsNumber()
  @Min(0)
  feePartTime?: number | null;

  @IsOptional()
  @IsString()
  cloneFromTournamentId?: string | null;

  @IsOptional()
  @IsBoolean()
  copyRoleAssignments?: boolean;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(64)
  knockoutTeamCount?: number | null;

  @IsEmpty({ message: 'Powerplay Overs was removed per spec §6.1 and is not accepted' })
  powerplayOvers?: never;

  @IsEmpty({ message: 'Overs per innings is set at match setup, not on tournament create' })
  oversPerInnings?: never;
}
