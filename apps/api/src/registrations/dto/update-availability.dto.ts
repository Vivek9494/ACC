import { type UpdateAvailabilityRequest } from '@acc/types';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

/** Center Sevak records a player's availability for the tournament (§7.5). */
export class UpdateAvailabilityDto implements UpdateAvailabilityRequest {
  @IsBoolean()
  isAvailable!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  availabilityNote?: string | null;
}
