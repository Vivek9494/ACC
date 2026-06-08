import { type LockPlayingXiRequest, MAX_IMPACT_CANDIDATES, MAX_SUBSTITUTES, PLAYING_XI_SIZE } from '@acc/types';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
} from 'class-validator';

/** Lock a team's Playing 11 + substitutes (+ impact candidates) — §9.7, §8. */
export class LockPlayingXiDto implements LockPlayingXiRequest {
  @IsString()
  teamId!: string;

  @IsArray()
  @ArrayMinSize(PLAYING_XI_SIZE)
  @ArrayMaxSize(PLAYING_XI_SIZE)
  @ArrayUnique()
  @IsString({ each: true })
  playingXi!: string[];

  @IsArray()
  @ArrayMaxSize(MAX_SUBSTITUTES)
  @ArrayUnique()
  @IsString({ each: true })
  substitutes!: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_IMPACT_CANDIDATES)
  @ArrayUnique()
  @IsString({ each: true })
  impactCandidates?: string[];

  @IsOptional()
  @IsString()
  activeImpactUserId?: string | null;
}
