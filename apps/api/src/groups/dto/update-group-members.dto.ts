import { IsArray, IsOptional, IsUUID } from 'class-validator';

import type { UpdateGroupMembersRequest } from '@acc/types';

export class UpdateGroupMembersDto implements UpdateGroupMembersRequest {
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  addTeamIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  removeTeamIds?: string[];
}
