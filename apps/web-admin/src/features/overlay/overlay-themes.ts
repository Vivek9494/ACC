import {
  isOverlayThemeHtmlFileName,
  isOverlayThemeHtmlMimeType,
  OVERLAY_THEME_CONTROLS,
  OVERLAY_THEME_HTML_MAX_BYTES,
  OVERLAY_THEME_MESSAGES,
} from '@acc/types';

export type OverlayThemeControl = (typeof OVERLAY_THEME_CONTROLS)[number];

export interface OverlayControlSection {
  title: string;
  controls: OverlayThemeControl[];
}

/** Controls grouped in cockpit order by their panel section. */
export function overlayControlSections(): OverlayControlSection[] {
  const sections: OverlayControlSection[] = [];
  for (const control of OVERLAY_THEME_CONTROLS) {
    const last = sections.at(-1);
    if (last?.title === control.section) {
      last.controls.push(control);
    } else {
      sections.push({ title: control.section, controls: [control] });
    }
  }
  return sections;
}

/** Client-side pre-check (the server re-validates): `.html`, `text/html`, size. */
export function htmlFileError(file: Pick<File, 'name' | 'type' | 'size'>): string | null {
  if (!isOverlayThemeHtmlFileName(file.name) || !isOverlayThemeHtmlMimeType(file.type)) {
    return OVERLAY_THEME_MESSAGES.fileType;
  }
  if (file.size === 0) return OVERLAY_THEME_MESSAGES.fileRequired;
  if (file.size > OVERLAY_THEME_HTML_MAX_BYTES) return OVERLAY_THEME_MESSAGES.fileSize;
  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
}
