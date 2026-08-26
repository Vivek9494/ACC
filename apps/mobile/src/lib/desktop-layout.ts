import { useWindowDimensions } from 'react-native';

/** Tailwind-aligned breakpoints for hybrid phone / desktop layouts. */
export const DESKTOP_BREAKPOINT_PX = 1024;
export const TABLET_BREAKPOINT_PX = 768;

export interface DesktopLayoutInfo {
  width: number;
  height: number;
  /** ≥ 1024px — multi-panel desktop console. */
  isDesktop: boolean;
  /** ≥ 768px — tablet / small laptop. */
  isTabletOrWider: boolean;
}

/** Viewport-driven layout flags. */
export function useDesktopLayout(): DesktopLayoutInfo {
  const { width, height } = useWindowDimensions();
  return {
    width,
    height,
    isDesktop: width >= DESKTOP_BREAKPOINT_PX,
    isTabletOrWider: width >= TABLET_BREAKPOINT_PX,
  };
}
