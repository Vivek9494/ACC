/**
 * Shared enter/exit visibility for overlay graphics (OBS browser source).
 * CSS drives the motion via `.graphic` / `.is-visible`; this only toggles classes
 * and delays `hidden` until the exit transition finishes.
 */

export const GRAPHIC_ANIM_MS = 400;

/** Show: clear hidden, then add `.is-visible` on the next frame so CSS can transition. */
export function revealGraphic(node: HTMLElement | null | undefined): void {
  if (!node) {
    return;
  }
  node.hidden = false;
  requestAnimationFrame(() => {
    node.classList.add('is-visible');
  });
}

/**
 * Hide: remove `.is-visible`, wait for exit CSS, then set `hidden`.
 * If show re-enters before the timer, the node stays visible (no stuck hide).
 */
export function concealGraphic(
  node: HTMLElement | null | undefined,
  onHidden?: () => void,
): void {
  if (!node) {
    onHidden?.();
    return;
  }
  node.classList.remove('is-visible');
  window.setTimeout(() => {
    if (node.classList.contains('is-visible')) {
      return;
    }
    node.hidden = true;
    onHidden?.();
  }, GRAPHIC_ANIM_MS);
}
