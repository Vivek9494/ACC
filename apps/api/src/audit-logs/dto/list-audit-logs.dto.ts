import {
  AUDIT_LOG_PAGE_SIZE,
  AUDIT_LOG_PAGE_SIZE_MAX,
  type ListAuditLogsParams,
} from '@acc/types';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class AuditLogRangeDto implements Pick<ListAuditLogsParams, 'from' | 'to'> {
  @IsDateString()
  @IsNotEmpty()
  from!: string;

  @IsDateString()
  @IsNotEmpty()
  to!: string;
}

export class ListAuditLogsDto extends AuditLogRangeDto implements ListAuditLogsParams {
  /** A user id, or "System" for automatic entries. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  actorUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  action?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  entityType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(AUDIT_LOG_PAGE_SIZE_MAX)
  pageSize?: number = AUDIT_LOG_PAGE_SIZE;
}
