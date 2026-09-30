import {
  OVERLAY_THEME_CONTROLS,
  OVERLAY_THEME_HTML_MAX_BYTES,
  OVERLAY_THEME_MESSAGES,
  UserRole,
} from '@acc/types';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { canOpenNavItem, navItemForPath } from '@/app/nav';

import { OVERLAY_PREVIEW_SANDBOX, SandboxedHtmlFrame } from './HtmlPreviewDialog';
import { formatFileSize, htmlFileError, overlayControlSections } from './overlay-themes';

describe('htmlFileError', () => {
  const html = { name: 'strip.html', type: 'text/html', size: 100 };

  it('accepts .html with text/html', () => {
    expect(htmlFileError(html)).toBeNull();
    expect(htmlFileError({ ...html, name: 'STRIP.HTML' })).toBeNull();
  });

  it.each([
    ['.htm extension', { ...html, name: 'strip.htm' }],
    ['.js with html type', { ...html, name: 'strip.js' }],
    ['html name with js type', { ...html, type: 'text/javascript' }],
    ['missing type', { ...html, type: '' }],
    ['svg', { name: 'a.svg', type: 'image/svg+xml', size: 10 }],
  ])('rejects %s', (_label, file) => {
    expect(htmlFileError(file)).toBe(OVERLAY_THEME_MESSAGES.fileType);
  });

  it('rejects empty and oversized files', () => {
    expect(htmlFileError({ ...html, size: 0 })).toBe(OVERLAY_THEME_MESSAGES.fileRequired);
    expect(htmlFileError({ ...html, size: OVERLAY_THEME_HTML_MAX_BYTES + 1 })).toBe(
      OVERLAY_THEME_MESSAGES.fileSize,
    );
  });
});

describe('overlayControlSections', () => {
  it('keeps every control once, in cockpit order', () => {
    const sections = overlayControlSections();
    expect(sections.map((s) => s.title)).toEqual([
      'Always on air',
      'Score strip modes',
      'Common',
      'Team',
      'Tournament',
    ]);
    expect(sections.flatMap((s) => s.controls.map((c) => c.key))).toEqual(
      OVERLAY_THEME_CONTROLS.map((c) => c.key),
    );
    expect(new Set(OVERLAY_THEME_CONTROLS.map((c) => c.key)).size).toBe(24);
  });
});

describe('formatFileSize', () => {
  it('formats bytes and KB', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(2048)).toBe('2.0 KB');
    expect(formatFileSize(200 * 1024)).toBe('200 KB');
  });
});

describe('SandboxedHtmlFrame', () => {
  it('renders the HTML only as srcdoc of a sandboxed iframe without allow-same-origin', () => {
    const markup = renderToStaticMarkup(
      <SandboxedHtmlFrame
        preview={{ title: 'Bowler', fileName: 'b.html', html: '<script>top.x=1</script>' }}
      />,
    );
    expect(OVERLAY_PREVIEW_SANDBOX).not.toContain('allow-same-origin');
    expect(markup).toContain(`sandbox="${OVERLAY_PREVIEW_SANDBOX}"`);
    expect(markup).toContain('srcDoc="&lt;script&gt;top.x=1&lt;/script&gt;"');
    expect(markup.startsWith('<iframe')).toBe(true);
    expect(markup).not.toContain('<script>');
  });
});

describe('Overlay nav item', () => {
  it('is Admin only', () => {
    const item = navItemForPath('/overlay/new');
    expect(item?.label).toBe('Overlay');
    expect(item && canOpenNavItem(item, UserRole.Admin)).toBe(true);
    expect(item && canOpenNavItem(item, UserRole.ClubManager)).toBe(false);
  });
});
