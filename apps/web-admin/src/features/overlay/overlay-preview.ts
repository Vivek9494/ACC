import {
  buildOverlayPreviewPath,
  DEFAULT_OVERLAY_PREVIEW_DATASET,
  DEFAULT_OVERLAY_PREVIEW_GRAPHIC,
  isOverlayPreviewDataset,
  isOverlayPreviewGraphicKey,
  OVERLAY_PREVIEW_GRAPHICS,
  OVERLAY_PREVIEW_GROUPS,
  type OverlayPreviewDataset,
  type OverlayPreviewGraphicKey,
  type OverlayPreviewGroup,
} from '@acc/types';

/** OBS overlay canvas — the preview iframe renders at this size and is scaled down. */
export const OVERLAY_CANVAS = { width: 1920, height: 1080 } as const;

const PRODUCTION_OVERLAY_ORIGIN = 'https://acc-overlay.netlify.app';
const LOCAL_OVERLAY_ORIGIN = 'http://localhost:5178';

export function resolveOverlayOrigin(configured: string | undefined, isDev: boolean): string {
  const origin = configured?.trim() || (isDev ? LOCAL_OVERLAY_ORIGIN : PRODUCTION_OVERLAY_ORIGIN);
  return new URL(origin).origin;
}

export const OVERLAY_ORIGIN = resolveOverlayOrigin(import.meta.env.VITE_OVERLAY_URL, import.meta.env.DEV);

export function overlayPreviewUrl(
  origin: string,
  graphic: OverlayPreviewGraphicKey,
  dataset: OverlayPreviewDataset,
): string {
  return `${origin}${buildOverlayPreviewPath(graphic, dataset)}`;
}

export interface PreviewGalleryGroup {
  key: OverlayPreviewGroup;
  label: string;
  graphics: Array<{ key: OverlayPreviewGraphicKey; label: string }>;
}

export function previewGalleryGroups(): PreviewGalleryGroup[] {
  return OVERLAY_PREVIEW_GROUPS.map((group) => ({
    key: group.key,
    label: group.label,
    graphics: OVERLAY_PREVIEW_GRAPHICS.filter((graphic) => graphic.group === group.key).map(
      ({ key, label }) => ({ key, label }),
    ),
  }));
}

export function parsePreviewSelection(params: URLSearchParams): {
  graphic: OverlayPreviewGraphicKey;
  dataset: OverlayPreviewDataset;
} {
  const graphic = params.get('graphic') ?? '';
  const dataset = params.get('dataset') ?? '';
  return {
    graphic: isOverlayPreviewGraphicKey(graphic) ? graphic : DEFAULT_OVERLAY_PREVIEW_GRAPHIC,
    dataset: isOverlayPreviewDataset(dataset) ? dataset : DEFAULT_OVERLAY_PREVIEW_DATASET,
  };
}
