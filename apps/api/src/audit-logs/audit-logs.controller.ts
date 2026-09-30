import { Permission, type AuditLogFilterOptions, type AuditLogPage } from '@acc/types';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../authz/permission.guard';
import { RequirePermission } from '../authz/require-permission.decorator';
import { AuditLogsService } from './audit-logs.service';
import { AuditLogRangeDto, ListAuditLogsDto } from './dto/list-audit-logs.dto';

@Controller('admin/audit-logs')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission(Permission.VIEW_AUDIT_LOG)
export class AuditLogsController {
  constructor(private readonly auditLogs: AuditLogsService) {}

  @Get()
  list(@Query() query: ListAuditLogsDto): Promise<AuditLogPage> {
    return this.auditLogs.list(query);
  }

  @Get('filters')
  filters(@Query() query: AuditLogRangeDto): Promise<AuditLogFilterOptions> {
    return this.auditLogs.filterOptions(query);
  }
}
