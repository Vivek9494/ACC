import { BOWLING_TYPE_OPTIONS } from '@acc/types';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Body for adding a name-only external opponent bowler (§9.5). */
export class AddExternalBowlerDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsIn([...BOWLING_TYPE_OPTIONS])
  bowlingType?: string | null;
}
