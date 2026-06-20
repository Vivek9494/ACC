import {
  RATING_MAX,
  RATING_MIN,
  RegistrationPlayerType,
  type UpdateRatingsRequest,
} from '@acc/types';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

const PLAYER_TYPES = Object.values(RegistrationPlayerType);

/** Center Sevak rating update after the registration window closes (§7.5). */
export class UpdateRatingsDto implements UpdateRatingsRequest {
  @IsOptional()
  @IsInt()
  @Min(RATING_MIN)
  @Max(RATING_MAX)
  battingRating?: number | null;

  @IsOptional()
  @IsInt()
  @Min(RATING_MIN)
  @Max(RATING_MAX)
  bowlingRating?: number | null;

  @IsOptional()
  @IsInt()
  @Min(RATING_MIN)
  @Max(RATING_MAX)
  fieldingRating?: number | null;

  @IsOptional()
  @IsIn(PLAYER_TYPES)
  playerType?: RegistrationPlayerType | null;
}
