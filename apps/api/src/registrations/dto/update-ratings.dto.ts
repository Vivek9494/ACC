import { RATING_MAX, RATING_MIN, type UpdateRatingsRequest } from '@acc/types';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/** Center Sevak rating update for an own-Center player (§7.5, APL only). */
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
}
