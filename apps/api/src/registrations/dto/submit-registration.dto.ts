import {
  BattingStyle,
  BATTING_POSITION_OPTIONS,
  BowlingStyle,
  BOWLING_TYPE_OPTIONS,
  FIELDING_POSITION_OPTIONS,
  type LateRegistrationRequest,
  PlayerRegistrationRole,
  RATING_MAX,
  RATING_MIN,
  type SubmitRegistrationRequest,
} from '@acc/types';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const BATTING_STYLES = Object.values(BattingStyle);
const BOWLING_STYLES = Object.values(BowlingStyle);
const PLAYER_ROLES = Object.values(PlayerRegistrationRole);

/** Default §7.1 registration form. Profile name/center may be updated on submit. */
export class SubmitRegistrationDto implements SubmitRegistrationRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  lastName!: string;

  @IsUUID()
  centerId!: string;

  @IsOptional()
  @IsIn(BATTING_STYLES)
  battingStyle?: BattingStyle | null;

  @IsOptional()
  @IsIn(PLAYER_ROLES)
  playerRole?: PlayerRegistrationRole | null;

  @IsOptional()
  @IsInt()
  @Min(RATING_MIN)
  @Max(RATING_MAX)
  battingRating?: number | null;

  @IsOptional()
  @IsIn([...BATTING_POSITION_OPTIONS])
  battingPosition?: string | null;

  @IsOptional()
  @IsIn(BOWLING_STYLES)
  bowlingStyle?: BowlingStyle | null;

  @IsOptional()
  @IsIn([...BOWLING_TYPE_OPTIONS])
  bowlingType?: string | null;

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
  @IsIn([...FIELDING_POSITION_OPTIONS])
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
