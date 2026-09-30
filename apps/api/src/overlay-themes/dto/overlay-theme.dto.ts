import { IsString, MaxLength, MinLength } from 'class-validator';

import {
  OVERLAY_THEME_NAME_MAX_LENGTH,
  type CreateOverlayThemeRequest,
  type UpdateOverlayThemeRequest,
} from '@acc/types';

export class CreateOverlayThemeDto implements CreateOverlayThemeRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(OVERLAY_THEME_NAME_MAX_LENGTH)
  name!: string;
}

export class UpdateOverlayThemeDto implements UpdateOverlayThemeRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(OVERLAY_THEME_NAME_MAX_LENGTH)
  name!: string;
}
