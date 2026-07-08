import { TEAM_FORM_MESSAGES, TEAM_NAME_MAX_LENGTH, type CreateTeamRequest } from '@acc/types';
import { IsOptional, IsString, IsUrl, IsUUID, MaxLength, MinLength, ValidateIf } from 'class-validator';

import { APP_URL_VALIDATION_OPTIONS } from '../../common/validation/url-options';

export class CreateTeamDto implements CreateTeamRequest {
  @IsString()
  @MinLength(1, { message: TEAM_FORM_MESSAGES.name.required })
  @MaxLength(TEAM_NAME_MAX_LENGTH, { message: TEAM_FORM_MESSAGES.name.maxLength })
  name!: string;

  @IsOptional()
  @IsUrl(APP_URL_VALIDATION_OPTIONS)
  logoUrl?: string | null;

  @IsOptional()
  @ValidateIf((_obj, value) => value != null)
  @IsUUID()
  captainUserId?: string | null;

  @IsOptional()
  @ValidateIf((_obj, value) => value != null)
  @IsUUID()
  viceCaptainUserId?: string | null;

  @IsOptional()
  @ValidateIf((_obj, value) => value != null)
  @IsUUID()
  managerUserId?: string | null;
}
