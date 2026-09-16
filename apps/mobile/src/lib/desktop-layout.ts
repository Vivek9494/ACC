import { useEffect, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

/** Tailwind-aligned breakpoints for hybrid phone / desktop layouts. */
export const DESKTOP_BREAKPOINT_PX = 1024;
export const TABLET_BREAKPOINT_PX = 768;

/**
 * Cap for the desktop cockpit shell. Beyond this, the layout centers and
 * columns stop stretching into awkward ultra-wide whitespace.
 */
export const COCKPIT_MAX_WIDTH_PX = 2560;

export interface DesktopLayoutInfo {
  width: number;
  height: number;
  /** ≥ 1024px — multi-panel desktop console. */
  isDesktop: boolean;
  /** ≥ 768px — tablet / small laptop. */
  isTabletOrWider: boolean;
}

/**
 * Layout viewport size from the DOM.
 *
 * Prefer documentElement client size over RN-web Dimensions: on web (incl.
 * Electron BrowserView), react-native-web only listens to visualViewport.resize
 * and can miss BrowserView bound changes, freezing useWindowDimensions.
 */
function readDomViewportSize(): { width: number; height: number } {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { width: 0, height: 0 };
  }
  const docEl = document.documentElement;
  return {
    width: docEl.clientWidth || window.innerWidth || 0,
    height: docEl.clientHeight || window.innerHeight || 0,
  };
}

/**
 * Viewport-driven layout flags.
 *
 * On web, also subscribe to window + visualViewport resize (and matchMedia) so
 * Electron BrowserView resizes reflow live — RN-web Dimensions alone is not enough.
 */
export function useDesktopLayout(): DesktopLayoutInfo {
  const rnDims = useWindowDimensions();
  const [domDims, setDomDims] = useState(readDomViewportSize);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    const update = () => {
      setDomDims(readDomViewportSize());
    };

    update();
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);

    const desktopQuery = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT_PX}px)`);
    const tabletQuery = window.matchMedia(`(min-width: ${TABLET_BREAKPOINT_PX}px)`);
    desktopQuery.addEventListener('change', update);
    tabletQuery.addEventListener('change', update);

    return () => {
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
      desktopQuery.removeEventListener('change', update);
      tabletQuery.removeEventListener('change', update);
    };
  }, []);

  const width =
    Platform.OS === 'web' && domDims.width > 0 ? domDims.width : rnDims.width;
  const height =
    Platform.OS === 'web' && domDims.height > 0 ? domDims.height : rnDims.height;

  return {
    width,
    height,
    isDesktop: width >= DESKTOP_BREAKPOINT_PX,
    isTabletOrWider: width >= TABLET_BREAKPOINT_PX,
  };
}
