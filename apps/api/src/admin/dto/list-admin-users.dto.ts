import {
  ADMIN_PLATFORM_ROLES,
  ADMIN_USERS_PAGE_SIZE,
  ADMIN_USERS_PAGE_SIZE_MAX,
  type ListAdminUsersParams,
  type UserRole,
} from '@acc/types';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

/** Query params for GET /admin/users (search + geography/role filters + cursor pagination). */
export class ListAdminUsersDto implements ListAdminUsersParams {
  /** Search by name or mobile number (partial match). */
  @IsOptional()
  @IsString()
  q?: string;

  /** Filter by platform `User.role`. */
  @IsOptional()
  @IsIn(ADMIN_PLATFORM_ROLES)
  role?: UserRole;

  /** Filter users by registration center's province. */
  @IsOptional()
  @IsUUID()
  provinceId?: string;

  /** Filter users by registration center. */
  @IsOptional()
  @IsUUID()
  centerId?: string;

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
