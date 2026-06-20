import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

/** Query params for the bowling-side fielder / wicketkeeper picker. */
export class FielderPickerQueryDto {
  /** When true, omit the current bowler (stumping — bowler cannot keep). */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  excludeBowler?: boolean;
}
