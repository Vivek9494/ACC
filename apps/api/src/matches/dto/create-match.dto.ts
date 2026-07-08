import { type CreateMatchRequest, HomeAway, MatchType } from '@acc/types';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const MATCH_TYPES = Object.values(MatchType);
const HOME_AWAY_VALUES = Object.values(HomeAway);

/** Create a match / fixture entry (spec §11, §27). */
export class CreateMatchDto implements CreateMatchRequest {
  @IsOptional()
  @IsString()
  homeTeamId?: string | null;

  @IsOptional()
  @IsString()
  awayTeamId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  externalOpponentName?: string | null;

  @IsOptional()
  @IsString()
  groupId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  matchCode?: string | null;

  @IsOptional()
  @IsIn(MATCH_TYPES)
  matchType?: MatchType | null;

  @IsOptional()
  @IsDateString()
  matchDate?: string | null;

  @IsOptional()
  @IsDateString()
  startTime?: string | null;

  @IsOptional()
  @IsDateString()
  reportingTime?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  groundLocation?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  geofenceLat?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  geofenceLng?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  oversPerInnings?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  maxOversPerBowler?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50)
  powerplayOvers?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50)
  battingPowerplayOvers?: number | null;

  @IsOptional()
  @IsIn(HOME_AWAY_VALUES)
  homeAway?: HomeAway | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  youtubeUrl?: string | null;
}
