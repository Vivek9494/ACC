import { RegistrationSortKey, RegistrationStatus } from '@acc/types';
import { IsIn, IsOptional, IsString } from 'class-validator';

const STATUSES = Object.values(RegistrationStatus);
const SORT_KEYS = Object.values(RegistrationSortKey);

/** Query filters for the registration list (§7.4 visibility, §7.5 sort). */
export class ListRegistrationsDto {
  @IsOptional()
  @IsIn(STATUSES)
  status?: RegistrationStatus;

  /** Filter to a single Center (Club Manager filter — §7.4). */
  @IsOptional()
  @IsString()
  centerId?: string;

  @IsOptional()
  @IsIn(SORT_KEYS)
  sort?: RegistrationSortKey;
}
