import { OVERLAY_THEME_KEYS, type OverlayThemeKey } from '@acc/types';
import { IsIn } from 'class-validator';

/** Per-match broadcast overlay theme (cockpit settings). */
export class UpdateMatchOverlayThemeDto {
  @IsIn(OVERLAY_THEME_KEYS)
  overlayTheme!: OverlayThemeKey;
}
