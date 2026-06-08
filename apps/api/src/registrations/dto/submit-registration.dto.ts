import {
  BattingStyle,
  BowlingStyle,
  type LateRegistrationRequest,
  RATING_MAX,
  RATING_MIN,
  type SubmitRegistrationRequest,
} from '@acc/types';
import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const BATTING_STYLES = Object.values(BattingStyle);
const BOWLING_STYLES = Object.values(BowlingStyle);

/** Default §7.1 registration form. Name/phone/Center come from the profile. */
export class SubmitRegistrationDto implements SubmitRegistrationRequest {
  @IsOptional()
  @IsIn(BATTING_STYLES)
  battingStyle?: BattingStyle | null;

  @IsOptional()
  @IsInt()
  @Min(RATING_MIN)
  @Max(RATING_MAX)
  battingRating?: number | null;

  @IsOptional()
  @IsIn(BOWLING_STYLES)
  bowlingStyle?: BowlingStyle | null;

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
  @IsString()
  @MaxLength(60)
  fieldingPosition?: string | null;

  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown> | null;
}

/** Late registration of a missed player by Organizer / Center Sevak (§7.6). */
export class LateRegistrationDto
  extends SubmitRegistrationDto
  implements LateRegistrationRequest
{
  @IsString()
  @MaxLength(64)
  userId!: string;
}
