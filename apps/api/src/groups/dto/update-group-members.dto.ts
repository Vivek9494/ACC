import { IsArray, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

import { GROUP_FORM_MESSAGES, GROUP_NAME_MAX_LENGTH, type UpdateGroupRequest } from '@acc/types';

export class UpdateGroupDto implements UpdateGroupRequest {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: GROUP_FORM_MESSAGES.name.required })
  @MaxLength(GROUP_NAME_MAX_LENGTH, { message: GROUP_FORM_MESSAGES.name.maxLength })
  name?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  addTeamIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  removeTeamIds?: string[];
}
