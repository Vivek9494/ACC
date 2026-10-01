/**
 * Renderer hardening for the cockpit BrowserView and the file:// shell.
 * The cockpit preload bridge (OBS + local files) is only usable from the trusted
 * cockpit origin: navigation off it is blocked, and every IPC call re-checks the sender.
 */

const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { session, shell } = require('electron');

/** Renderer permissions the cockpit legitimately needs; everything else is denied. */
const ALLOWED_PERMISSIONS = new Set(['clipboard-sanitized-write', 'fullscreen']);

const CLIP_EXTENSIONS = new Set(['.mp4', '.mkv', '.mov', '.flv', '.ts', '.m4v']);

/**
 * @param {string} url
 * @param {string} origin
 */
function isSameOrigin(url, origin) {
  try {
    return new URL(url).origin === origin;
  } catch {
    return false;
  }
}

/** @param {string} url */
function openExternalIfHttps(url) {
  try {
    if (new URL(url).protocol === 'https:') {
      void shell.openExternal(url);
    }
  } catch {
    // ignore malformed URLs
  }
}

/**
 * Keep the cockpit view on its origin; off-origin links open in the system browser.
 * @param {Electron.WebContents} contents
 * @param {string} cockpitOrigin
 */
function lockToOrigin(contents, cockpitOrigin) {
  const guard = (event, url) => {
    if (isSameOrigin(url, cockpitOrigin)) {
      return;
    }
    event.preventDefault();
    openExternalIfHttps(url);
  };
  contents.on('will-navigate', guard);
  contents.on('will-redirect', guard);
  contents.setWindowOpenHandler(({ url }) => {
    openExternalIfHttps(url);
    return { action: 'deny' };
  });
}

/**
 * Shell window: only its own bundled page.
 * @param {Electron.WebContents} contents
 * @param {string} shellFileUrl
 */
function lockToShell(contents, shellFileUrl) {
  contents.on('will-navigate', (event, url) => {
    if (url !== shellFileUrl) {
      event.preventDefault();
    }
  });
  contents.setWindowOpenHandler(({ url }) => {
    openExternalIfHttps(url);
    return { action: 'deny' };
  });
}

/**
 * App-wide defaults: no <webview>, deny-by-default permissions.
 * @param {Electron.App} app
 * @param {string} cockpitOrigin
 */
function applyGlobalHardening(app, cockpitOrigin) {
  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-attach-webview', (event) => event.preventDefault());
  });
  const ses = session.defaultSession;
  ses.setPermissionRequestHandler((contents, permission, callback) => {
    callback(ALLOWED_PERMISSIONS.has(permission) && isSameOrigin(contents.getURL(), cockpitOrigin));
  });
  ses.setPermissionCheckHandler((_contents, permission, requestingOrigin) => {
    return ALLOWED_PERMISSIONS.has(permission) && requestingOrigin === cockpitOrigin;
  });
}

/**
 * True when the IPC came from the top frame of a trusted renderer.
 * @param {Electron.IpcMainEvent | Electron.IpcMainInvokeEvent} event
 * @param {{ cockpitOrigin: string, shellFileUrl: string, allowShell: boolean }} opts
 */
function isTrustedSender(event, opts) {
  const frame = event.senderFrame;
  if (!frame || frame !== event.sender.mainFrame) {
    return false;
  }
  if (isSameOrigin(frame.url, opts.cockpitOrigin)) {
    return true;
  }
  return opts.allowShell && frame.url === opts.shellFileUrl;
}

/** @param {string} shellHtmlPath */
function fileUrl(shellHtmlPath) {
  return pathToFileURL(shellHtmlPath).href;
}

/**
 * Real path of an existing file/folder (symlinks resolved), else null.
 * @param {string} target
 */
function realPathOrNull(target) {
  try {
    return fs.realpathSync(path.resolve(target));
  } catch {
    return null;
  }
}

/**
 * Local clip paths the renderer may hand to OBS / ffmpeg: existing files under
 * the app's clips folder, or paths OBS itself returned this session. Compared
 * as real paths so symlinks can neither escape the folder nor cause false misses.
 * @param {unknown} candidate
 * @param {{ clipsRoot: string, knownPaths: Set<string> }} opts
 * @returns {string | null} real path, or null when not allowed
 */
function allowedClipPath(candidate, opts) {
  if (typeof candidate !== 'string' || !candidate.trim()) {
    return null;
  }
  const resolved = realPathOrNull(candidate.trim());
  if (!resolved || !CLIP_EXTENSIONS.has(path.extname(resolved).toLowerCase())) {
    return null;
  }
  const root = realPathOrNull(opts.clipsRoot);
  if ((root && resolved.startsWith(root + path.sep)) || opts.knownPaths.has(resolved)) {
    return resolved;
  }
  return null;
}

module.exports = {
  applyGlobalHardening,
  allowedClipPath,
  realPathOrNull,
  fileUrl,
  isSameOrigin,
  isTrustedSender,
  lockToOrigin,
  lockToShell,
};
