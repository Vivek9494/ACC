import { type CreateMatchRequest } from '@acc/types';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

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
  @MaxLength(40)
  matchCode?: string | null;

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
  @IsString()
  @MaxLength(300)
  youtubeUrl?: string | null;
}
