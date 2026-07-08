import { ADMIN_USERS_PAGE_SIZE, ADMIN_USERS_PAGE_SIZE_MAX } from '@acc/types';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

/** Query params for GET /admin/users (search + geography filters + cursor pagination). */
export class ListAdminUsersDto {
  /** Search by name or mobile number (partial match). */
  @IsOptional()
  @IsString()
  q?: string;

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
