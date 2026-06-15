import {
  GROUP_FORM_MESSAGES,
  GROUP_NAME_MAX_LENGTH,
  MatchSchedulingFormat,
  normalizeGroupName,
  type CreateGroupRequest,
  type GroupSummary,
} from '@acc/types';
import { IsArray, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateGroupDto implements CreateGroupRequest {
  @IsString()
  @MinLength(1, { message: GROUP_FORM_MESSAGES.name.required })
  @MaxLength(GROUP_NAME_MAX_LENGTH, { message: GROUP_FORM_MESSAGES.name.maxLength })
  name!: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  teamIds?: string[];
}
