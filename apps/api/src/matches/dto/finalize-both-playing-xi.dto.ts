import {
  type FinalizeBothPlayingXiRequest,
  MAX_IMPACT_CANDIDATES,
  MAX_SUBSTITUTES,
  PLAYING_XI_SIZE,
} from '@acc/types';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

class FinalizePlayingXiTeamDto {
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

export class FinalizeBothPlayingXiDto implements FinalizeBothPlayingXiRequest {
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => FinalizePlayingXiTeamDto)
  teams!: FinalizePlayingXiTeamDto[];
}
