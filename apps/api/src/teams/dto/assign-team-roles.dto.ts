import type { AssignTeamRolesRequest } from '@acc/types';
import { IsOptional, IsUUID, ValidateIf } from 'class-validator';

/** Body for PATCH team leadership roles (Captain / Vice-Captain). */
export class AssignTeamRolesDto implements AssignTeamRolesRequest {
  @IsOptional()
  @ValidateIf((_obj, value) => value != null)
  @IsUUID()
  captainUserId?: string | null;

  @IsOptional()
  @ValidateIf((_obj, value) => value != null)
  @IsUUID()
  viceCaptainUserId?: string | null;
}
