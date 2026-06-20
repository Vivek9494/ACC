import { ADMIN_USERS_PAGE_SIZE, ADMIN_USERS_PAGE_SIZE_MAX } from '@acc/types';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/** Query params for GET /admin/users (search + cursor pagination). */
export class ListAdminUsersDto {
  /** Search by name or mobile number (partial match). */
  @IsOptional()
  @IsString()
  q?: string;

  /** Opaque cursor — previous page's last user id. */
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(ADMIN_USERS_PAGE_SIZE_MAX)
  limit?: number = ADMIN_USERS_PAGE_SIZE;
}
