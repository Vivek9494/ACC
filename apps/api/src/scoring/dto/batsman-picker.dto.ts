import { BatsmanPickerRole } from '@acc/types';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

/** Query params for the state-aware Select Batsman picker. */
export class BatsmanPickerQueryDto {
  @IsEnum(BatsmanPickerRole)
  role!: BatsmanPickerRole;

  /** User already chosen for the other crease slot (prevents duplicate selection). */
  @IsOptional()
  @IsUUID()
  otherSlotUserId?: string;
}
