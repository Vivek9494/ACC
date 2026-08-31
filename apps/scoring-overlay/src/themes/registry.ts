import type {
  OverlayGraphicComponentKey,
  OverlayThemeDefinition,
  OverlayThemeKey,
  ThemeGraphicBinding,
} from './types';
import { theme1Definition } from './theme1';

const REGISTRY: Record<OverlayThemeKey, OverlayThemeDefinition> = {
  theme1: theme1Definition,
};

export const OVERLAY_THEME_CATALOG: ReadonlyArray<{
  key: OverlayThemeKey;
  label: string;
}> = Object.values(REGISTRY).map((theme) => ({
  key: theme.key,
  label: theme.label,
}));

export const DEFAULT_OVERLAY_THEME: OverlayThemeKey = 'theme1';

export function isOverlayThemeKey(value: string): value is OverlayThemeKey {
  return value in REGISTRY;
}

/** Resolve a match's theme key to its full component set definition. */
export function resolveOverlayTheme(themeKey: string | null | undefined): OverlayThemeDefinition {
  if (themeKey != null && isOverlayThemeKey(themeKey)) {
    return REGISTRY[themeKey];
  }
  return REGISTRY[DEFAULT_OVERLAY_THEME];
}

/** Look up one graphic slot within the active theme (Kind B capable). */
export function resolveThemeGraphic(
  theme: OverlayThemeDefinition,
  graphic: OverlayGraphicComponentKey,
): ThemeGraphicBinding {
  return theme.components[graphic];
}

export type {
  OverlayGraphicComponentKey,
  OverlayThemeDefinition,
  OverlayThemeKey,
  ScoreStripHost,
  ThemeGraphicBinding,
} from './types';
