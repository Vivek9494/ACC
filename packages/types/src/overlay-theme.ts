/** Registered overlay broadcast theme keys (`apps/scoring-overlay/src/themes`). */
export const OVERLAY_THEME_KEYS = ['theme1'] as const;

export type OverlayThemeKey = (typeof OVERLAY_THEME_KEYS)[number];

export const DEFAULT_OVERLAY_THEME: OverlayThemeKey = 'theme1';

export function isOverlayThemeKey(value: string): value is OverlayThemeKey {
  return (OVERLAY_THEME_KEYS as readonly string[]).includes(value);
}

/** Human labels for cockpit settings — only registered themes. */
export const OVERLAY_THEME_CATALOG: ReadonlyArray<{
  key: OverlayThemeKey;
  label: string;
}> = [{ key: 'theme1', label: 'Theme 1' }];

export interface UpdateMatchOverlayThemeRequest {
  overlayTheme: OverlayThemeKey;
}
