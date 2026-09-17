/**
 * ASC Broadcast Electron BrowserView detection (panel-preload present).
 * Kept tiny so auth/nav can import without pulling cockpit OBS UI.
 */

/** True only inside ASC Broadcast Electron (BrowserView preload present). */
export function hasAscObsBridge(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const obs = window.ascBroadcast?.obs;
  if (typeof obs?.getStatus !== 'function' || typeof obs?.getConfig !== 'function') {
    return false;
  }
  return true;
}
