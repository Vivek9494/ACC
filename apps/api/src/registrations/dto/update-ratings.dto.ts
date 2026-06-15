import {
  REGISTRATION_FIELDING_RATING_VALUES,
  REGISTRATION_SKILL_RATING_VALUES,
  type UpdateRatingsRequest,
} from '@acc/types';
import { IsIn, IsInt, IsOptional } from 'class-validator';

/** Center Sevak rating update after the registration window closes (§7.5). */
export class UpdateRatingsDto implements UpdateRatingsRequest {
  @IsOptional()
  @IsInt()
  @IsIn(REGISTRATION_SKILL_RATING_VALUES)
  battingRating?: number | null;

  @IsOptional()
  @IsInt()
  @IsIn(REGISTRATION_SKILL_RATING_VALUES)
  bowlingRating?: number | null;

  @IsOptional()
  @IsInt()
  @IsIn(REGISTRATION_FIELDING_RATING_VALUES)
  fieldingRating?: number | null;
}
