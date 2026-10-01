import { OVERLAY_PREVIEW_GRAPHICS, parseOverlayPreviewMessage } from '@acc/types';
import { describe, expect, it } from 'vitest';

import {
  overlayPreviewUrl,
  parsePreviewSelection,
  previewGalleryGroups,
  resolveOverlayOrigin,
} from './overlay-preview';

describe('overlay preview', () => {
  it('lists every catalog graphic exactly once in the gallery', () => {
    const keys = previewGalleryGroups().flatMap((group) => group.graphics.map((g) => g.key));
    expect(keys).toHaveLength(OVERLAY_PREVIEW_GRAPHICS.length);
    expect(new Set(keys).size).toBe(keys.length);
    expect(previewGalleryGroups().every((group) => group.graphics.length > 0)).toBe(true);
  });

  it('builds the preview URL on the overlay origin', () => {
    expect(overlayPreviewUrl('https://acc-overlay.netlify.app', 'batting_card', 'edge')).toBe(
      'https://acc-overlay.netlify.app/preview.html?preview=1&graphic=batting_card&dataset=edge',
    );
  });

  it('resolves the overlay origin from config, else local in dev and production otherwise', () => {
    expect(resolveOverlayOrigin('https://overlay.example.com/some/path', false)).toBe('https://overlay.example.com');
    expect(resolveOverlayOrigin(undefined, true)).toBe('http://localhost:5178');
    expect(resolveOverlayOrigin('  ', false)).toBe('https://acc-overlay.netlify.app');
  });

  it('falls back to defaults for unknown selections', () => {
    expect(parsePreviewSelection(new URLSearchParams('graphic=nope&dataset=zzz'))).toEqual({
      graphic: 'strip',
      dataset: 'standard',
    });
    expect(parsePreviewSelection(new URLSearchParams('graphic=points_table&dataset=edge'))).toEqual({
      graphic: 'points_table',
      dataset: 'edge',
    });
  });

  it('accepts only show / replay / hide messages', () => {
    expect(parseOverlayPreviewMessage({ type: 'replay' })).toEqual({ type: 'replay' });
    expect(parseOverlayPreviewMessage({ type: 'hide_all' })).toBeNull();
    expect(parseOverlayPreviewMessage('show')).toBeNull();
    expect(parseOverlayPreviewMessage(null)).toBeNull();
  });
});
