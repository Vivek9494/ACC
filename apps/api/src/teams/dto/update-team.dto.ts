import { TEAM_FORM_MESSAGES, TEAM_NAME_MAX_LENGTH, type UpdateTeamRequest } from '@acc/types';
import { IsOptional, IsString, IsUrl, MaxLength, MinLength, ValidateIf } from 'class-validator';

import { APP_URL_VALIDATION_OPTIONS } from '../../common/validation/url-options';

export class UpdateTeamDto implements UpdateTeamRequest {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: TEAM_FORM_MESSAGES.name.required })
  @MaxLength(TEAM_NAME_MAX_LENGTH, { message: TEAM_FORM_MESSAGES.name.maxLength })
  name?: string;

  @IsOptional()
  @ValidateIf((_obj, value) => value != null && value !== '')
  @IsUrl(APP_URL_VALIDATION_OPTIONS)
  logoUrl?: string | null;
}
